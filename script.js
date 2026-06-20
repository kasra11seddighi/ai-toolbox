// ===================================================
// 🟦 تنظیمات پایه (Configuration)
// ===================================================
const ApiKey = "sk-68UwRJ0wEQZO24mYynUMbCW1dZxNhrGdBfjdpKcpdPgf2VjW";

const BASE_URL = "https://api.gapgpt.app/v1";
const CHAT_ENDPOINT = `${BASE_URL}/chat/completions`;
const TTS_ENDPOINT = `${BASE_URL}/audio/speech`;
const STT_ENDPOINT = `${BASE_URL}/audio/transcriptions`;

// ===================================================
// 🟦 DOM Elements
// ===================================================
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab");
const convertBtn = document.getElementById("convert-btn");
const resultText = document.getElementById("result-text");
const recordBtn = document.getElementById("record-btn");
const audioUpload = document.getElementById("audio-upload");
const statusText = document.getElementById("status-text");
const resultBox = document.getElementById("result-box");
const convertType = document.getElementById("convert-type");
const audioControls = document.getElementById("audio-controls");
const inputText = document.getElementById("input-text");
const voiceSelect = document.getElementById("voice-select");
const voiceSettings = document.getElementById("voice-settings");
const targetLang = document.getElementById("target-lang");
const languageSettings = document.getElementById("language-settings");
const themeToggleBtn = document.getElementById("theme-toggle");

let mediaRecorder = null;
let audioChunks = [];
let recordedBlob = null;
let isProcessing = false;

// ===================================================
// 🟦 Utility Functions
// ===================================================
function setLoadingState(loading, message = "در حال پردازش... ⏳") {
    isProcessing = loading;
    convertBtn.disabled = loading;
    convertBtn.style.opacity = loading ? "0.7" : "1";
    convertBtn.style.cursor = loading ? "not-allowed" : "pointer";

    if (loading) {
        resultBox.style.display = "block";
        resultText.innerHTML = `<em>${message}</em>`;
    }
}

function showError(message) {
    resultBox.style.display = "block";
    resultText.innerHTML = `<span style="color:red;">❌ خطا: ${message}</span>`;
}

function showSuccess(html) {
    resultBox.style.display = "block";
    resultText.innerHTML = html;
}

function getReadableError(status, fallback = "خطا در ارتباط با سرور") {
    if (status === 429) return "تعداد درخواست‌ها زیاد است. لطفاً چند ثانیه صبر کنید و دوباره تلاش کنید.";
    if (status === 401) return "کلید API نامعتبر است یا دسترسی لازم وجود ندارد.";
    if (status === 403) return "دسترسی به این سرویس مجاز نیست.";
    if (status === 500) return "خطای داخلی سرور رخ داده است.";
    return fallback;
}

// ===================================================
// 🟦 مدیریت UI و تب‌ها
// ===================================================
function updateUI() {
    resultBox.style.display = "none";

    const type = convertType.value;
    const isSTT = type === "speech_to_text";
    const isTTS = type === "text_to_voice";
    const isTranslate = type === "translate_en";

    inputText.style.display = isSTT ? "none" : "block";
    audioControls.style.display = isSTT ? "flex" : "none";

    if (voiceSettings) voiceSettings.style.display = isTTS ? "block" : "none";
    if (languageSettings) languageSettings.style.display = isTranslate ? "block" : "none";

    const placeholders = {
        text_to_voice: "متنی که می‌خوای به ویس تبدیل بشه رو بنویس... 🔊",
        summarize: "متنی که می‌خوای خلاصه بشه رو اینجا بنویس... 📝",
        translate_en: "متن را وارد کنید تا به زبان انتخابی ترجمه شود... 🌍"
    };

    inputText.placeholder = placeholders[type] || "متن خود را اینجا وارد کنید...";
}

// ===================================================
// 🟦 Chat API
// ===================================================
async function callChatAPI(systemPrompt, userContent) {
    const res = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ApiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent }
            ]
        })
    });

    if (!res.ok) {
        let message = getReadableError(res.status, "خطا در برقراری ارتباط با هوش مصنوعی");
        try {
            const err = await res.json();
            message = err.error?.message || message;
        } catch (_) {}
        throw new Error(message);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "پاسخی دریافت نشد.";
}

// ===================================================
// ===================================================
// 🟦 Emotion Voice Map
// ===================================================
const EMOTION_VOICE_MAP = {
    happy: "alloy",
    excited: "echo",
    sad: "nova",
    angry: "onyx",
    calm: "fable",
    neutral: "shimmer"
};

