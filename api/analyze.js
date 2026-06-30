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

  // 讀取你在 Vercel 塞入的 Hugging Face 金鑰
  const apiKey = process.env.GEMINI_API_KEY; 
  
  if (!apiKey) {
    return res.status(500).json({ error: 'API key missing in Vercel settings' });
  }

  try {
    // 呼叫 Hugging Face 免費雲端大模型通道
    const response = await fetch('https://api-inference.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen2.5-72B-Instruct', 
        messages: [
          {
            role: 'system',
            content: 'You are an expert academic editor. Analyze the provided thesis text for logic, tone, grammar, spelling, and structure. Provide a professional, detailed review report in English with clear sections and actionable feedback.'
          },
          {
            role: 'user',
            content: finalInput // 將成功撈到的文字安全送給 AI
          }
        ],
        max_tokens: 2000
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Hugging Face Error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Hugging Face API Error' });
    }

    // 提取 AI 吐出來的精準學術報告文字
    const resultText = data.choices[0].message.content;
    
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
