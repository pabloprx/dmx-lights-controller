// DMX Controller with Audio FFT (DUAL-CORE OPTIMIZED)
// Combined: FFT mic input + DMX output on single ESP32
// FFT runs on Core 0, DMX+Serial runs on Core 1 for low latency
//
// Serial Protocol:
// - SEND: {"bass":N,"mid":N,"high":N}\n  (every ~32ms from FFT task)
// - RECV: ch1,ch2,ch3,...,ch100\n        (CSV DMX values)
// - RECV: CFG:key=value\n                (config commands)
//   Valid keys: bassMax, midMax, highMax, bassSilence, midSilence, highSilence, noiseFloor
// - RECV: CFG:GET\n                      (request current config)
//
// Hardware:
// - MIC_PIN 34: MAX4466 electret microphone
// - DMX_TX 17: RS485 TX (DI pin)
// - DMX_EN 4: RS485 enable (DE/RE bridged)

#include <arduinoFFT.h>

// ═══════════════════════════════════════════════════════════════
// FFT CONFIG (256 samples = ~32ms per FFT, good speed/accuracy balance)
// ═══════════════════════════════════════════════════════════════
#define SAMPLES 256
#define SAMPLING_FREQ 8000
#define MIC_PIN 34

double vReal[SAMPLES];
double vImag[SAMPLES];
ArduinoFFT<double> FFT = ArduinoFFT<double>(vReal, vImag, SAMPLES, SAMPLING_FREQ);

// Audio thresholds (configurable via CFG: commands)
int bassSilence = 30, midSilence = 20, highSilence = 25;
int bassMax = 200000, midMax = 300000, highMax = 250000;
int noiseFloor = 15;  // Values below this are zeroed

// Shared audio levels (written by FFT task, read by main loop)
volatile int bassLevel = 0, midLevel = 0, highLevel = 0;

// ═══════════════════════════════════════════════════════════════
// DMX CONFIG (simple HardwareSerial method - works!)
// ═══════════════════════════════════════════════════════════════
HardwareSerial DMX(1);
#define DMX_TX 17
#define DMX_EN 4
#define CHANNELS 100
#define DMX_PACKET_SIZE 513
#define DMX_REFRESH_MS 23  // ~44Hz DMX refresh rate

uint8_t dmx[DMX_PACKET_SIZE];
unsigned long lastDMXTime = 0;

inline void driverEnable(bool on) {
  digitalWrite(DMX_EN, on ? HIGH : LOW);
}

