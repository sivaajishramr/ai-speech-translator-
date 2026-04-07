# 🌐 AI Speech Translator v2.0

**ESP32 BLE Button + Android Mobile Web App**

Speak in any language → hear the translation through your earbuds!

## Architecture

```
┌─────────────┐     BLE      ┌──────────────────┐    HTTPS    ┌──────────────┐
│   ESP32     │ ──────────── │  Android Phone   │ ────────── │  PC Server   │
│  (Button)   │  press/rel   │  (Chrome PWA)    │            │  (Python)    │
│             │              │                  │            │              │
│  GPIO 4 btn │──→ record    │  • Records mic   │  /translate│  • Whisper   │
│  GPIO 2 led │←── feedback  │  • Sends audio   │──────────→ │  • Translate │
│             │              │  • Plays result  │  MP3 back  │  • gTTS      │
└─────────────┘              │  • BT earbuds ♫  │ ←──────────│              │
                             └──────────────────┘            └──────────────┘
```

## What You Need

| Item | Purpose |
|------|---------|
| ESP32 board | BLE button (GPIO 4 = button, GPIO 2 = LED) |
| Android phone | Runs the web app in Chrome |
| Bluetooth earbuds | Paired to your phone (normal pairing) |
| PC/Laptop | Runs the Python AI server |
| Same WiFi | Phone and PC must be on same network |

## Quick Start

### 1. ESP32 Firmware

1. Open `esp32/ble_button/ble_button.ino` in Arduino IDE
2. Install ESP32 board support (if not already)
3. Upload to your ESP32
4. Serial monitor should show: `BLE ready! Advertising as 'TranslatorBtn'`

**Wiring:**
- GPIO 4 → Push button → GND
- GPIO 2 → Built-in LED (most boards have this)

### 2. Python Server (on your PC)

```bash
cd server

# Install dependencies
pip install -r requirements.txt
pip install cryptography   # For auto SSL certificate

# Run the server
python server.py
```

The server will:
- Load the Whisper AI model
- Generate a self-signed SSL certificate
- Show your PC's IP address
- Start on port 5000

### 3. Mobile Web App (on your Android phone)

1. **Pair your earbuds** to your phone normally (Bluetooth settings)
2. Open **Chrome** on your Android phone
3. Go to: `https://YOUR_PC_IP:5000` (shown in server output)
4. Accept the certificate warning ("Advanced" → "Proceed")
5. Allow microphone access when prompted
6. Click **"Connect"** to pair with ESP32 BLE

### 4. Use It!

1. Press & hold the **ESP32 button** (or virtual button on screen)
2. **Speak** in your source language
3. **Release** the button
4. Wait for translation
5. **Hear** the translated speech through your earbuds! 🎧

## Features

- 🌍 **100+ languages** — translate between any supported pair
- 🔵 **BLE button** — ESP32 hardware trigger
- 📱 **Virtual button** — hold-to-talk on phone screen
- 🎧 **Earbuds playback** — uses your phone's Bluetooth audio
- 📜 **Translation history** — tap to replay any translation
- ⚙️ **Configurable** — change server URL, languages
- 📲 **Installable PWA** — add to home screen

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Bluetooth not supported" | Use Chrome browser (not Firefox/Safari) |
| Certificate warning | Click "Advanced" → "Proceed" in Chrome |
| ESP32 not found | Check ESP32 is powered on and advertising |
| No audio playback | Make sure earbuds are paired to the phone |
| Server connection failed | Check PC and phone are on same WiFi |
| Mic not working | Allow microphone permission in Chrome |

## Tech Stack

- **ESP32**: BLE GATT Server (Arduino)
- **Mobile**: Progressive Web App (HTML/CSS/JS)
- **Server**: Python Flask + Whisper AI + Google Translate + gTTS
- **Communication**: BLE (button) + HTTPS (audio/translation)
