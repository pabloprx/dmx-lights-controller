// DMX Controller - Output Only
// Receives CSV values from Web Serial, outputs to DMX fixtures
//
// Serial Protocol:
// - RECV: ch1,ch2,ch3,...,ch16\n  (CSV DMX values 0-255)
//
// Hardware:
// - DMX_TX 17: RS485 TX to DMX fixtures
// - DMX_EN 4: RS485 enable pin

#pragma GCC optimize ("-O3")
#pragma GCC optimize ("-fno-inline-small-functions")

#include <Arduino.h>

HardwareSerial DMX(1);

#define DMX_TX 17
#define DMX_EN 4
#define CHANNELS 16

uint8_t dmx[CHANNELS + 1];

void setup() {
  Serial.begin(115200);

  pinMode(DMX_EN, OUTPUT);
  digitalWrite(DMX_EN, HIGH);

  dmx[0] = 0;  // Start code
  for (int i = 1; i <= CHANNELS; i++) dmx[i] = 0;

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
  // Receive DMX values from Web Serial
  // Format: "120,255,0,0,..." (16 channels CSV)
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');

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

  sendDMX();
  delay(20);  // ~50Hz DMX refresh
}
