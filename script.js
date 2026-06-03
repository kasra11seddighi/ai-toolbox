const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab");
const convertBtn = document.getElementById("convert-btn");
const resultText = document.getElementById("result-text");
const recordBtn = document.getElementById("record-btn");
const audioUpload = document.getElementById("audio-upload");
const statusText = document.getElementById("status-text");
const resultBox = document.getElementById("result-box")
const convertType = document.getElementById("convert-type")
const audioControls = document.getElementById("audio-controls")
const inputText = document.getElementById("input-text")
const voiceSelect = document.getElementById("voice-select");
const voicelabel=document.getElementById("label")
let mediaRecorder;
let audioChunks = [];
let recordedBlob = null;

// ===================================================
// 🟦 1. مدیریت تب‌ها
// ===================================================

function activateTab(targetId) {

    tabButtons.forEach(btn => btn.classList.remove("active"));
    tabContents.forEach(tab => tab.classList.remove("active"));

    document.getElementById(targetId)?.classList.add("active");
}

tabButtons.forEach(button => {
    button.addEventListener("click", () => {

        const target = button.getAttribute("data-target");

        tabButtons.forEach(b => b.classList.remove("active"));
        button.classList.add("active");

        activateTab(target);
    });
});


// ===================================================
// 🟦 2. مدیریت تم (Light / Dark)
// ===================================================

const themeToggleBtn = document.getElementById("theme-toggle");

if (themeToggleBtn) {

    themeToggleBtn.addEventListener("click", () => {

        const isLight = document.body.classList.toggle("light");

        themeToggleBtn.innerHTML = isLight ? "🌙" : "☀️";
    });
}


// ===================================================
// 🟦 3. مدیریت UI مبدل (updateUI)
// ===================================================
function updateUI() {

    resultBox.style.display = "none";

    const type = convertType.value;

    const isSpeechToText = type === "speech_to_text";
    const isTextToVoice = type === "text_to_voice";
    const isSummarize = type === "summarize";

    // نمایش یا مخفی کردن input
    inputText.style.display = isSpeechToText ? "none" : "block";

    // کنترل‌های ضبط صدا
    audioControls.style.display = isSpeechToText ? "flex" : "none";

    // انتخاب نوع صدا
    voiceSelect.style.display = isTextToVoice ? "block" : "none";
    voicelabel.style.display = isTextToVoice ? "block" : "none";

    // تغییر placeholder
    if (isTextToVoice) {

        inputText.placeholder = "متنی که می‌خوای به ویس تبدیل بشه رو بنویس... 🔊";

    } else if (isSummarize) {

        inputText.placeholder = "متنی که می‌خوای خلاصه بشه رو اینجا بنویس... 📝";

    } else {

        inputText.placeholder = "متن فارسی رو بنویس تا به انگلیسی ترجمه بشه... 🌍";
    }
}



convertBtn.addEventListener("click", async () => {
    const type = convertType.value;
    const text = inputText.value.trim();

    resultBox.style.display = "block";
    resultText.innerHTML = "<em>در حال پردازش... ⏳</em>";

    try {
        if (type === "translate_en") {
            if (!text) throw new Error("لطفاً متن را وارد کن");
            await runTranslate(text);
        } 
        else if (type === "summarize") {
            if (!text) throw new Error("لطفاً متن را برای خلاصه‌سازی وارد کن");
            const summary = await runSummarize(text);
            resultText.innerHTML = `<strong>نتیجه خلاصه:</strong><p>${summary}</p>`;
        } 
        else if (type === "text_to_voice") {
            if (!text) throw new Error("لطفاً متن را برای تبدیل به صدا وارد کن");
            await runTextToSpeech(text);
        }
        else if (type === "speech_to_text") {
            if (!recordedBlob) {
                throw new Error("ابتدا صدا ضبط کن یا فایل صوتی بارگذاری کن 🎙️");
            }
            statusText.textContent = "⏳ در حال ارسال به سرور...";
            await runSpeechToText(recordedBlob);
        }
        else {
            throw new Error("نوع عملیات نامعتبر است");
        }

    } catch (err) {
        resultText.innerHTML = `<span style="color:red;">خطا: ${err.message}</span>`;
    }
});





// ===================================================
// ✨ عملیات‌ها (ترجمه، خلاصه، متن به ویس)
// ===================================================


const ApiKey = "sk-aPgNdDH4FFRkyxYgrUrjEa2c8mtoAkbwzZf9QWEjHcExBctQ"


// 🟢 ترجمه به انگلیسی
async function runTranslate(text) {
    resultText.innerHTML = "در حال ترجمه...";

    try {
        const res = await fetch("https://api.gapgpt.app/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ApiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
     messages: [
  {
    role: "system",
    content: `
You are a professional technical translator.

Rules:
- Translate ONLY.
- Do NOT summarize.
- Do NOT explain.
- Do NOT add commentary.
- Do NOT add headings or labels.
- Output only the translated text.
- Preserve all technical meaning.
- Use natural, publication-quality English.
`
  },
  {
    role: "user",
    content: `
Translate the following Persian text into professional English.

Persian Text:
${text}
`
  }
]
                   


            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Translate API Error:", errorText);
            throw new Error("خطا در ترجمه");
        }

        const data = await res.json();

        if (!data.choices || !data.choices.length) {
            throw new Error("پاسخ ترجمه معتبر نیست");
        }

        const result = data.choices[0].message.content;

        resultText.innerHTML = `
            <strong>نتیجه ترجمه:</strong>
            <p dir="ltr" style="font-family:Arial">${result}</p>
        `;
    } catch (error) {
        console.error(error);
        resultText.innerHTML = `<span style="color:red;">${error.message}</span>`;
    }
}


