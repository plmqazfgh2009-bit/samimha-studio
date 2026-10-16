
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "samimha-studio-ultimate.html")
  );
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "مفتاح Gemini غير مضبوط في إعدادات السيرفر."
      });
    }

    const messages = Array.isArray(req.body.messages)
      ? req.body.messages.slice(-16)
      : [];

    const contents = messages
      .filter(m =>
        ["user", "assistant", "model"].includes(m.role) &&
        typeof m.content === "string"
      )
      .map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content.slice(0, 6000) }]
      }));

    if (!contents.length) {
      return res.status(400).json({
        error: "اكتب رسالة أولاً."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "أنت رفيقة صمّمها، مساعدة ذكية وودودة. أجيبي بالعربية، وساعدي المستخدم في التصميم والبرمجة والأسئلة العامة."
            }]
          },
          contents,
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1500
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);
      return res.status(502).json({
        error: "تعذر الحصول على جواب من Gemini. تحقق من المفتاح والحصة المتاحة."
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(p => p.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Gemini لم يرجع جواباً. جرب مرة ثانية."
      });
    }

    res.json({ reply, mode: "gemini" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "صار خطأ في السيرفر. حاول مرة ثانية."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