// ═══════════════════════════════════════════════════════════════
// FFT TASK (runs on Core 0, independent of DMX)
// ═══════════════════════════════════════════════════════════════
void fftTask(void* param) {
  while (true) {
    // 1. FFT MIC SAMPLING (~32ms for 256 samples)
    unsigned long t = micros();
    for (int i = 0; i < SAMPLES; i++) {
      vReal[i] = analogRead(MIC_PIN) - 2048;
      vImag[i] = 0;
      while (micros() - t < 125) {}
      t += 125;
    }

    // 2. FFT COMPUTE
    FFT.windowing(FFT_WIN_TYP_HAMMING, FFT_FORWARD);
    FFT.compute(FFT_FORWARD);
    FFT.complexToMagnitude();

    // 3. FREQUENCY BAND SUMS (adjusted for 256 samples)
    float bass = 0, mid = 0, high = 0;
    for (int i = 2; i < SAMPLES / 2; i++) {
      if (i <= 12) bass += vReal[i];       // ~0-375Hz
      else if (i <= 40) mid += vReal[i];   // ~375-1250Hz
      else if (i <= 80) high += vReal[i];  // ~1250-2500Hz
    }

    // 4. NORMALIZE TO 0-100
    int b = constrain(map(bass, bassSilence * 2500, bassMax / 2, 0, 100), 0, 100);
    int m = constrain(map(mid, midSilence * 1000, midMax / 2, 0, 100), 0, 100);
    int h = constrain(map(high, highSilence * 1000, highMax / 2, 0, 100), 0, 100);

    if (b < noiseFloor) b = 0;
    if (m < noiseFloor) m = 0;
    if (h < noiseFloor) h = 0;

    // 5. UPDATE SHARED LEVELS (atomic-ish for int)
    bassLevel = b;
    midLevel = m;
    highLevel = h;

    // Small yield to prevent watchdog
    vTaskDelay(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// CONFIG COMMANDS
// ═══════════════════════════════════════════════════════════════
void sendConfig() {
  Serial.printf("{\"type\":\"config\",\"bassMax\":%d,\"midMax\":%d,\"highMax\":%d,\"bassSilence\":%d,\"midSilence\":%d,\"highSilence\":%d,\"noiseFloor\":%d}\n",
    bassMax, midMax, highMax, bassSilence, midSilence, highSilence, noiseFloor);
}

void parseConfig(String cmd) {
  // Format: CFG:key=value or CFG:GET
  if (cmd == "CFG:GET") {
    sendConfig();
    return;
  }

  int eqIdx = cmd.indexOf('=');
  if (eqIdx == -1) return;

  String key = cmd.substring(4, eqIdx);  // Skip "CFG:"
  int value = cmd.substring(eqIdx + 1).toInt();

  if (key == "bassMax") bassMax = value;
  else if (key == "midMax") midMax = value;
  else if (key == "highMax") highMax = value;
  else if (key == "bassSilence") bassSilence = value;
  else if (key == "midSilence") midSilence = value;
  else if (key == "highSilence") highSilence = value;
  else if (key == "noiseFloor") noiseFloor = value;

  // Acknowledge with current config
  sendConfig();
}

// ═══════════════════════════════════════════════════════════════
// DMX OUTPUT (same method that works with lights!)
// ═══════════════════════════════════════════════════════════════
void sendDMX() {
  driverEnable(false);
  delayMicroseconds(10);

  DMX.end();
  pinMode(DMX_TX, OUTPUT);

  driverEnable(true);

  // BREAK - 92µs
  digitalWrite(DMX_TX, LOW);
  delayMicroseconds(92);

  // MAB - 12µs
  digitalWrite(DMX_TX, HIGH);
  delayMicroseconds(12);

  // Send data
  DMX.begin(250000, SERIAL_8N2, -1, DMX_TX);
  dmx[0] = 0;  // Start code
  DMX.write(dmx, DMX_PACKET_SIZE);
  DMX.flush();
}

// ═══════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);

  // ADC for mic
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // DMX output setup
  pinMode(DMX_EN, OUTPUT);
  driverEnable(true);
  memset(dmx, 0, DMX_PACKET_SIZE);
  DMX.begin(250000, SERIAL_8N2, -1, DMX_TX);

  // Start FFT task on Core 0 (main loop runs on Core 1)
  xTaskCreatePinnedToCore(
    fftTask,      // Function
    "FFT",        // Name
    4096,         // Stack size
    NULL,         // Parameters
    1,            // Priority
    NULL,         // Task handle
    0             // Core 0
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN LOOP (Core 1 - handles Serial + DMX output)
// ═══════════════════════════════════════════════════════════════
unsigned long lastAudioSend = 0;

void loop() {
  // ─────────────────────────────────────────────────────────────
  // 1. SEND AUDIO JSON (every 50ms, non-blocking)
  // ─────────────────────────────────────────────────────────────
  if (millis() - lastAudioSend >= 50) {
    Serial.printf("{\"bass\":%d,\"mid\":%d,\"high\":%d}\n", bassLevel, midLevel, highLevel);
    lastAudioSend = millis();
  }

  // ─────────────────────────────────────────────────────────────
  // 2. RECEIVE DMX VALUES OR CONFIG FROM WEB (non-blocking)
  // ─────────────────────────────────────────────────────────────
  while (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();

    if (line.length() == 0) continue;

    // Skip JSON (our own audio output echoed back)
    if (line[0] == '{') continue;

    // Config command: CFG:key=value or CFG:GET
    if (line.startsWith("CFG:")) {
      parseConfig(line);
      continue;
    }

    // DMX values: ch1,ch2,ch3,...,ch100
    int commaIndex = 0;
    for (int ch = 1; ch <= CHANNELS; ch++) {
      int nextComma = line.indexOf(',', commaIndex);
      if (nextComma == -1) nextComma = line.length();

      int value = line.substring(commaIndex, nextComma).toInt();
      dmx[ch] = constrain(value, 0, 255);

      commaIndex = nextComma + 1;
      if (commaIndex >= line.length()) break;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. OUTPUT DMX AT FIXED RATE (~44Hz)
  // ─────────────────────────────────────────────────────────────
  if (millis() - lastDMXTime >= DMX_REFRESH_MS) {
    sendDMX();
    lastDMXTime = millis();
  }
}