// 🟣 خلاصه‌سازی متن
async function runSummarize(inputText) {
    const response = await fetch("https://api.gapgpt.app/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ApiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.3,
messages: [
  {
    role: "system",
    content:`
                You are an expert AI for high‑quality text summarization.
                Your task is to analyze the input text and produce a clear, accurate and concise summary.
                Do not add new information that is not present in the text.
            `
  },
  {
    role: "user",
    content:`
                 متن زیر را خلاصه کن

                قوانین:
                - خلاصه باید بین 3 تا 5 جمله باشد.
                - فقط نکات اصلی و مفاهیم کلیدی را نگه دار.
                - مثال‌ها، توضیحات اضافی و تکرارها را حذف کن.
                - اطلاعات جدید اضافه نکن.
                - خلاصه باید روان و واضح باشد.
                - مفهوم اصلی متن باید حفظ شود.

                خلاصه:

                ${inputText}
            `               
  }
]

        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error Details:", errorData);
        throw new Error("خطا در پاسخ سرور");
    }

    const data = await response.json();
    console.log("Response Data:", data); // اینجا در کنسول چک کن

    if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content;
    } else {
        throw new Error("پاسخ معتبری دریافت نشد");
    }
}


// 🔵 تبدیل متن به ویس 
async function runTextToSpeech(inputText) {
    try {

        let selectedVoice = voiceSelect.value;
        const response = await fetch("https://api.gapgpt.app/v1/audio/speech", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ApiKey}`
            },
            body: JSON.stringify({
                model: "tts-1",
                input: inputText,
                voice: `${selectedVoice}`
            })
        });

        if (!response.ok) {
            throw new Error("خطا در سرویس تبدیل متن به صدا");
        }

        const blob = await response.blob();

        const audioUrl = URL.createObjectURL(blob);

        // حذف autoplay
        resultText.innerHTML = `
            <p>فایل صوتی آماده شد 🎧</p>
            <audio controls style="width:100%;">
                <source src="${audioUrl}" type="audio/mpeg">
            </audio>
        `;

    } catch (err) {
        console.error(err);

        resultText.innerHTML = `
            <span style="color:red;">
                خطا در تولید صدا: ${err.message}
            </span>
        `;
    }
}


// 🔴 تبدیل ویس به متن 

recordBtn.addEventListener("click", async () => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
                recordedBlob = new File([audioBlob], "recording.webm", { type: "audio/webm" });

                stream.getTracks().forEach(track => track.stop());
                statusText.textContent = "ضبط تمام شد ✅ آماده تبدیل!";
            };

            mediaRecorder.start();
            statusText.textContent = "در حال ضبط... 🎤 برای توقف دوباره کلیک کن";
        } catch (err) {
            console.error("Microphone error:", err);
            statusText.textContent = "خطا در دسترسی به میکروفون";
        }
    } else {
        mediaRecorder.stop();
        statusText.textContent = "در حال پردازش فایل...";
    }
});

audioUpload.addEventListener("change", () => {
    const file = audioUpload.files[0];

    if (!file) return;

    recordedBlob = file;
    statusText.textContent = `فایل «${file.name}» آماده تبدیل است ✅`;
});

async function runSpeechToText(blobOrFile) {
    try {
        statusText.textContent = "⏳ در حال ارسال فایل به سرور...";

        const formData = new FormData();
        formData.append("file", blobOrFile);
        formData.append("model", "whisper-1");
        // formData.append("language", "fa"); // در صورت نیاز

        const response = await fetch(
            "https://api.gapgpt.app/v1/audio/transcriptions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${ApiKey}`
                },
                body: formData
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                errorText || `خطای سرور (کد ${response.status})`
            );
        }

        const data = await response.json();

        if (!data.text || data.text.trim() === "") {
            throw new Error("متنی از فایل صوتی استخراج نشد");
        }
        statusText.textContent = "در حال اصلاح متن...";
        const fixedText = await fixPersianSpelling(data.text);
        statusText.textContent = "✅ تبدیل و اصلاح متن انجام شد";
         renderSTTResult(fixedText);
   
    } catch (err) {
        console.error("STT Error:", err);

        statusText.textContent = "❌ خطا در تبدیل صدا به متن";
        renderSTTError(err.message);
    }
}


function renderSTTResult(text) {
    resultBox.style.display = "block";
    resultText.innerHTML = `
        <h4>🎧 متن استخراج‌شده:</h4>
        <p style="line-height:1.7; color:#ffffff;">
            ${text}
        </p>
    `;
}

function renderSTTError(message) {
    resultBox.style.display = "block";
    resultText.innerHTML = `
        <h4 style="color:#ff6b6b;">⚠️ خطا</h4>
        <p style="color:#ff6b6b; line-height:1.6;">
            ${message}
        </p>
    `;
}

//اصلاح متن 
async function fixPersianSpelling(text) {
    const response = await fetch("https://api.gapgpt.app/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ApiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "متن فارسی را فقط از نظر غلط املایی و نگارشی اصلاح کن و همان متن اصلاح‌شده را برگردان."
                },
                {
                    role: "user",
                    content: text
                }
            ]
        })
    });

    const data = await response.json();
    return data.choices[0].message.content.trim();
}


//****************************************************/




// اجرا هنگام تغییر نوع تبدیل
updateUI();
convertType.addEventListener("change", updateUI);