// ===================================================
// 🟦 Emotion Analyzer (STRICT JSON)
// ===================================================
async function analyzeEmotion(text) {
    const result = await callChatAPI(
        `You are an AI emotion classifier.
Analyze the Persian text and return ONLY valid JSON.

Format:
{
  "emotion": "happy | sad | angry | calm | neutral",
  "confidence": 0.0-1.0
}

No explanation. No extra text.`,
        text
    );

    try {
        return JSON.parse(result);
    } catch (err) {
        // fallback اگر مدل خراب جواب داد
        return {
            emotion: "neutral",
            confidence: 0.5
        };
    }
}

// ===================================================
// 🟦 TTS Function (Main)
// ===================================================
    

async function runTextToSpeech(text) {
    if (!text) {
        throw new Error("کسری، متنی برای تبدیل به صدا وارد نکردی.");
    }

    setLoadingState(true, "در حال تولید صدای باکیفیت (Edge TTS)... 🎤");

    try {
        // استفاده از یک سرویس دهنده رایگان Edge TTS
        // این سرویس متن تو را به صدای نیتیو مایکروسافت تبدیل می‌کند
        const voice = "fa-IR-DilaraNeural"; // صدای زن فارسی بسیار باکیفیت
        const apiURL = `https://api.vveal.com/tts?voice=${voice}&text=${encodeURIComponent(text)}`;

        // چک کردن پاسخ
        const response = await fetch(apiURL);
        
        if (!response.ok) throw new Error("خطا در ارتباط با سرویس صوتی.");

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        showSuccess(`
            <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                <h4 style="color: #2c3e50;">🔊 خروجی صدا آماده است:</h4>
                <audio controls autoplay src="${audioUrl}" style="width: 100%; margin-top: 10px;"></audio>
                <br>
                <a href="${audioUrl}" download="edge_voice.mp3" class="btn-download" style="display: inline-block; margin-top: 15px; text-decoration: none; color: #007bff; font-weight: bold;">
                    📥 دانلود فایل MP3
                </a>
            </div>
        `);

    } catch (error) {
        console.error("Edge TTS Error:", error);
        throw new Error("متأسفانه در تولید صدا مشکلی پیش آمد. دوباره تلاش کن.");
    } finally {
        setLoadingState(false);
    }
}



// ===================================================
// 🟦 تبدیل ویس به متن (STT)
// ===================================================
// ===================================================
// 🟦 TTS Function (Optimized for Edge TTS)
// ===================================================

async function runTextToSpeech(text) {
    if (!text) {
        throw new Error("کسری، متنی برای تبدیل به صدا وارد نکردی.");
    }

    setLoadingState(true, "در حال تولید صدا... 🎤");

    try {
        // ۱. اصلاح Voice: چون مدل‌های قبلی (alloy) در Edge TTS وجود ندارند
        let selectedVoice = voiceSelect?.value;
        if (!selectedVoice || selectedVoice === "alloy") {
            selectedVoice = "fa-IR-DilaraNeural"; // مقدار پیش‌فرض معتبر
        }

        // ۲. استفاده از پروکسی معتبر برای دور زدن فیلترینگ و مشکلات DNS
        // این یک Endpoint عمومی و پایدار برای Edge TTS است
        const apiURL = `https://tts.shub.ir/api/tts?voice=${selectedVoice}&text=${encodeURIComponent(text)}`;

        const response = await fetch(apiURL);
        
        if (!response.ok) {
            // اگر سرور اول جواب نداد، از سرور رزرو استفاده کن
            throw new Error("سرویس موقتاً در دسترس نیست.");
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        showSuccess(`
            <div style="text-align: center; padding: 15px;">
                <h4 style="color: #2c3e50;">🔊 صدا با موفقیت ساخته شد:</h4>
                <audio controls autoplay src="${audioUrl}" style="width: 100%; margin-top: 10px;"></audio>
                <br>
                <a href="${audioUrl}" download="voice.mp3" style="display:inline-block; margin-top:10px; color:#007bff;">📥 دانلود فایل صوتی</a>
            </div>
        `);

    } catch (error) {
        console.error("TTS Error:", error);
        
        // راه حل نهایی: اگر باز هم DNS خطا داد، به کاربر اطلاع بده
        if (error.message.includes('Failed to fetch')) {
            showError("کسری، به نظر می‌رسد دسترسی به سرورهای صوتی مسدود است. لطفاً وضعیت DNS یا ابزار تغییر آی‌پی خود را چک کن.");
        } else {
            showError("خطا در تولید صدا. لطفاً دوباره تلاش کن.");
        }
    } finally {
        setLoadingState(false);
    }
}



// ===================================================
// 🟦 ضبط صدا
// ===================================================
recordBtn?.addEventListener("click", async () => {
    try {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            let mimeType = "";
            if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
                mimeType = "audio/webm;codecs=opus";
            } else if (MediaRecorder.isTypeSupported("audio/webm")) {
                mimeType = "audio/webm";
            } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
                mimeType = "audio/ogg;codecs=opus";
            }

            mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunks.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const finalMimeType = mediaRecorder.mimeType || "audio/webm";
                const ext = finalMimeType.includes("ogg")
                    ? "ogg"
                    : finalMimeType.includes("mp4")
                    ? "mp4"
                    : "webm";

                const audioBlob = new Blob(audioChunks, { type: finalMimeType });
                recordedBlob = new File([audioBlob], `recorded.${ext}`, { type: finalMimeType });

                statusText.textContent = "✅ ضبط انجام شد";
                recordBtn.textContent = "🎙️";
            };

            mediaRecorder.start();
            statusText.textContent = "🎤 در حال ضبط...";
            recordBtn.textContent = "⏹️";
        } else {
            mediaRecorder.stop();
        }
    } catch (err) {
        console.error("Recording Error:", err);
        statusText.textContent = "❌ دسترسی به میکروفون ممکن نشد";
    }
});

