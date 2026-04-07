"""
═══════════════════════════════════════════════════
  AI Speech Translator — Cloud Server (HF Spaces)
  Phone sends audio → Server translates → Returns MP3
═══════════════════════════════════════════════════
"""

import io
import os
import base64
import tempfile
from pathlib import Path

from faster_whisper import WhisperModel
import numpy as np
from pydub import AudioSegment
from deep_translator import GoogleTranslator
from gtts import gTTS
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# ── App Setup ──────────────────────────────────────
app = Flask(__name__, static_folder=None)
CORS(app)

WEBAPP_DIR = os.path.join(os.path.dirname(__file__), "webapp")

print("╔══════════════════════════════════════════════╗")
print("║   AI Speech Translator — Cloud Server        ║")
print("║   Hugging Face Spaces Deployment              ║")
print("╚══════════════════════════════════════════════╝")
print()
print("Loading Faster-Whisper AI model (small, int8)...")
print("First run will download the model (~500MB), please wait...")
model = WhisperModel("small", device="cpu", compute_type="int8")
print("✓ Faster-Whisper ready! (small model — much better accuracy)")
print()

# ── Supported Languages ───────────────────────────
LANGUAGES = {
    "af": "Afrikaans",
    "sq": "Albanian",
    "am": "Amharic",
    "ar": "Arabic",
    "hy": "Armenian",
    "az": "Azerbaijani",
    "eu": "Basque",
    "be": "Belarusian",
    "bn": "Bengali",
    "bs": "Bosnian",
    "bg": "Bulgarian",
    "ca": "Catalan",
    "ceb": "Cebuano",
    "zh-CN": "Chinese (Simplified)",
    "zh-TW": "Chinese (Traditional)",
    "co": "Corsican",
    "hr": "Croatian",
    "cs": "Czech",
    "da": "Danish",
    "nl": "Dutch",
    "en": "English",
    "eo": "Esperanto",
    "et": "Estonian",
    "fi": "Finnish",
    "fr": "French",
    "fy": "Frisian",
    "gl": "Galician",
    "ka": "Georgian",
    "de": "German",
    "el": "Greek",
    "gu": "Gujarati",
    "ht": "Haitian Creole",
    "ha": "Hausa",
    "haw": "Hawaiian",
    "he": "Hebrew",
    "hi": "Hindi",
    "hmn": "Hmong",
    "hu": "Hungarian",
    "is": "Icelandic",
    "ig": "Igbo",
    "id": "Indonesian",
    "ga": "Irish",
    "it": "Italian",
    "ja": "Japanese",
    "jv": "Javanese",
    "kn": "Kannada",
    "kk": "Kazakh",
    "km": "Khmer",
    "rw": "Kinyarwanda",
    "ko": "Korean",
    "ku": "Kurdish",
    "ky": "Kyrgyz",
    "lo": "Lao",
    "la": "Latin",
    "lv": "Latvian",
    "lt": "Lithuanian",
    "lb": "Luxembourgish",
    "mk": "Macedonian",
    "mg": "Malagasy",
    "ms": "Malay",
    "ml": "Malayalam",
    "mt": "Maltese",
    "mi": "Maori",
    "mr": "Marathi",
    "mn": "Mongolian",
    "my": "Myanmar (Burmese)",
    "ne": "Nepali",
    "no": "Norwegian",
    "ny": "Nyanja (Chichewa)",
    "or": "Odia (Oriya)",
    "ps": "Pashto",
    "fa": "Persian",
    "pl": "Polish",
    "pt": "Portuguese",
    "pa": "Punjabi",
    "ro": "Romanian",
    "ru": "Russian",
    "sm": "Samoan",
    "gd": "Scots Gaelic",
    "sr": "Serbian",
    "st": "Sesotho",
    "sn": "Shona",
    "sd": "Sindhi",
    "si": "Sinhala",
    "sk": "Slovak",
    "sl": "Slovenian",
    "so": "Somali",
    "es": "Spanish",
    "su": "Sundanese",
    "sw": "Swahili",
    "sv": "Swedish",
    "tl": "Tagalog (Filipino)",
    "tg": "Tajik",
    "ta": "Tamil",
    "tt": "Tatar",
    "te": "Telugu",
    "th": "Thai",
    "tr": "Turkish",
    "tk": "Turkmen",
    "uk": "Ukrainian",
    "ur": "Urdu",
    "ug": "Uyghur",
    "uz": "Uzbek",
    "vi": "Vietnamese",
    "cy": "Welsh",
    "xh": "Xhosa",
    "yi": "Yiddish",
    "yo": "Yoruba",
    "zu": "Zulu",
}

