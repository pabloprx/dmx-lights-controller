#pragma GCC optimize ("-O3")
#pragma GCC optimize ("-fno-inline-small-functions")

#include <arduinoFFT.h>

#define SAMPLES 512
#define SAMPLING_FREQ 8000
#define MIC_PIN 34

double vReal[SAMPLES];
double vImag[SAMPLES];
ArduinoFFT<double> FFT = ArduinoFFT<double>(vReal, vImag, SAMPLES, SAMPLING_FREQ);

// Dynamic scaling variables
int bassSilence = 30, midSilence = 20, highSilence = 25;
int bassMax = 200000, midMax = 300000, highMax = 250000;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
}

void loop() {
  unsigned long t = micros();
  for (int i = 0; i < SAMPLES; i++) {
    vReal[i] = analogRead(MIC_PIN) - 2048;
    vImag[i] = 0;
    while(micros() - t < 125) {}
    t += 125;
  }

  FFT.windowing(FFT_WIN_TYP_HAMMING, FFT_FORWARD);
  FFT.compute(FFT_FORWARD);
  FFT.complexToMagnitude();

  float bass = 0, mid = 0, high = 0;
  
  for (int i = 3; i < SAMPLES/2; i++) {
    if (i <= 25) bass += vReal[i];
    else if (i <= 80) mid += vReal[i];
    else if (i <= 160) high += vReal[i];
  }

  // Dynamic scaling based on silence levels
  int bassLevel = constrain(map(bass, bassSilence*5000, bassMax, 0, 100), 0, 100);
  int midLevel = constrain(map(mid, midSilence*2000, midMax, 0, 100), 0, 100);
  int highLevel = constrain(map(high, highSilence*2000, highMax, 0, 100), 0, 100);

  // Apply threshold - if below silence level, set to 0
  if (bassLevel < 15) bassLevel = 0;
  if (midLevel < 15) midLevel = 0;
  if (highLevel < 15) highLevel = 0;

  Serial.printf("{\"bass\":%d,\"mid\":%d,\"high\":%d}\n", bassLevel, midLevel, highLevel);
}