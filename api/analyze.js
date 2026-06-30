export default async function handler(req, res) {
  // 唯有 POST 請求才能放行
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 【通訊修正】精確讀取前端傳過來的 essay 欄位
  const { essay } = req.body;
  if (!essay) {
    return res.status(400).json({ error: 'essay is required' });
  }

  // 讀取你在 Vercel 塞入的 Hugging Face 金鑰
  const apiKey = process.env.GEMINI_API_KEY; 
  
  if (!apiKey) {
    return res.status(500).json({ error: 'API key missing in Vercel settings' });
  }

  try {
    // 呼交 Hugging Face 免費雲端大模型通道
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
            content: essay // 將前端傳來的論文內容安全送給 AI
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
    
    // 回傳前端指定的 { result: ... } 格式，完美啟動「吐報告」＋「扣次數」
    return res.status(200).json({ result: resultText });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
