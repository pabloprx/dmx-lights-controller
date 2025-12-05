/*
 * DMX Beat Controller
 *
 * Receives beat data from Web Serial API
 * Protocol:
 *   B<beatInBar>,<tempo>\n  -> Beat trigger (e.g., "B1,128.5\n")
 *   D<channel>,<value>\n    -> DMX value (e.g., "D1,255\n")
 *
 * LEDs on pins 2,3,4,5 for beats 1,2,3,4
 */

#define SERIAL_BAUD 115200
#define FLASH_DURATION 80  // ms

// LED pins for each beat (beat 1 = pin 2, beat 2 = pin 3, etc.)
const int LED_PINS[4] = {2, 3, 4, 5};

String inputBuffer = "";
unsigned long ledOffTime[4] = {0, 0, 0, 0};
bool ledOn[4] = {false, false, false, false};

void setup() {
  Serial.begin(SERIAL_BAUD);

  for (int i = 0; i < 4; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }

  Serial.println("DMX Beat Controller Ready");
  Serial.println("LEDs: pin2=beat1, pin3=beat2, pin4=beat3, pin5=beat4");
}

void loop() {
  // Read serial data
  while (Serial.available() > 0) {
    char c = Serial.read();

    if (c == '\n') {
      processCommand(inputBuffer);
      inputBuffer = "";
    } else if (c != '\r') {
      inputBuffer += c;
    }
  }

  // Turn off LEDs after flash duration
  unsigned long now = millis();
  for (int i = 0; i < 4; i++) {
    if (ledOn[i] && now >= ledOffTime[i]) {
      digitalWrite(LED_PINS[i], LOW);
      ledOn[i] = false;
    }
  }
}

void processCommand(String cmd) {
  if (cmd.length() < 2) return;

  char type = cmd.charAt(0);
  String data = cmd.substring(1);

  switch (type) {
    case 'B':
      handleBeat(data);
      break;
    case 'D':
      handleDMX(data);
      break;
  }
}

void handleBeat(String data) {
  int commaIndex = data.indexOf(',');
  if (commaIndex < 0) return;

  int beatInBar = data.substring(0, commaIndex).toInt();
  float tempo = data.substring(commaIndex + 1).toFloat();

  // beatInBar is 1-4, array index is 0-3
  if (beatInBar >= 1 && beatInBar <= 4) {
    int idx = beatInBar - 1;

    // Turn off all LEDs first
    for (int i = 0; i < 4; i++) {
      digitalWrite(LED_PINS[i], LOW);
      ledOn[i] = false;
    }

    // Turn on the current beat LED
    digitalWrite(LED_PINS[idx], HIGH);
    ledOn[idx] = true;
    ledOffTime[idx] = millis() + FLASH_DURATION;
  }

  Serial.print("BEAT ");
  Serial.print(beatInBar);
  Serial.print("/4 @ ");
  Serial.print(tempo, 1);
  Serial.println(" BPM");
}

void handleDMX(String data) {
  int commaIndex = data.indexOf(',');
  if (commaIndex < 0) return;

  int channel = data.substring(0, commaIndex).toInt();
  int value = data.substring(commaIndex + 1).toInt();

  Serial.print("DMX CH");
  Serial.print(channel);
  Serial.print(" = ");
  Serial.println(value);
}
