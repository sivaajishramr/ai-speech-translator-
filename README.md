# 🌐 ESP32-Based Portable AI Speech Translator

<div align="center">

**Speak in any language → Hear the translation through your Bluetooth earbuds!**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![ESP32](https://img.shields.io/badge/ESP32-Arduino-E7352C?style=for-the-badge&logo=espressif&logoColor=white)](https://www.espressif.com/)
[![Flask](https://img.shields.io/badge/Flask-3.0+-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Whisper](https://img.shields.io/badge/Faster--Whisper-AI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://github.com/SYSTRAN/faster-whisper)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

*A low-cost (~₹440), open-source, real-time speech translation device powered by ESP32 and deep learning*

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Features](#-features)
- [Hardware Requirements](#-hardware-requirements)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Cloud Deployment](#-cloud-deployment)
- [How It Works](#-how-it-works)
- [Tech Stack](#-tech-stack)
- [Troubleshooting](#-troubleshooting)
- [Research Paper](#-research-paper)
- [Authors](#-authors)
- [License](#-license)

---

## 🔍 Overview

This project is a **portable, real-time AI speech translator** built around the **ESP32 microcontroller**. It captures spoken audio, processes it through a 3-stage AI pipeline (Speech-to-Text → Translation → Text-to-Speech), and delivers the translated audio through Bluetooth earbuds.

### Why This Project?

| | Commercial Devices | This Project |
|---|---|---|
| 💰 **Cost** | ₹8,000 – ₹25,000 | **~₹440** |
| 🌍 **Languages** | 80–155 | **100+** |
| 🙌 **Hands-Free** | ❌ | ✅ Physical buttons |
| 🎧 **BT Earbuds** | ❌ | ✅ |
| 🔓 **Open Source** | ❌ | ✅ |

> **95–97% cost reduction** compared to commercial translation devices like Pocketalk (₹10,800) and Travis Touch (₹16,700).

---

## 🏗 Architecture

```
┌─────────────────────────────┐
│       ESP32 Device          │
│                             │
│  🔴 Record Button (GPIO 4) │
│  🔁 Replay Button (GPIO 5) │
│  ⏮  Previous   (GPIO 16)  │
│  💡 Status LED  (GPIO 2)   │
│                             │
│  📡 BLE GATT Server        │
└──────────┬──────────────────┘
           │ BLE + HTTPS
           ▼
┌──────────────────────────────────┐
│      AI Processing Server        │
│                                  │
│  Step 1: 🔤 Faster-Whisper STT  │
│        (Speech → Text)           │
│                                  │
│  Step 2: 🌐 Google Translate    │
│        (Text → Translated Text)  │
│                                  │
│  Step 3: 🔊 gTTS Synthesis      │
│        (Text → Speech MP3)       │
│                                  │
│  📦 Flask HTTPS Server           │
└──────────────────────────────────┘
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🌍 **100+ Languages** | Translate between any supported language pair |
| 🔵 **BLE Hardware Button** | ESP32 physical push-to-talk trigger |
| 📱 **Virtual Button** | Hold-to-talk on phone screen |
| 🎧 **Bluetooth Earbuds** | Audio output through BT earbuds |
| 🔁 **Replay Button** | Replay the last translation instantly |
| ⏮ **Previous Button** | Navigate through translation history |
| 🔍 **Auto Language Detection** | Whisper automatically detects the source language |
| 🛡 **Hallucination Filtering** | Multi-layer filtering rejects false Whisper outputs |
| 📲 **Installable PWA** | Add to home screen as a mobile app |
| ☁️ **Cloud Deployable** | Deploy to Hugging Face Spaces (included) |

---

## 🔧 Hardware Requirements

| Component | Purpose | Cost (₹) |
|-----------|---------|-----------|
| ESP32 DevKit | BLE controller + buttons | ₹290 |
| Push Buttons ×3 | Record / Replay / Previous | ₹25 |
| Jumper Wires | Connections | ₹40 |
| Breadboard | Prototyping | ₹85 |
| **Total** | | **~₹440** |

### Wiring Diagram

```
ESP32 Pin    →    Component
─────────────────────────────
GPIO 4       →    Record Button → GND
GPIO 5       →    Replay Button → GND
GPIO 16      →    Previous Button → GND
GPIO 2       →    Built-in LED (most boards)
```

> All buttons use **INPUT_PULLUP** — just connect button between GPIO pin and GND.

---

## 📁 Project Structure

```
ai-speech-translator/
│
├── 📂 esp32/                    # ESP32 Firmware
│   └── ble_button/
│       └── ble_button.ino       # BLE GATT server + button handling
│
├── 📂 server/                   # Python AI Server (Local)
│   ├── server.py                # Flask + Whisper + Translate + gTTS
│   └── requirements.txt         # Python dependencies
│
├── 📂 webapp/                   # Progressive Web App
│   ├── index.html               # Main UI
│   ├── app.js                   # BLE + Recording + Translation logic
│   ├── style.css                # Dark theme UI styling
│   ├── manifest.json            # PWA manifest
│   └── sw.js                    # Service Worker for offline support
│
├── 📂 hf-deploy/                # Hugging Face Spaces Deployment
│   ├── Dockerfile               # Docker build instructions
│   ├── README.md                # HF Spaces metadata
│   ├── server.py                # Cloud-ready server (no SSL)
│   ├── requirements.txt         # Python dependencies
│   └── webapp/                  # Webapp copy for deployment
│
├── .gitignore
└── README.md                    # This file
```

---

## 🚀 Quick Start

### 1️⃣ Flash ESP32 Firmware

1. Open `esp32/ble_button/ble_button.ino` in **Arduino IDE**
2. Install **ESP32 board support** (if not already)
3. Select your board and COM port
4. Click **Upload**
5. Serial monitor should show: `✓ BLE ready! Advertising as 'TranslatorBtn'`

### 2️⃣ Start the Python Server

```bash
cd server

# Install dependencies
pip install -r requirements.txt
pip install cryptography    # For auto SSL certificate

# Run the server
python server.py
```

The server will:
- 📥 Load the Faster-Whisper AI model (small, INT8)
- 🔐 Generate a self-signed SSL certificate
- 🌐 Show your local IP address
- 🚀 Start on **port 5000**

### 3️⃣ Open the Mobile Web App

1. **Pair your Bluetooth earbuds** to your phone normally
2. Open **Chrome** on your Android phone
3. Navigate to: `https://YOUR_PC_IP:5000` (shown in server output)
4. Accept the certificate warning → **Advanced** → **Proceed**
5. Allow **microphone access** when prompted
6. Click **Connect** to pair with ESP32 BLE

### 4️⃣ Translate!

1. 🔴 **Press & hold** the ESP32 record button
2. 🗣 **Speak** in your source language
3. ⏹ **Release** the button
4. ⏳ Wait ~3-4 seconds
5. 🎧 **Hear** the translated speech through your earbuds!

---

## ☁️ Cloud Deployment

Deploy the AI server to **Hugging Face Spaces** so you don't need to run it on your PC:

### Live Deployment: [HF Spaces](https://huggingface.co/spaces/Ajish07/ai-speech-translator)

### Deploy Your Own

1. Create a free account on [huggingface.co](https://huggingface.co)
2. Create a new **Space** (SDK: Docker)
3. Push the `hf-deploy/` folder:

```bash
cd hf-deploy
git init
git add .
git commit -m "Deploy AI Speech Translator"
git remote add origin https://huggingface.co/spaces/YOUR_USERNAME/ai-speech-translator
git push origin main
```

The server will be live at: `https://YOUR_USERNAME-ai-speech-translator.hf.space`

---

## ⚙️ How It Works

### AI Pipeline (3 Stages)

```
Audio Input → [Stage 1: STT] → [Stage 2: Translation] → [Stage 3: TTS] → Audio Output
```

| Stage | Technology | Details |
|-------|-----------|---------|
| **1. Speech-to-Text** | Faster-Whisper (small, INT8) | VAD filtering, confidence thresholding, hallucination rejection |
| **2. Translation** | Google Translate API | Auto-detect source language, 100+ target languages |
| **3. Text-to-Speech** | gTTS | MP3 output, Base64 encoded, language-aware voice |

### BLE Protocol

| Characteristic | UUID | Direction | Purpose |
|---------------|------|-----------|---------|
| Record Button | `19B10001-...` | ESP32 → App | Notify press/release (0x01/0x00) |
| LED Control | `19B10002-...` | App → ESP32 | Write ON/OFF (0x01/0x00) |
| Replay Button | `19B10003-...` | ESP32 → App | Notify replay trigger |
| Previous Button | `19B10004-...` | ESP32 → App | Notify previous trigger |

### Performance

| Metric | Value |
|--------|-------|
| STT Accuracy | 89–96% (varies by language) |
| End-to-End Latency | ~3.8 seconds average |
| Hallucination Rejection | ~98% |
| BLE Range | ~10 meters indoor |
| Battery Life (1000mAh) | ~10.5 hours (connected standby) |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Microcontroller** | ESP32 (Xtensa LX6, BLE 4.2) |
| **Firmware** | C++ / Arduino Framework |
| **Backend** | Python 3.10+ / Flask |
| **Speech Recognition** | Faster-Whisper (CTranslate2) |
| **Translation** | Google Translate (deep-translator) |
| **Text-to-Speech** | gTTS |
| **Audio Processing** | pydub + FFmpeg |
| **Frontend** | HTML / CSS / JavaScript (PWA) |
| **BLE Communication** | Web Bluetooth API |
| **Deployment** | Docker / Hugging Face Spaces |

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Bluetooth not supported" | Use **Chrome** browser (not Firefox/Safari) |
| Certificate warning | Click **Advanced** → **Proceed** in Chrome |
| ESP32 not found | Check ESP32 is powered on and advertising |
| No audio playback | Make sure earbuds are paired to the phone |
| Server connection failed | Check PC and phone are on **same WiFi** |
| Mic not working | Allow microphone permission in Chrome |
| Random/wrong words | Speak clearly, minimize background noise |
| "Recording too short" | Hold the button for at least 1 second |

---

## 📄 Research Paper

A detailed IEEE-style research paper documenting this project is available:

**Title**: *ESP32-Based Portable AI Speech Translator Using Deep Learning*

**Authors**: Balamurugan S, Siva Ajish Ram, Hari Karthikeyan

The paper covers system architecture, implementation details, experimental results (accuracy, latency, power consumption), and comparison with commercial devices.

---

## 👨‍💻 Authors

- **Balamurugan S**
- **Siva Ajish Ram**
- **Hari Karthikeyan**

Department of Computer Science and Engineering

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).

---

<div align="center">

**⭐ Star this repo if you found it useful!**

Made with ❤️ using ESP32 + AI

</div>
