const { supabase } = require('./lib/supabase');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { essay, text, content, userId, userEmail } = req.body;
  const finalInput = essay || text || content;

  if (!finalInput) {
    return res.status(400).json({ error: 'Please enter some thesis text.' });
  }

  // 1. 讀取安全金鑰
  const apiKey = process.env.GEMINI_API_KEY; 
  if (!apiKey) {
    return res.status(500).json({ error: 'API key missing in Vercel settings' });
  }

  // 2. 檢查使用者點數與身份
  const currentUserId = userId || 'admin_mock_001'; 
  
  let { data: user, error: dbError } = await supabase
    .from('users')
    .select('*')
    .eq('id', currentUserId)
    .single();

  // 如果找不到這個使用者，自動在資料庫建立
  if (!user || dbError) {
    const mockEmail = userEmail || 'test_user@example.com';
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([{ id: currentUserId, email: mockEmail, role: 'user', credits_remains: 3 }])
      .select()
      .single();
    
    user = newUser;
  }

  // 判斷次數
  if (user.role !== 'pro' && user.credits_remains <= 0) {
    return res.status(403).json({ error: 'You have run out of free credits. Please upgrade to Pro!' });
  }

  try {
    // 3. 呼叫 Google Gemini 2.5 Flash
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

    // 4. 扣點邏輯
    if (user.role !== 'pro') {
      await supabase
        .from('users')
        .update({ credits_remains: user.credits_remains - 1 })
        .eq('id', currentUserId);
    }

    // 回傳結果給前端，預留欄位給接下來的 Stripe
    return res.status(200).json({ 
      result: resultText,
      data: resultText,
      creditsRemains: user.role === 'pro' ? '∞' : user.credits_remains - 1,
      userRole: user.role
    });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
