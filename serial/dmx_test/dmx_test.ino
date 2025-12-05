// DMX Output Test - Fixed timing and DE/RE handling
//
// Wiring for OUTPUT:
// - DI → GPIO17
// - DE + RE → GPIO4 (bridged together)
// - RO → not connected
// - A → XLR pin 3 (D+)  -- TRY SWAPPING A/B IF NOT WORKING
// - B → XLR pin 2 (D-)
// - VCC → 5V, GND → GND

HardwareSerial DMX(1);
#define DMX_TX 17
#define DMX_EN 4
#define DMX_PACKET_SIZE 513

uint8_t dmx[DMX_PACKET_SIZE];
unsigned long frameCount = 0;

// Helper for RS485 direction control
inline void driverEnable(bool on) {
  digitalWrite(DMX_EN, on ? HIGH : LOW);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("================================");
  Serial.println("   DMX OUTPUT TEST (Fixed)");
  Serial.println("================================");
  Serial.println("Fixes: DE timing, start-code, break/MAB");
  Serial.println("");
  Serial.println("If not working, TRY SWAPPING A/B wires!");
  Serial.println("");
  Serial.println("Send CSV to change values, e.g.:");
  Serial.println("  64,100,0,0,0,128,128,200,0,255");
  Serial.println("  255,0,0,0,0,0,0,0,0,0  (try 255 in CH1)");
  Serial.println("================================\n");

  // DMX output setup
  pinMode(DMX_EN, OUTPUT);
  driverEnable(false);  // Start with driver disabled

  // Clear entire buffer including start code
  memset(dmx, 0, DMX_PACKET_SIZE);
  dmx[0] = 0;  // Start code MUST be 0

  DMX.begin(250000, SERIAL_8N2, -1, DMX_TX);

  // Set initial laser values (Manual mode)
  dmx[1] = 64;    // CH1: Mode (64 = Manual)
  dmx[2] = 100;   // CH2: Pattern
  dmx[3] = 0;     // CH3: Rot X
  dmx[4] = 0;     // CH4: Rot Y
  dmx[5] = 0;     // CH5: H movement
  dmx[6] = 128;   // CH6: H position
  dmx[7] = 128;   // CH7: V position
  dmx[8] = 200;   // CH8: Size
  dmx[9] = 0;     // CH9: Color
  dmx[10] = 255;  // CH10: Dots

  printDMX();
  Serial.println(">> Sending DMX now! Laser should turn ON!");
}

void sendDMX() {
  // Start with driver DISABLED (idle state)
  driverEnable(false);
  delayMicroseconds(10);

  // Disable UART so we can bit-bang the break
  DMX.end();
  pinMode(DMX_TX, OUTPUT);

  // NOW enable driver - fixture sees transition from idle to driven
  driverEnable(true);

  // BREAK - 92µs
  digitalWrite(DMX_TX, LOW);
  delayMicroseconds(92);

  // MAB - 12µs
  digitalWrite(DMX_TX, HIGH);
  delayMicroseconds(12);

  // Send data
  DMX.begin(250000, SERIAL_8N2, -1, DMX_TX);
  dmx[0] = 0;
  DMX.write(dmx, DMX_PACKET_SIZE);
  DMX.flush();

  // Keep driver enabled until next frame starts

  frameCount++;
  if (frameCount % 100 == 0) {
    Serial.printf("[TX] Frame %lu | CH1-5: %d,%d,%d,%d,%d\n",
      frameCount, dmx[1], dmx[2], dmx[3], dmx[4], dmx[5]);
  }
}

void printDMX() {
  Serial.println("\n--- Current DMX Values ---");
  Serial.printf("CH1  Mode:    %3d  ", dmx[1]);
  if (dmx[1] < 64) Serial.println("(OFF)");
  else if (dmx[1] < 128) Serial.println("(MANUAL)");
  else if (dmx[1] < 192) Serial.println("(AUTO)");
  else Serial.println("(SOUND)");
  Serial.printf("CH2  Pattern: %3d\n", dmx[2]);
  Serial.printf("CH3  RotX:    %3d\n", dmx[3]);
  Serial.printf("CH4  RotY:    %3d\n", dmx[4]);
  Serial.printf("CH5  HMove:   %3d\n", dmx[5]);
  Serial.printf("CH6  HPos:    %3d\n", dmx[6]);
  Serial.printf("CH7  VPos:    %3d\n", dmx[7]);
  Serial.printf("CH8  Size:    %3d\n", dmx[8]);
  Serial.printf("CH9  Color:   %3d\n", dmx[9]);
  Serial.printf("CH10 Dots:    %3d\n", dmx[10]);
  Serial.println("---------------------------\n");
}

void loop() {
  // Check for serial input
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();

    if (line.length() > 0) {
      Serial.printf(">> Received: %s\n", line.c_str());

      // Parse CSV
      int commaIndex = 0;
      for (int ch = 1; ch <= 16; ch++) {
        int nextComma = line.indexOf(',', commaIndex);
        if (nextComma == -1) nextComma = line.length();

        if (commaIndex < line.length()) {
          int value = line.substring(commaIndex, nextComma).toInt();
          dmx[ch] = constrain(value, 0, 255);
        }

        commaIndex = nextComma + 1;
        if (commaIndex >= line.length()) break;
      }

      printDMX();
    }
  }

  // Send DMX continuously
  sendDMX();
  delay(25);  // ~40fps
}
