// DMX Input Reader - Read DMX from external controller
// Set CH1=81, CH2=82 on your controller to spot your packets!

HardwareSerial DMX(2);
#define DMX_RX 16
#define DMX_TX 17
#define DMX_EN 4

#define DMX_BUFFER_SIZE 513
uint8_t dmxData[DMX_BUFFER_SIZE];
int dmxChannel = 0;
unsigned long lastByteTime = 0;
unsigned long packetCount = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("================================");
  Serial.println("   DMX INPUT READER");
  Serial.println("================================");
  Serial.println("Set CH1=81, CH2=82 on controller");
  Serial.println("to spot your packets!");
  Serial.println("================================\n");

  pinMode(DMX_EN, OUTPUT);
  digitalWrite(DMX_EN, LOW);  // Receive mode

  DMX.begin(250000, SERIAL_8N2, DMX_RX, DMX_TX);
  memset(dmxData, 0, DMX_BUFFER_SIZE);

  Serial.println("Waiting for DMX...");
}

void printChannels() {
  bool isOurs = (dmxData[1] == 81 && dmxData[2] == 82);

  Serial.println("\n========== DMX PACKET RECEIVED ==========");
  if (isOurs) {
    Serial.println("★★★ THIS IS YOUR PACKET (81,82) ★★★");
  }
  Serial.printf("Packet #%lu | Channels received: %d\n", packetCount, dmxChannel);

  // Print first 16 channels
  Serial.println("\nCH   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16");
  Serial.print("    ");
  for (int i = 1; i <= 16; i++) {
    Serial.printf("%3d ", dmxData[i]);
  }
  Serial.println("");

  // CSV
  Serial.print("\nCSV: ");
  for (int i = 1; i <= 16; i++) {
    Serial.print(dmxData[i]);
    if (i < 16) Serial.print(",");
  }
  Serial.println("");

  // Non-zero channels
  Serial.print("\nNon-zero: ");
  bool found = false;
  for (int i = 1; i <= 100; i++) {
    if (dmxData[i] > 0) {
      Serial.printf("CH%d=%d ", i, dmxData[i]);
      found = true;
    }
  }
  if (!found) Serial.print("(all zeros)");

  if (isOurs) {
    Serial.println("\n★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★");
  }
  Serial.println("\n==========================================\n");
}

void loop() {
  while (DMX.available()) {
    uint8_t b = DMX.read();
    unsigned long now = micros();

    // Gap > 100µs = new packet
    if (now - lastByteTime > 100 && dmxChannel > 0) {
      packetCount++;

      bool isOurs = (dmxData[1] == 81 && dmxData[2] == 82);

      // Print if matches filter OR every 50th packet
      if (isOurs || packetCount % 50 == 1) {
        printChannels();
      }

      dmxChannel = 0;
      memset(dmxData, 0, DMX_BUFFER_SIZE);
    }

    lastByteTime = now;

    if (dmxChannel < DMX_BUFFER_SIZE) {
      dmxData[dmxChannel++] = b;
    }
  }

  // Status every 5 seconds
  static unsigned long lastStatus = 0;
  if (millis() - lastStatus > 5000) {
    lastStatus = millis();
    if (packetCount == 0) {
      Serial.println("Still waiting for DMX signal...");
    } else {
      Serial.printf("Received %lu packets so far\n", packetCount);
    }
  }

  delay(1);
}
