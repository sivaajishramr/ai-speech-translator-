/*
 * ═══════════════════════════════════════════════════
 *  ESP32 BLE Button — AI Speech Translator Trigger
 * ═══════════════════════════════════════════════════
 *
 * This firmware turns ESP32 into a simple BLE button.
 * The mobile web app connects to it via Web Bluetooth.
 *
 * Wiring:
 *   GPIO 4  → Record button (to GND, uses internal pull-up)
 *   GPIO 5  → Replay button (to GND, uses internal pull-up)
 *   GPIO 16 → Previous Translation button (to GND, uses internal pull-up)
 *   GPIO 2  → LED (built-in on most boards)
 *
 * BLE Service:  19B10000-E8F2-537E-4F6C-D104768A1214
 *   ├─ Button Characteristic (Notify/Read):
 *   │    19B10001-E8F2-537E-4F6C-D104768A1214
 *   │    Value: 0x01 = pressed, 0x00 = released
 *   ├─ LED Characteristic (Write):
 *   │    19B10002-E8F2-537E-4F6C-D104768A1214
 *   │    Value: 0x01 = ON, 0x00 = OFF
 *   ├─ Replay Characteristic (Notify/Read):
 *   │    19B10003-E8F2-537E-4F6C-D104768A1214
 *   │    Value: 0x01 = replay pressed
 *   └─ Previous Characteristic (Notify/Read):
 *        19B10004-E8F2-537E-4F6C-D104768A1214
 *        Value: 0x01 = previous pressed
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ── Pin Definitions ─────────────────────────────
#define BUTTON_PIN    4
#define REPLAY_PIN    5
#define PREV_PIN      16
#define LED_PIN       2

// ── BLE UUIDs ───────────────────────────────────
#define SERVICE_UUID           "19B10000-E8F2-537E-4F6C-D104768A1214"
#define BUTTON_CHAR_UUID       "19B10001-E8F2-537E-4F6C-D104768A1214"
#define LED_CHAR_UUID          "19B10002-E8F2-537E-4F6C-D104768A1214"
#define REPLAY_CHAR_UUID       "19B10003-E8F2-537E-4F6C-D104768A1214"
#define PREV_CHAR_UUID         "19B10004-E8F2-537E-4F6C-D104768A1214"

// ── Globals ─────────────────────────────────────
BLEServer         *pServer        = nullptr;
BLECharacteristic *pButtonChar    = nullptr;
BLECharacteristic *pLedChar       = nullptr;
BLECharacteristic *pReplayChar    = nullptr;
BLECharacteristic *pPrevChar      = nullptr;
bool               deviceConnected = false;
bool               oldConnected    = false;
bool               lastButtonState = HIGH;   // Pull-up: HIGH = not pressed
bool               lastReplayState = HIGH;   // Pull-up: HIGH = not pressed
bool               lastPrevState   = HIGH;   // Pull-up: HIGH = not pressed

// ── Connection callbacks ────────────────────────
class MyServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        deviceConnected = true;
        Serial.println("✓ Phone connected!");
        // Quick LED flash to confirm
        for (int i = 0; i < 3; i++) {
            digitalWrite(LED_PIN, HIGH);
            delay(100);
            digitalWrite(LED_PIN, LOW);
            delay(100);
        }
    }

    void onDisconnect(BLEServer* pServer) {
        deviceConnected = false;
        Serial.println("✗ Phone disconnected");
        digitalWrite(LED_PIN, LOW);
    }
};

// ── LED write callback ──────────────────────────
class LedCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        uint8_t *data = pCharacteristic->getData();
        size_t len = pCharacteristic->getLength();
        if (len > 0) {
            if (data[0] == 0x01) {
                digitalWrite(LED_PIN, HIGH);
                Serial.println("LED → ON");
            } else {
                digitalWrite(LED_PIN, LOW);
                Serial.println("LED → OFF");
            }
        }
    }
};

// ── Setup ───────────────────────────────────────
void setup() {
    Serial.begin(115200);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    pinMode(REPLAY_PIN, INPUT_PULLUP);
    pinMode(PREV_PIN, INPUT_PULLUP);
    pinMode(LED_PIN, OUTPUT);

    // Startup blink
    Serial.println();
    Serial.println("╔══════════════════════════════════════╗");
    Serial.println("║  ESP32 BLE Button — Translator       ║");
    Serial.println("╚══════════════════════════════════════╝");
    Serial.println();

    digitalWrite(LED_PIN, HIGH);
    delay(500);
    digitalWrite(LED_PIN, LOW);

    // Initialize BLE
    Serial.println("Starting BLE...");
    BLEDevice::init("TranslatorBtn");

    // Create BLE Server
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());

    // Create BLE Service
    BLEService *pService = pServer->createService(SERVICE_UUID);

    // Button Characteristic — Notify + Read
    pButtonChar = pService->createCharacteristic(
        BUTTON_CHAR_UUID,
        BLECharacteristic::PROPERTY_READ |
        BLECharacteristic::PROPERTY_NOTIFY
    );
    pButtonChar->addDescriptor(new BLE2902());
    uint8_t initVal = 0;
    pButtonChar->setValue(&initVal, 1);

    // LED Characteristic — Write
    pLedChar = pService->createCharacteristic(
        LED_CHAR_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );
    pLedChar->setCallbacks(new LedCallbacks());

    // Replay Characteristic — Notify + Read
    pReplayChar = pService->createCharacteristic(
        REPLAY_CHAR_UUID,
        BLECharacteristic::PROPERTY_READ |
        BLECharacteristic::PROPERTY_NOTIFY
    );
    pReplayChar->addDescriptor(new BLE2902());
    uint8_t initReplay = 0;
    pReplayChar->setValue(&initReplay, 1);

    // Previous Characteristic — Notify + Read
    pPrevChar = pService->createCharacteristic(
        PREV_CHAR_UUID,
        BLECharacteristic::PROPERTY_READ |
        BLECharacteristic::PROPERTY_NOTIFY
    );
    pPrevChar->addDescriptor(new BLE2902());
    uint8_t initPrev = 0;
    pPrevChar->setValue(&initPrev, 1);

    // Start service
    pService->start();

    // Start advertising
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);  // For iPhone compatibility
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();

    Serial.println("✓ BLE ready! Advertising as 'TranslatorBtn'");
    Serial.println("─────────────────────────────────────");
    Serial.println("Open the web app on your phone and connect.");
    Serial.println();
}

// ── Loop ────────────────────────────────────────
void loop() {
    // ── Record Button (GPIO 4) ──────────────────
    bool buttonState = digitalRead(BUTTON_PIN);

    if (buttonState != lastButtonState) {
        delay(30);  // Simple debounce
        buttonState = digitalRead(BUTTON_PIN);

        if (buttonState != lastButtonState) {
            lastButtonState = buttonState;

            if (deviceConnected) {
                uint8_t val = (buttonState == LOW) ? 0x01 : 0x00;
                pButtonChar->setValue(&val, 1);
                pButtonChar->notify();

                if (val == 0x01) {
                    Serial.println("🔴 Record PRESSED → Recording...");
                    digitalWrite(LED_PIN, HIGH);
                } else {
                    Serial.println("⏹  Record RELEASED → Processing...");
                }
            } else {
                if (buttonState == LOW) {
                    Serial.println("⚠ Button pressed but no phone connected!");
                    for (int i = 0; i < 5; i++) {
                        digitalWrite(LED_PIN, HIGH);
                        delay(50);
                        digitalWrite(LED_PIN, LOW);
                        delay(50);
                    }
                }
            }
        }
    }

    // ── Replay Button (GPIO 5) ─────────────────
    bool replayState = digitalRead(REPLAY_PIN);

    if (replayState != lastReplayState) {
        delay(30);  // Simple debounce
        replayState = digitalRead(REPLAY_PIN);

        if (replayState != lastReplayState) {
            lastReplayState = replayState;

            if (deviceConnected && replayState == LOW) {
                // Send replay signal (single press, not hold)
                uint8_t val = 0x01;
                pReplayChar->setValue(&val, 1);
                pReplayChar->notify();
                Serial.println("🔁 Replay PRESSED → Replaying last translation");

                // Quick LED flash to acknowledge
                digitalWrite(LED_PIN, HIGH);
                delay(150);
                digitalWrite(LED_PIN, LOW);
            } else if (!deviceConnected && replayState == LOW) {
                Serial.println("⚠ Replay pressed but no phone connected!");
                for (int i = 0; i < 3; i++) {
                    digitalWrite(LED_PIN, HIGH);
                    delay(50);
                    digitalWrite(LED_PIN, LOW);
                    delay(50);
                }
            }
        }
    }

    // ── Previous Button (GPIO 16) ──────────────────
    bool prevState = digitalRead(PREV_PIN);

    if (prevState != lastPrevState) {
        delay(30);  // Simple debounce
        prevState = digitalRead(PREV_PIN);

        if (prevState != lastPrevState) {
            lastPrevState = prevState;

            if (deviceConnected && prevState == LOW) {
                // Send previous signal (single press)
                uint8_t val = 0x01;
                pPrevChar->setValue(&val, 1);
                pPrevChar->notify();
                Serial.println("⏮  Previous PRESSED → Playing previous translation");

                // Double LED flash to acknowledge
                for (int i = 0; i < 2; i++) {
                    digitalWrite(LED_PIN, HIGH);
                    delay(100);
                    digitalWrite(LED_PIN, LOW);
                    delay(100);
                }
            } else if (!deviceConnected && prevState == LOW) {
                Serial.println("⚠ Previous pressed but no phone connected!");
                for (int i = 0; i < 3; i++) {
                    digitalWrite(LED_PIN, HIGH);
                    delay(50);
                    digitalWrite(LED_PIN, LOW);
                    delay(50);
                }
            }
        }
    }

    // Handle reconnection — restart advertising
    if (!deviceConnected && oldConnected) {
        delay(500);
        pServer->startAdvertising();
        Serial.println("Restarted advertising...");
        oldConnected = false;
    }
    if (deviceConnected && !oldConnected) {
        oldConnected = true;
    }

    delay(10);  // Small delay to prevent WDT reset
}