# gTTS supported languages (subset that gTTS can speak)
GTTS_LANGS = set()
try:
    from gtts.lang import tts_langs
    GTTS_LANGS = set(tts_langs().keys())
except:
    # Fallback common TTS languages
    GTTS_LANGS = {
        "en", "ta", "hi", "fr", "de", "es", "it", "pt", "ru", "ja",
        "ko", "zh-CN", "zh-TW", "ar", "bn", "nl", "el", "gu", "id",
        "kn", "ml", "mr", "ne", "no", "pl", "ro", "sv", "te", "th",
        "tr", "uk", "ur", "vi", "af", "sq", "bs", "ca", "hr", "cs",
        "da", "et", "fi", "gl", "hu", "is", "jv", "km", "ku", "la",
        "lv", "lt", "mk", "ms", "mt", "my", "pa", "fa", "sr", "si",
        "sk", "sl", "so", "su", "sw", "tl", "cy",
    }


# ── Translate Endpoint ────────────────────────────
@app.route("/translate", methods=["POST"])
def translate():
    """
    Receives audio from ESP32/phone, runs AI pipeline, returns translated audio.
    """
    try:
        # Get audio file
        if "audio" not in request.files:
            return jsonify({"error": "No audio file provided"}), 400

        audio_file = request.files["audio"]
        source_lang = request.form.get("source_lang", "auto")
        target_lang = request.form.get("target_lang", "ta")

        print()
        print("═══════════════════════════════════════════")
        print(f"  New translation request")
        print(f"  {source_lang.upper()} → {target_lang.upper()}")
        print("═══════════════════════════════════════════")

        # Save uploaded audio to temp file
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        # Convert to WAV (16kHz mono) for reliable Whisper recognition
        wav_path = tmp_path.replace(".webm", ".wav")
        try:
            print("🔄 Converting audio to WAV...")
            audio = AudioSegment.from_file(tmp_path)
            audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
            # Only boost if audio is very quiet (below -35 dBFS)
            if audio.dBFS < -35:
                gain_needed = -25 - audio.dBFS  # Bring up to -25 dBFS
                audio = audio.apply_gain(gain_needed)
                print(f"   Boosted quiet audio by {gain_needed:.1f} dB")
            audio.export(wav_path, format="wav")
            print(f"   ✓ Converted: {os.path.getsize(wav_path)} bytes, "
                  f"{len(audio)}ms duration, {audio.dBFS:.1f} dBFS")
        except Exception as conv_err:
            print(f"   ⚠ Conversion failed ({conv_err}), using original file")
            wav_path = tmp_path

        try:
            # ── Check minimum audio duration ──
            try:
                check_audio = AudioSegment.from_file(wav_path)
                duration_ms = len(check_audio)
                print(f"   Audio duration: {duration_ms}ms")
                if duration_ms < 500:
                    print("   ⚠ Audio too short (< 500ms), rejecting")
                    return jsonify({"error": "Recording too short — hold the button longer"}), 422
            except Exception:
                pass  # If we can't check duration, continue anyway

            # ── Step 1: Speech to Text (Faster-Whisper) ──
            print("🔤 Step 1: Faster-Whisper Speech Recognition (small)...")
            transcribe_opts = {
                "beam_size": 5,
                "vad_filter": True,
                "vad_parameters": dict(
                    min_silence_duration_ms=300,
                    speech_pad_ms=200,
                    threshold=0.6,
                ),
                "condition_on_previous_text": False,
                "no_speech_threshold": 0.5,
                "log_prob_threshold": -0.8,
            }
            if source_lang != "auto":
                transcribe_opts["language"] = source_lang

            segments, info = model.transcribe(wav_path, **transcribe_opts)

            # Collect segments, filtering out low-confidence ones
            good_segments = []
            for seg in segments:
                if seg.no_speech_prob > 0.5:
                    print(f"   Skipped noisy segment: '{seg.text.strip()}' "
                          f"(no_speech={seg.no_speech_prob:.0%})")
                    continue
                if seg.avg_logprob < -1.0:
                    print(f"   Skipped low-confidence: '{seg.text.strip()}' "
                          f"(avg_logprob={seg.avg_logprob:.2f})")
                    continue
                text = seg.text.strip()
                if len(text) < 2:
                    print(f"   Skipped tiny segment: '{text}'")
                    continue
                good_segments.append(text)

            original_text = " ".join(good_segments).strip()
            detected_lang = info.language if info.language else source_lang

            print(f"   Detected language: {detected_lang} "
                  f"(confidence: {info.language_probability:.0%})")
            print(f"   Heard: '{original_text}'")

            if not original_text or len(original_text) < 2:
                return jsonify({"error": "No speech detected"}), 422

            # Filter known Whisper silence hallucinations
            hallucinations = {
                "thank you for watching", "thanks for watching",
                "thank you", "thanks",
                "subscribe", "like and subscribe",
                "please subscribe", "please like and subscribe",
                "the end", "...", "",
                "you", "bye", "bye bye",
                "oh", "ah", "um", "uh",
                "music", "applause", "laughter",
                "silence", "no", "yes",
                "hmm", "huh", "okay",
                "so", "and", "but", "the",
                "i", "a", "is", "it",
                "subtitles by", "translated by",
                "copyright", "all rights reserved",
                "thanks for listening", "thank you for listening",
                "see you next time", "see you",
                "good bye", "goodbye",
                "music playing", "foreign",
            }
            cleaned = original_text.lower().strip(".!?, \"'()[]")
            if cleaned in hallucinations or len(cleaned) < 2:
                print(f"   ⚠ Filtered hallucination: '{original_text}'")
                return jsonify({"error": "No clear speech detected"}), 422

            # Check if result is just repeated single characters or nonsense
            words = cleaned.split()
            if len(words) <= 2 and all(len(w) <= 2 for w in words):
                print(f"   ⚠ Filtered likely nonsense: '{original_text}'")
                return jsonify({"error": "No clear speech detected"}), 422

            # ── Step 2: Translation ──
            print(f"🌐 Step 2: Translating to {target_lang.upper()}...")

            if detected_lang == target_lang or source_lang == target_lang:
                translated_text = original_text
                print(f"   Same language, skipping translation")
            else:
                trans_source = "auto" if source_lang == "auto" else source_lang
                translated_text = GoogleTranslator(
                    source=trans_source,
                    target=target_lang
                ).translate(original_text)

            print(f"   Translated: '{translated_text}'")

            # ── Step 3: Text to Speech (gTTS) ──
            print("🔊 Step 3: Generating Speech...")

            tts_lang = target_lang
            if tts_lang not in GTTS_LANGS:
                base = tts_lang.split("-")[0]
                if base in GTTS_LANGS:
                    tts_lang = base
                else:
                    print(f"   ⚠ TTS not available for {target_lang}, using en")
                    tts_lang = "en"

            mp3_buf = io.BytesIO()
            gTTS(text=translated_text, lang=tts_lang).write_to_fp(mp3_buf)
            mp3_buf.seek(0)
            audio_b64 = base64.b64encode(mp3_buf.read()).decode("utf-8")

            print(f"   ✓ MP3 generated ({len(audio_b64)} chars base64)")

            print()
            print("═══════════════════════════════════════════")
            print(f"  INPUT  : {original_text}")
            print(f"  OUTPUT : {translated_text}")
            print(f"  LANG   : {detected_lang} → {target_lang}")
            print("═══════════════════════════════════════════")
            print()

            return jsonify({
                "original_text": original_text,
                "translated_text": translated_text,
                "audio_base64": audio_b64,
                "source_lang": detected_lang,
                "target_lang": target_lang,
            })

        finally:
            # Clean up temp files
            for f in [tmp_path, wav_path]:
                try:
                    os.unlink(f)
                except:
                    pass

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── Languages Endpoint ────────────────────────────
@app.route("/languages")
def get_languages():
    """Returns supported languages with TTS availability."""
    langs = []
    for code, name in sorted(LANGUAGES.items(), key=lambda x: x[1]):
        langs.append({
            "code": code,
            "name": name,
            "tts_available": code in GTTS_LANGS,
        })
    return jsonify(langs)


# ── Health Check ──────────────────────────────────
@app.route("/health")
def health():
    return jsonify({"status": "ok", "model": "faster-whisper-small-int8"})


# ── Serve Web App ─────────────────────────────────
@app.route("/")
def serve_index():
    return send_from_directory(WEBAPP_DIR, "index.html")


@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory(WEBAPP_DIR, filename)


# ── Main ──────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))

    print(f"🌐 Server starting on port {port}...")
    print(f"   URL: http://0.0.0.0:{port}")
    print("─────────────────────────────────────────")

    # No SSL needed — Hugging Face Spaces provides HTTPS automatically
    app.run(host="0.0.0.0", port=port, debug=False)
