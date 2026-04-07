/* ═══════════════════════════════════════════════════
   AI Speech Translator — App Logic
   BLE Connection + Audio Recording + Translation
   ═══════════════════════════════════════════════════ */

(function () {
    "use strict";

    // ── BLE UUIDs (must match ESP32 firmware) ──────
    const SERVICE_UUID        = "19b10000-e8f2-537e-4f6c-d104768a1214";
    const BUTTON_CHAR_UUID    = "19b10001-e8f2-537e-4f6c-d104768a1214";
    const LED_CHAR_UUID       = "19b10002-e8f2-537e-4f6c-d104768a1214";
    const REPLAY_CHAR_UUID    = "19b10003-e8f2-537e-4f6c-d104768a1214";
    const PREV_CHAR_UUID      = "19b10004-e8f2-537e-4f6c-d104768a1214";

    // ── State ──────────────────────────────────────
    let bleDevice       = null;
    let bleServer       = null;
    let buttonChar      = null;
    let ledChar         = null;
    let replayChar      = null;
    let prevChar        = null;
    let isConnected     = false;
    let isRecording     = false;
    let isProcessing    = false;
    let mediaRecorder   = null;
    let audioChunks     = [];
    let micStream       = null;
    let lastAudioB64    = null;
    let history         = [];
    let historyIndex    = -1;  // tracks current position in history for prev button

    // Server URL — auto-detect or use saved setting
    let SERVER_URL = "";

    // ── DOM Elements ───────────────────────────────
    const $ = (id) => document.getElementById(id);

    const el = {
        bleStatus:      $("bleStatus"),
        bleText:        $("bleText"),
        btnConnect:     $("btnConnect"),
        btnSettings:    $("btnSettings"),
        sourceLang:     $("sourceLang"),
        targetLang:     $("targetLang"),
        btnSwapLang:    $("btnSwapLang"),
        statusCircle:   $("statusCircle"),
        statusText:     $("statusText"),
        statusSub:      $("statusSub"),
        iconMic:        $("iconMic"),
        iconWave:       $("iconWave"),
        iconSpinner:    $("iconSpinner"),
        iconSpeaker:    $("iconSpeaker"),
        btnVirtual:     $("btnVirtual"),
        resultCard:     $("resultCard"),
        resultOriginal: $("resultOriginal"),
        resultTranslated: $("resultTranslated"),
        resultSourceLabel: $("resultSourceLabel"),
        resultTargetLabel: $("resultTargetLabel"),
        btnReplay:      $("btnReplay"),
        historyTitle:   $("historyTitle"),
        historyList:    $("historyList"),
        settingsPanel:  $("settingsPanel"),
        btnCloseSettings: $("btnCloseSettings"),
        settingServerUrl: $("settingServerUrl"),
        audioPlayer:    $("audioPlayer"),
    };

    // ── Initialize ─────────────────────────────────
    function init() {
        detectServerUrl();
        loadLanguages();
        loadSettings();
        bindEvents();
        requestMicPermission();
        console.log("[Init] App ready");
    }

    // ── Server URL Detection ───────────────────────
    function detectServerUrl() {
        // If served from the Python server, use same origin
        const origin = window.location.origin;
        SERVER_URL = origin;
        console.log("[Server] URL:", SERVER_URL);
    }

    // ── Load Languages ─────────────────────────────
    async function loadLanguages() {
        try {
            const resp = await fetch(`${SERVER_URL}/languages`);
            const langs = await resp.json();

            // Source language
            el.sourceLang.innerHTML = '<option value="auto" selected>🔍 Auto Detect</option>';
            langs.forEach(l => {
                const opt = document.createElement("option");
                opt.value = l.code;
                opt.textContent = l.name;
                el.sourceLang.appendChild(opt);
            });

            // Target language
            el.targetLang.innerHTML = "";
            langs.forEach(l => {
                const opt = document.createElement("option");
                opt.value = l.code;
                opt.textContent = l.name + (l.tts_available ? "" : " (no voice)");
                el.targetLang.appendChild(opt);
            });

            // Default target: Tamil
            el.targetLang.value = "ta";
            if (!el.targetLang.value) el.targetLang.selectedIndex = 0;

            console.log(`[Lang] Loaded ${langs.length} languages`);
        } catch (err) {
            console.error("[Lang] Failed to load:", err);
            // Fallback languages
            const fallback = [
                { code: "en", name: "English" },
                { code: "ta", name: "Tamil" },
                { code: "hi", name: "Hindi" },
                { code: "fr", name: "French" },
                { code: "de", name: "German" },
                { code: "es", name: "Spanish" },
                { code: "ja", name: "Japanese" },
                { code: "ko", name: "Korean" },
                { code: "zh-CN", name: "Chinese" },
                { code: "ar", name: "Arabic" },
                { code: "ru", name: "Russian" },
            ];
            el.sourceLang.innerHTML = '<option value="auto" selected>🔍 Auto Detect</option>';
            fallback.forEach(l => {
                const opt1 = document.createElement("option");
                opt1.value = l.code;
                opt1.textContent = l.name;
                el.sourceLang.appendChild(opt1);

                const opt2 = document.createElement("option");
                opt2.value = l.code;
                opt2.textContent = l.name;
                el.targetLang.appendChild(opt2);
            });
            el.targetLang.value = "ta";
        }
    }

    // ── Settings ───────────────────────────────────
    function loadSettings() {
        const saved = localStorage.getItem("translator_settings");
        if (saved) {
            const s = JSON.parse(saved);
            if (s.serverUrl) {
                SERVER_URL = s.serverUrl;
                el.settingServerUrl.value = s.serverUrl;
            }
            if (s.targetLang) el.targetLang.value = s.targetLang;
            if (s.sourceLang) el.sourceLang.value = s.sourceLang;
        }
        el.settingServerUrl.placeholder = SERVER_URL;
    }

    function saveSettings() {
        localStorage.setItem("translator_settings", JSON.stringify({
            serverUrl: SERVER_URL,
            targetLang: el.targetLang.value,
            sourceLang: el.sourceLang.value,
        }));
    }

    // ── Bind Events ────────────────────────────────
    function bindEvents() {
        // BLE Connect
        el.btnConnect.addEventListener("click", toggleBLE);

        // Language swap
        el.btnSwapLang.addEventListener("click", swapLanguages);

        // Save language selection
        el.sourceLang.addEventListener("change", saveSettings);
        el.targetLang.addEventListener("change", saveSettings);

        // Virtual button (hold to talk)
        el.btnVirtual.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            startRecording();
            el.btnVirtual.classList.add("active");
        });
        el.btnVirtual.addEventListener("pointerup", (e) => {
            e.preventDefault();
            stopRecordingAndTranslate();
            el.btnVirtual.classList.remove("active");
        });
        el.btnVirtual.addEventListener("pointerleave", (e) => {
            if (isRecording) {
                stopRecordingAndTranslate();
                el.btnVirtual.classList.remove("active");
            }
        });
        // Prevent context menu on long press
        el.btnVirtual.addEventListener("contextmenu", (e) => e.preventDefault());

        // Replay button
        el.btnReplay.addEventListener("click", replayAudio);

        // Settings
        el.btnSettings.addEventListener("click", () => {
            el.settingsPanel.classList.remove("hidden");
        });
        el.btnCloseSettings.addEventListener("click", closeSettings);
        el.settingsPanel.querySelector(".settings-backdrop").addEventListener("click", closeSettings);

        // Server URL change
        el.settingServerUrl.addEventListener("change", () => {
            const url = el.settingServerUrl.value.trim();
            if (url) {
                SERVER_URL = url;
                saveSettings();
                showToast("Server URL updated");
                loadLanguages();
            }
        });
    }

    function closeSettings() {
        el.settingsPanel.classList.add("hidden");
    }

    function swapLanguages() {
        const src = el.sourceLang.value;
        const tgt = el.targetLang.value;

        if (src === "auto") {
            showToast("Can't swap with Auto Detect");
            return;
        }

        el.sourceLang.value = tgt;
        el.targetLang.value = src;
        saveSettings();
    }

    // ── Microphone Permission ──────────────────────
    async function requestMicPermission() {
        try {
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000,
                }
            });
            console.log("[Mic] Permission granted");
        } catch (err) {
            console.error("[Mic] Permission denied:", err);
            showToast("Microphone access required!", true);
        }
    }

    // ══════════════════════════════════════════════
    //  BLE CONNECTION
    // ══════════════════════════════════════════════

    async function toggleBLE() {
        if (isConnected) {
            disconnectBLE();
        } else {
            await connectBLE();
        }
    }

    async function connectBLE() {
        if (!navigator.bluetooth) {
            showToast("Bluetooth not supported in this browser", true);
            return;
        }

        try {
            setBLEState("connecting");

            bleDevice = await navigator.bluetooth.requestDevice({
                filters: [{ name: "TranslatorBtn" }],
                optionalServices: [SERVICE_UUID],
            });

            bleDevice.addEventListener("gattserverdisconnected", onBLEDisconnected);

            bleServer = await bleDevice.gatt.connect();
            const service = await bleServer.getPrimaryService(SERVICE_UUID);

            // Get button characteristic
            buttonChar = await service.getCharacteristic(BUTTON_CHAR_UUID);
            await buttonChar.startNotifications();
            buttonChar.addEventListener("characteristicvaluechanged", onButtonChange);

            // Get LED characteristic
            try {
                ledChar = await service.getCharacteristic(LED_CHAR_UUID);
            } catch (e) {
                console.warn("[BLE] LED characteristic not found");
                ledChar = null;
            }

            // Get Replay characteristic
            try {
                replayChar = await service.getCharacteristic(REPLAY_CHAR_UUID);
                await replayChar.startNotifications();
                replayChar.addEventListener("characteristicvaluechanged", onReplayChange);
                console.log("[BLE] Replay button ready");
            } catch (e) {
                console.warn("[BLE] Replay characteristic not found");
                replayChar = null;
            }

            // Get Previous characteristic
            try {
                prevChar = await service.getCharacteristic(PREV_CHAR_UUID);
                await prevChar.startNotifications();
                prevChar.addEventListener("characteristicvaluechanged", onPrevChange);
                console.log("[BLE] Previous button ready");
            } catch (e) {
                console.warn("[BLE] Previous characteristic not found");
                prevChar = null;
            }

            isConnected = true;
            setBLEState("connected");
            showToast("ESP32 connected! ✓ (Record + Replay + Previous)");
            console.log("[BLE] Connected to TranslatorBtn");
            console.log("[BLE] Button char:", buttonChar ? "✓" : "✗");
            console.log("[BLE] LED char:", ledChar ? "✓" : "✗");
            console.log("[BLE] Replay char:", replayChar ? "✓" : "✗");
            console.log("[BLE] Previous char:", prevChar ? "✓" : "✗");

        } catch (err) {
            console.error("[BLE] Connect failed:", err);
            setBLEState("disconnected");
            if (err.name !== "NotFoundError") {
                showToast("Connection failed: " + err.message, true);
            }
        }
    }

    function disconnectBLE() {
        if (bleDevice && bleDevice.gatt.connected) {
            bleDevice.gatt.disconnect();
        }
        onBLEDisconnected();
    }

    function onBLEDisconnected() {
        isConnected = false;
        bleDevice = null;
        bleServer = null;
        buttonChar = null;
        ledChar = null;
        replayChar = null;
        prevChar = null;
        setBLEState("disconnected");
        console.log("[BLE] Disconnected");
    }

    function setBLEState(state) {
        el.bleStatus.className = "ble-indicator " + state;

        switch (state) {
            case "disconnected":
                el.bleText.textContent = "Not Connected";
                el.btnConnect.textContent = "Connect";
                el.btnConnect.classList.remove("connected");
                break;
            case "connecting":
                el.bleText.textContent = "Connecting...";
                el.btnConnect.textContent = "...";
                break;
            case "connected":
                el.bleText.textContent = "ESP32 Connected";
                el.btnConnect.textContent = "Disconnect";
                el.btnConnect.classList.add("connected");
                break;
        }
    }

    // ── BLE Button Event ───────────────────────────
    function onButtonChange(event) {
        const value = event.target.value.getUint8(0);
        console.log("[BLE] Button value received:", value);

        if (value === 1) {
            // Button pressed → start recording
            console.log("[BLE] → Starting recording...");
            showToast("🔴 Recording...");
            startRecording();
        } else {
            // Button released → stop & translate
            console.log("[BLE] → Stopping recording, translating...");
            stopRecordingAndTranslate();
        }
    }

    // ── BLE Replay Button Event ────────────────────
    function onReplayChange(event) {
        const value = event.target.value.getUint8(0);
        console.log("[BLE] Replay value received:", value);

        if (value === 1) {
            if (lastAudioB64) {
                console.log("[BLE] → Replaying last translation");
                showToast("🔁 Replaying...");
                replayAudio();
            } else {
                console.log("[BLE] → No audio to replay");
                showToast("No translation to replay", true);
            }
        }
    }

    // ── BLE Previous Button Event ──────────────────
    function onPrevChange(event) {
        const value = event.target.value.getUint8(0);
        console.log("[BLE] Previous:", value);

        if (value === 1) {
            playPreviousTranslation();
        }
    }

    // ── Play Previous Translation ──────────────────
    function playPreviousTranslation() {
        if (history.length === 0) {
            showToast("No translation history", true);
            return;
        }

        // Move back in history
        historyIndex++;

        // Clamp to history bounds
        if (historyIndex >= history.length) {
            historyIndex = history.length - 1;
            showToast("No more previous translations", true);
            return;
        }

        const item = history[historyIndex];
        console.log(`[Prev] Playing history item ${historyIndex}: "${item.original}"`);

        // Update display
        lastAudioB64 = item.audio;
        showResult({
            original_text: item.original,
            translated_text: item.translated,
            source_lang: item.sourceLang,
            target_lang: item.targetLang,
        });

        // Play the audio
        playAudio(item.audio);

        showToast(`Previous (${historyIndex + 1}/${history.length})`);
    }

    // ── LED Control ────────────────────────────────
    async function setLED(on) {
        if (!ledChar) return;
        try {
            const val = new Uint8Array([on ? 1 : 0]);
            await ledChar.writeValue(val);
        } catch (e) {
            console.warn("[BLE] LED write failed:", e);
        }
    }

    // ══════════════════════════════════════════════
    //  AUDIO RECORDING
    // ══════════════════════════════════════════════

    async function startRecording() {
        if (isRecording || isProcessing) return;

        // Ensure mic access
        if (!micStream || !micStream.active) {
            try {
                micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 16000,
                    }
                });
            } catch (err) {
                showToast("Microphone access denied!", true);
                setLED(false);
                return;
            }
        }

        isRecording = true;
        audioChunks = [];

        // Create MediaRecorder
        // Prefer webm/opus, fallback to whatever is available
        const mimeTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus",
            "audio/mp4",
        ];
        let mimeType = "";
        for (const mt of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mt)) {
                mimeType = mt;
                break;
            }
        }

        const options = mimeType ? { mimeType } : {};
        mediaRecorder = new MediaRecorder(micStream, options);

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.start(100); // Collect data every 100ms
        setUIState("recording");
        setLED(true);

        console.log("[Rec] Started recording, mime:", mimeType || "default");
    }

    function stopRecordingAndTranslate() {
        if (!isRecording || !mediaRecorder) return;

        isRecording = false;

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
            console.log("[Rec] Stopped. Blob size:", audioBlob.size, "bytes");

            if (audioBlob.size < 3000) {
                showToast("Recording too short — hold longer", true);
                setUIState("idle");
                setLED(false);
                return;
            }

            translateAudio(audioBlob);
        };

        mediaRecorder.stop();
    }

    // ══════════════════════════════════════════════
    //  TRANSLATION
    // ══════════════════════════════════════════════

    async function translateAudio(audioBlob) {
        isProcessing = true;
        setUIState("translating");

        const sourceLang = el.sourceLang.value;
        const targetLang = el.targetLang.value;

        try {
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");
            formData.append("source_lang", sourceLang);
            formData.append("target_lang", targetLang);

            console.log("[API] Sending to server...");
            const resp = await fetch(`${SERVER_URL}/translate`, {
                method: "POST",
                body: formData,
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ error: "Server error" }));
                throw new Error(err.error || `HTTP ${resp.status}`);
            }

            const data = await resp.json();
            console.log("[API] Result:", data.original_text, "→", data.translated_text);

            // Play audio
            lastAudioB64 = data.audio_base64;
            playAudio(data.audio_base64);

            // Show result
            showResult(data);

            // Add to history and reset history index
            addToHistory(data);
            historyIndex = -1;  // Reset so next "previous" goes to the one before current

            // LED feedback — blink 3 times then off
            blinkLED(3);

        } catch (err) {
            console.error("[API] Translation failed:", err);
            setUIState("error", err.message);
            setLED(false);
            showToast("Translation failed: " + err.message, true);

            // Reset after 3 seconds
            setTimeout(() => {
                if (!isRecording && !isProcessing) setUIState("idle");
            }, 3000);
        } finally {
            isProcessing = false;
        }
    }

    // ══════════════════════════════════════════════
    //  AUDIO PLAYBACK
    // ══════════════════════════════════════════════

    function playAudio(base64Mp3) {
        setUIState("playing");

        const audioSrc = `data:audio/mp3;base64,${base64Mp3}`;
        el.audioPlayer.src = audioSrc;
        el.audioPlayer.play().then(() => {
            console.log("[Audio] Playing...");
        }).catch(err => {
            console.error("[Audio] Play failed:", err);
            // Try user gesture workaround
            showToast("Tap to enable audio", true);
        });

        el.audioPlayer.onended = () => {
            console.log("[Audio] Playback complete");
            setUIState("idle");
            setLED(false);
        };

        el.audioPlayer.onerror = () => {
            console.error("[Audio] Playback error");
            setUIState("idle");
            setLED(false);
        };
    }

    function replayAudio() {
        if (lastAudioB64) {
            playAudio(lastAudioB64);
        }
    }

    async function blinkLED(times) {
        for (let i = 0; i < times; i++) {
            await setLED(true);
            await sleep(200);
            await setLED(false);
            await sleep(200);
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ══════════════════════════════════════════════
    //  UI STATE MANAGEMENT
    // ══════════════════════════════════════════════

    function setUIState(state, detail) {
        // Reset icons
        el.iconMic.style.display = "none";
        el.iconWave.style.display = "none";
        el.iconSpinner.style.display = "none";
        el.iconSpeaker.style.display = "none";

        // Remove all state classes
        el.statusCircle.className = "status-circle " + state;

        switch (state) {
            case "idle":
                el.iconMic.style.display = "block";
                el.statusText.textContent = "Ready";
                el.statusSub.textContent = isConnected
                    ? "Press ESP32 button or hold below to speak"
                    : "Hold the button below to speak";
                break;

            case "recording":
                el.iconWave.style.display = "flex";
                el.statusText.textContent = "Listening...";
                el.statusSub.textContent = "Release button when done speaking";
                break;

            case "translating":
                el.iconSpinner.style.display = "block";
                el.statusText.textContent = "Translating...";
                el.statusSub.textContent = "AI is processing your speech";
                break;

            case "playing":
                el.iconSpeaker.style.display = "block";
                el.statusText.textContent = "Playing Translation";
                el.statusSub.textContent = "Listen through your earbuds";
                break;

            case "error":
                el.iconMic.style.display = "block";
                el.statusText.textContent = "Error";
                el.statusSub.textContent = detail || "Something went wrong";
                break;
        }
    }

    // ── Show Translation Result ────────────────────
    function showResult(data) {
        el.resultCard.classList.remove("hidden");

        // Get language names
        const srcName = getLanguageName(data.source_lang);
        const tgtName = getLanguageName(data.target_lang);

        el.resultSourceLabel.textContent = srcName;
        el.resultTargetLabel.textContent = tgtName;
        el.resultOriginal.textContent = data.original_text;
        el.resultTranslated.textContent = data.translated_text;

        // Scroll to result
        el.resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function getLanguageName(code) {
        const opt = el.targetLang.querySelector(`option[value="${code}"]`)
            || el.sourceLang.querySelector(`option[value="${code}"]`);
        if (opt) return opt.textContent.replace(" (no voice)", "");

        // Fallback
        const names = {
            en: "English", ta: "Tamil", hi: "Hindi", fr: "French",
            de: "German", es: "Spanish", ja: "Japanese", ko: "Korean",
        };
        return names[code] || code.toUpperCase();
    }

    // ── History ────────────────────────────────────
    function addToHistory(data) {
        history.unshift({
            original: data.original_text,
            translated: data.translated_text,
            sourceLang: data.source_lang,
            targetLang: data.target_lang,
            audio: data.audio_base64,
            time: new Date(),
        });

        // Keep only last 20
        if (history.length > 20) history.pop();

        renderHistory();
    }

    function renderHistory() {
        if (history.length === 0) {
            el.historyTitle.style.display = "none";
            el.historyList.innerHTML = "";
            return;
        }

        el.historyTitle.style.display = "block";
        el.historyList.innerHTML = "";

        history.forEach((item, i) => {
            const div = document.createElement("div");
            div.className = "history-item";
            div.innerHTML = `
                <div class="history-original">${escapeHtml(item.original)}</div>
                <div class="history-translated">${escapeHtml(item.translated)}</div>
                <div class="history-meta">
                    <span>${getLanguageName(item.sourceLang)} → ${getLanguageName(item.targetLang)}</span>
                    <span>${formatTime(item.time)}</span>
                </div>
            `;
            div.addEventListener("click", () => {
                // Replay this item
                lastAudioB64 = item.audio;
                showResult({
                    original_text: item.original,
                    translated_text: item.translated,
                    source_lang: item.sourceLang,
                    target_lang: item.targetLang,
                });
                playAudio(item.audio);
            });
            el.historyList.appendChild(div);
        });
    }

    // ── Toast Notification ─────────────────────────
    let toastTimeout = null;

    function showToast(msg, isError) {
        // Remove existing
        const existing = document.querySelector(".toast");
        if (existing) existing.remove();

        const toast = document.createElement("div");
        toast.className = "toast" + (isError ? " error" : "");
        toast.textContent = msg;
        document.body.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add("show");
        });

        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // ── Utilities ──────────────────────────────────
    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    // ── Start ──────────────────────────────────────
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
