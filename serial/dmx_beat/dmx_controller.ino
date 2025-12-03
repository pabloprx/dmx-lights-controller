// DMX Controller with Audio FFT
// Combined: FFT mic input + DMX output on single ESP32
//
// Serial Protocol:
// - SEND: {"bass":N,"mid":N,"high":N}\n  (every ~60ms)
// - RECV: ch1,ch2,ch3,...,ch16\n         (CSV DMX values)
//
// Hardware:
// - MIC_PIN 34: MAX4466 electret microphone
// - DMX_TX 17: RS485 TX to DMX fixtures
// - DMX_EN 4: RS485 enable pin

#pragma GCC optimize ("-O3")

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

// Audio thresholds (auto-calibrated in future version)
int bassSilence = 30, midSilence = 20, highSilence = 25;
int bassMax = 200000, midMax = 300000, highMax = 250000;

// ═══════════════════════════════════════════════════════════════
// DMX CONFIG
// ═══════════════════════════════════════════════════════════════
HardwareSerial DMX(1);
#define DMX_TX 17
#define DMX_EN 4
#define CHANNELS 16

uint8_t dmx[CHANNELS + 1];

// ═══════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);

  // ADC for mic
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // DMX output
  pinMode(DMX_EN, OUTPUT);
  digitalWrite(DMX_EN, HIGH);

  dmx[0] = 0;  // Start code
  for (int i = 1; i <= CHANNELS; i++) {
    dmx[i] = 0;
  }

  DMX.begin(250000, SERIAL_8N2, -1, DMX_TX);
}

// ═══════════════════════════════════════════════════════════════
// DMX OUTPUT
// ═══════════════════════════════════════════════════════════════
void sendDMX() {
  // Break
  DMX.end();
  pinMode(DMX_TX, OUTPUT);
  digitalWrite(DMX_TX, LOW);
  delayMicroseconds(120);

  // Mark After Break
  digitalWrite(DMX_TX, HIGH);
  delayMicroseconds(12);

  // Data
  DMX.begin(250000, SERIAL_8N2, -1, DMX_TX);
  DMX.write(dmx[0]);
  DMX.write(&dmx[1], CHANNELS);
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
    vReal[i] = analogRead(MIC_PIN) - 2048;  // Center around 0
    vImag[i] = 0;
    while (micros() - t < 125) {}  // 8kHz sampling
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
    if (i <= 25) bass += vReal[i];       // ~20-200Hz
    else if (i <= 80) mid += vReal[i];   // ~200-650Hz
    else if (i <= 160) high += vReal[i]; // ~650-1300Hz
  }

  // ─────────────────────────────────────────────────────────────
  // 4. NORMALIZE TO 0-100
  // ─────────────────────────────────────────────────────────────
  int bassLevel = constrain(map(bass, bassSilence * 5000, bassMax, 0, 100), 0, 100);
  int midLevel = constrain(map(mid, midSilence * 2000, midMax, 0, 100), 0, 100);
  int highLevel = constrain(map(high, highSilence * 2000, highMax, 0, 100), 0, 100);

  // Apply noise floor
  if (bassLevel < 15) bassLevel = 0;
  if (midLevel < 15) midLevel = 0;
  if (highLevel < 15) highLevel = 0;

  // ─────────────────────────────────────────────────────────────
  // 5. SEND AUDIO JSON
  // ─────────────────────────────────────────────────────────────
  Serial.printf("{\"bass\":%d,\"mid\":%d,\"high\":%d}\n", bassLevel, midLevel, highLevel);

  // ─────────────────────────────────────────────────────────────
  // 6. RECEIVE DMX VALUES FROM WEB
  // ─────────────────────────────────────────────────────────────
  while (Serial.available()) {
    String line = Serial.readStringUntil('\n');

    // Skip if it's JSON (echo or other data)
    if (line.length() > 0 && line[0] != '{') {
      // Parse CSV: "255,128,0,0,255,..."
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
  }

  // ─────────────────────────────────────────────────────────────
  // 7. OUTPUT DMX
  // ─────────────────────────────────────────────────────────────
  sendDMX();
}
