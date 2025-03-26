#include <Servo.h>

// Sensor Pins Configuration
const int trigPins[3] = {2, 4, 6};    // Ultrasonic Trig pins
const int echoPins[3] = {3, 5, 7};    // Ultrasonic Echo pins
const int entryIR = 11;                // Entry gate IR sensor
const int exitIR = 12;                 // Exit gate IR sensor
const int servoPin = 8;                // Servo control pin

Servo gateServo;
int availableSlots = 3;
unsigned long lastTrigger = 0;

void setup() {
  Serial.begin(115200);
  
  // Initialize sensors
  pinMode(entryIR, INPUT);
  pinMode(exitIR, INPUT);
  
  // Initialize ultrasonic sensors
  for(int i=0; i<3; i++){
    pinMode(trigPins[i], OUTPUT);
    pinMode(echoPins[i], INPUT);
  }
  
  // Attach servo and close gate
  gateServo.attach(servoPin);
  gateServo.write(0); // Initial position: closed
  
  Serial.println("System Initialized!");
  Serial.println("-------------------");
}

void loop() {
  checkEntryExit();
  monitorParkingSlots();
  printSystemStatus();
  delay(100);
}

void checkEntryExit() {
  if(digitalRead(entryIR) == LOW && (millis() - lastTrigger > 2000)) {
    Serial.println("Entry triggered!");
    openGate();
    availableSlots--;
    lastTrigger = millis();
  }
  
  if(digitalRead(exitIR) == LOW && (millis() - lastTrigger > 2000)) {
    Serial.println("Exit triggered!");
    openGate();
    availableSlots++;
    lastTrigger = millis();
  }
}

void openGate() {
  Serial.println("Opening gate...");
  gateServo.write(90);  // Open gate
  delay(3000);          // Keep open for 3 seconds
  gateServo.write(0);   // Close gate
  Serial.println("Gate closed");
}

bool isCarPresent(int sensorIndex) {
  digitalWrite(trigPins[sensorIndex], LOW);
  delayMicroseconds(2);
  digitalWrite(trigPins[sensorIndex], HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPins[sensorIndex], LOW);
  
  long duration = pulseIn(echoPins[sensorIndex], HIGH);
  float distance = duration * 0.0343 / 2;
  
  return (distance < 20); // Car present if <20cm
}

void monitorParkingSlots() {
  int occupied = 0;
  for(int i=0; i<3; i++){
    if(isCarPresent(i)) occupied++;
  }
  availableSlots = 3 - occupied;
}

void printSystemStatus() {
  Serial.println("Current Status:");
  Serial.print("Available Slots: ");
  Serial.println(availableSlots);
  
  // Show individual slot status
  for(int i=0; i<3; i++){
    Serial.print("Slot ");
    Serial.print(i+1);
    Serial.print(": ");
    Serial.println(isCarPresent(i) ? "Occupied" : "Free");
  }
  
  Serial.print("Entry Gate: ");
  Serial.println(digitalRead(entryIR) == LOW ? "Triggered" : "Ready");
  
  Serial.print("Exit Gate: ");
  Serial.println(digitalRead(exitIR) == LOW ? "Triggered" : "Ready");
  
  Serial.println("-------------------");
} 