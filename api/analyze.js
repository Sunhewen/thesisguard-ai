export default async function handler(req, res) {
  // 唯有 POST 請求才能放行
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 【超級包容邏輯】不管前端工程當初打包叫 essay、text 還是 content，通通撈出來！
  const { essay, text, content } = req.body;
  const finalInput = essay || text || content;

  // 如果這三個口袋都是空的，才叫使用者填字
  if (!finalInput) {
    return res.status(400).json({ error: 'Please enter some thesis text.' });
  }

  // 讀取你在 Vercel 塞入的 Gemini 官方金鑰
  const apiKey = process.env.GEMINI_API_KEY; 
  
  if (!apiKey) {
    return res.status(500).json({ error: 'API key missing in Vercel settings' });
  }

  try {
    // 【模型修正】全面切換為極度穩定的官方標準 gemini-pro 模型
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Please analyze this thesis text:\n\n${finalInput}`
              }
            ]
          }
        ],
        // 舊款模型不支援獨立的 systemInstruction，我們直接優雅地合併進去，相容性 100%
        generationConfig: {
          maxOutputTokens: 2000
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Gemini API Error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API Error' });
    }

    // 安全地提取 Gemini 吐出來的精準學術報告文字
    if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
      console.error('Unexpected Gemini Response Format:', data);
      return res.status(500).json({ error: 'Invalid response from AI model' });
    }

    const resultText = data.candidates[0].content.parts[0].text;
    
    // 同時回傳前端可能在等的欄位，確保報告顯現＋扣次數一次滿足
    return res.status(200).json({ 
      result: resultText,
      data: resultText 
    });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
