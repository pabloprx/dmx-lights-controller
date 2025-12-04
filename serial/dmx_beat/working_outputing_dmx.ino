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

  dmx[0] = 0;
  for (int i = 1; i <= CHANNELS; i++) dmx[i] = 0;

  DMX.begin(250000, SERIAL_8N2, -1, DMX_TX);
}

// -----------------------
void sendDMX() {
  DMX.end();
  pinMode(DMX_TX, OUTPUT);
  digitalWrite(DMX_TX, LOW);
  delayMicroseconds(120);

  digitalWrite(DMX_TX, HIGH);
  delayMicroseconds(12); // reducing delays?

  DMX.begin(250000, SERIAL_8N2, -1, DMX_TX);

  DMX.write(dmx[0]);
  DMX.write(&dmx[1], CHANNELS);
  DMX.flush();
}
// -----------------------

void loop() {
  // SERIAL RECEIVE FORMAT: "120,255,0,0,..." 
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    
    int commaIndex = 0;
    for (int ch = 1; ch <= CHANNELS; ch++) {
      int nextComma = line.indexOf(',', commaIndex);
      if (nextComma == -1) nextComma = line.length();

      int value = line.substring(commaIndex, nextComma).toInt();
      dmx[ch] = constrain(value, 0, 255);

      commaIndex = nextComma + 1;
    }
  }

  sendDMX();
  delay(20);
}
