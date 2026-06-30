// api/analyze.js
// Vercel 雲端後端安全通道：負責接收前端資料並加上 API Key 傳給 Google Gemini

module.exports = async (req, res) => {
    // 限制只允許 POST 請求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { essayText } = req.body;
    if (!essayText) {
        return res.status(400).json({ error: 'Essay text is required.' });
    }

    // 從 Vercel 環境變數中抓取真實的 Key，絕不暴露在外
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server configuration error: Missing Gemini API Key.' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    
    // 設定高階學術期刊編輯的 Prompt 靈魂
    const systemPrompt = "You are a world-class academic journal editor. Review the following text for spelling, logic errors, sentence structure, and academic tone. Provide feedback using clean bullet points and professional wording. Response must be in English.";

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "contents": [{
                    "parts": [{
                        "text": `${systemPrompt}\n\nUser Essay:\n${essayText}`
                    }]
                }]
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            return res.status(response.status).json({ error: 'Gemini API Error', details: errData });
        }

        const data = await response.json();
        const replyText = data.candidates[0].content.parts[0].text;
        
        // 將 Gemini 的審查報告安全回傳給前台
        return res.status(200).json({ text: replyText });

    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};