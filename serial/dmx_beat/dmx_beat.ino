// DMX Controller with Audio FFT
// Combined: FFT mic input + DMX output on single ESP32
//
// Serial Protocol:
// - SEND: {"bass":N,"mid":N,"high":N}\n  (every ~60ms)
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
// FFT CONFIG
// ═══════════════════════════════════════════════════════════════
#define SAMPLES 512
#define SAMPLING_FREQ 8000
#define MIC_PIN 34

double vReal[SAMPLES];
double vImag[SAMPLES];
ArduinoFFT<double> FFT = ArduinoFFT<double>(vReal, vImag, SAMPLES, SAMPLING_FREQ);

// Audio thresholds (configurable via CFG: commands)
int bassSilence = 30, midSilence = 20, highSilence = 25;
int bassMax = 200000, midMax = 300000, highMax = 250000;
int noiseFloor = 15;  // Values below this are zeroed

// ═══════════════════════════════════════════════════════════════
// DMX CONFIG (simple HardwareSerial method - works!)
// ═══════════════════════════════════════════════════════════════
HardwareSerial DMX(1);
#define DMX_TX 17
#define DMX_EN 4
#define CHANNELS 100
#define DMX_PACKET_SIZE 513

uint8_t dmx[DMX_PACKET_SIZE];

inline void driverEnable(bool on) {
  digitalWrite(DMX_EN, on ? HIGH : LOW);
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
// MAIN LOOP
// ═══════════════════════════════════════════════════════════════
void loop() {
  // ─────────────────────────────────────────────────────────────
  // 1. FFT MIC SAMPLING
  // ─────────────────────────────────────────────────────────────
  unsigned long t = micros();
  for (int i = 0; i < SAMPLES; i++) {
    vReal[i] = analogRead(MIC_PIN) - 2048;
    vImag[i] = 0;
    while (micros() - t < 125) {}
    t += 125;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. FFT COMPUTE
  // ─────────────────────────────────────────────────────────────
  FFT.windowing(FFT_WIN_TYP_HAMMING, FFT_FORWARD);
  FFT.compute(FFT_FORWARD);
  FFT.complexToMagnitude();

  // ─────────────────────────────────────────────────────────────
  // 3. FREQUENCY BAND SUMS
  // ─────────────────────────────────────────────────────────────
  float bass = 0, mid = 0, high = 0;
  for (int i = 3; i < SAMPLES / 2; i++) {
    if (i <= 25) bass += vReal[i];
    else if (i <= 80) mid += vReal[i];
    else if (i <= 160) high += vReal[i];
  }

  // ─────────────────────────────────────────────────────────────
  // 4. NORMALIZE TO 0-100
  // ─────────────────────────────────────────────────────────────
  int bassLevel = constrain(map(bass, bassSilence * 5000, bassMax, 0, 100), 0, 100);
  int midLevel = constrain(map(mid, midSilence * 2000, midMax, 0, 100), 0, 100);
  int highLevel = constrain(map(high, highSilence * 2000, highMax, 0, 100), 0, 100);

  if (bassLevel < noiseFloor) bassLevel = 0;
  if (midLevel < noiseFloor) midLevel = 0;
  if (highLevel < noiseFloor) highLevel = 0;

  // ─────────────────────────────────────────────────────────────
  // 5. SEND AUDIO JSON
  // ─────────────────────────────────────────────────────────────
  Serial.printf("{\"bass\":%d,\"mid\":%d,\"high\":%d}\n", bassLevel, midLevel, highLevel);

  // ─────────────────────────────────────────────────────────────
  // 6. RECEIVE DMX VALUES OR CONFIG FROM WEB
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

    // Debug: print first 10 channels received
    Serial.printf("{\"debug\":\"DMX RX\",\"ch1\":%d,\"ch2\":%d,\"ch3\":%d,\"ch4\":%d,\"ch5\":%d,\"ch6\":%d,\"ch7\":%d,\"ch8\":%d,\"ch9\":%d,\"ch10\":%d}\n",
      dmx[1], dmx[2], dmx[3], dmx[4], dmx[5], dmx[6], dmx[7], dmx[8], dmx[9], dmx[10]);
  }

  // ─────────────────────────────────────────────────────────────
  // 7. OUTPUT DMX
  // ─────────────────────────────────────────────────────────────
  sendDMX();
}
