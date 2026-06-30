export default async function handler(req, res) {
  // 唯有 POST 請求才能放行
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  // 這裡依然讀取這個變數名稱，但裡面此時放的是 Hugging Face 金鑰
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
        model: 'Qwen/Qwen2.5-72B-Instruct', // 目前免綁卡最強大的 720 億參數學術邏輯大模型
        messages: [
          {
            role: 'system',
            content: 'You are an expert academic editor. Analyze the provided thesis text for logic, tone, grammar, spelling, and structure. Provide a professional, detailed review report in English with clear sections and actionable feedback.'
          },
          {
            role: 'user',
            content: text
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

    // 成功抓取 AI 吐出來的精準學術報告
    const resultText = data.choices[0].message.content;
    return res.status(200).json({ result: resultText });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