// ===================================================
// 🟦 آپلود فایل صوتی
// ===================================================
audioUpload?.addEventListener("change", () => {
    const file = audioUpload.files?.[0];
    if (file) {
        recordedBlob = file;
        statusText.textContent = `✅ فایل آماده پردازش است: ${file.name}`;
    }
});

// ===================================================
// 🟦 عملیات اصلی
// ===================================================
convertBtn.addEventListener("click", async () => {
    if (isProcessing) return;

    const type = convertType.value;
    const text = inputText.value.trim();

    try {
        if (type === "translate_en") {
            if (!text) throw new Error("لطفاً متنی برای ترجمه وارد کن.");
            setLoadingState(true, "در حال ترجمه... 🌍");

            const lang = targetLang?.value || "English";
            const result = await callChatAPI(
                `Translate the user's text to ${lang}. ONLY output the translation.`,
                text
            );

            showSuccess(`
                <strong>نتیجه ترجمه (${lang}):</strong>
                <p dir="auto">${result}</p>
            `);
        } 
        else if (type === "summarize") {
            if (!text) throw new Error("لطفاً متنی برای خلاصه‌سازی وارد کن.");
            setLoadingState(true, "در حال خلاصه‌سازی... 📝");

            const result = await callChatAPI(
                "You are an expert Persian summarizer. Summarize the input text in a few concise Persian sentences.",
                text
            );

            showSuccess(`
                <strong>نتیجه خلاصه:</strong>
                <p dir="auto">${result}</p>
            `);
        } 
        else if (type === "text_to_voice") {
            setLoadingState(true, "در حال تولید صدا... 🎤");
            await runTextToSpeech(text);
        } 
        else if (type === "speech_to_text") {
            setLoadingState(true, "در حال تبدیل صدا به متن... 🎧");
            await runSpeechToText(recordedBlob);
        } 
        else {
            throw new Error("نوع عملیات نامعتبر است.");
        }
    } catch (err) {
        console.error("Convert Error:", err);
        showError(err.message || "خطای نامشخص رخ داد.");
    } finally {
        setLoadingState(false);
    }
});

// ===================================================
// 🟦 تب‌ها
// ===================================================
tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        tabButtons.forEach(b => b.classList.remove("active"));
        tabContents.forEach(t => t.classList.remove("active"));

        btn.classList.add("active");

        const target = document.getElementById(btn.dataset.target);
        if (target) target.classList.add("active");
    });
});

// ===================================================
// 🟦 تغییر نوع عملیات
// ===================================================
convertType.addEventListener("change", updateUI);

// ===================================================
// 🟦 Theme Toggle ساده
// ===================================================
themeToggleBtn?.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    themeToggleBtn.textContent = document.body.classList.contains("dark") ? "🌙" : "☀️";
});

// ===================================================
// 🟦 Init
// ===================================================
updateUI();
