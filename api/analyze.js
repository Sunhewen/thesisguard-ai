const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  // 確保是 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. 安全防禦：檢查 Supabase 是否有成功連線
  if (!supabase) {
    return res.status(500).json({ 
      error: 'Supabase 未初始化。請確保已在 Vercel Settings -> Environment Variables 中設定 SUPABASE_URL 與 SUPABASE_ANON_KEY！' 
    });
  }

  const { essay, text, content, userId, userEmail } = req.body;
  const finalInput = essay || text || content;

  if (!finalInput) {
    return res.status(400).json({ error: 'Please enter some thesis text.' });
  }

  // 2. 檢查 Gemini API Key
  const apiKey = process.env.GEMINI_API_KEY; 
  if (!apiKey) {
    return res.status(500).json({ error: 'API key missing in Vercel settings' });
  }

  const currentUserId = userId || 'admin_mock_001'; 
  
  try {
    // 3. 讀取或建立資料庫使用者
    let { data: user, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUserId)
      .single();

    if (!user || dbError) {
      const mockEmail = userEmail || 'test_user@example.com';
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{ id: currentUserId, email: mockEmail, role: 'user', credits_remains: 3 }])
        .select()
        .single();
      
      user = newUser;
    }

    // 4. 判斷次數
    if (user.role !== 'pro' && user.role !== 'admin' && user.credits_remains <= 0) {
      return res.status(403).json({ error: 'You have run out of free credits. Please upgrade to Pro!' });
    }

    // 5. 呼叫 Google Gemini 2.5 Flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are an expert academic editor. Analyze the provided thesis text for logic, tone, grammar, spelling, and structure. Provide a professional, detailed review report in English with clear sections and actionable feedback.\n\nHere is the thesis text:\n${finalInput}` }] }],
        generationConfig: { maxOutputTokens: 2000 }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API Error' });
    }

    const resultText = data.candidates[0].content.parts[0].text;

    // 6. 扣點邏輯
    if (user.role !== 'pro' && user.role !== 'admin') {
      await supabase
        .from('users')
        .update({ credits_remains: user.credits_remains - 1 })
        .eq('id', currentUserId);
    }

    // 7. 正確回傳 JSON
    return res.status(200).json({ 
      result: resultText,
      data: resultText,
      creditsRemains: (user.role === 'pro' || user.role === 'admin') ? '∞' : user.credits_remains - 1,
      userRole: user.role
    });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: '伺服器內部錯誤: ' + error.message });
  }
};
