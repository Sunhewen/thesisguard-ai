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
  const currentUserId = userId || 'admin_mock_001'; 
  
  try {
    // 2. 讀取或建立資料庫使用者
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

    // 🌟 核心修改點：如果沒有傳入論文內容，代表是前端在進行「登入狀態與額度同步」
    if (!finalInput || finalInput.trim() === "") {
      return res.status(200).json({
        result: "Sync successful.",
        data: "Sync successful.",
        creditsRemains: (user.role === 'pro' || user.role === 'admin') ? '∞' : user.credits_remains,
        userRole: user.role
      });
    }

    // 3. 檢查次數（只有在真正要分析論文時才檢查）
    if (user.role !== 'pro' && user.role !== 'admin' && user.credits_remains <= 0) {
      return res.status(403).json({ error: 'You have run out of free credits. Please upgrade to Pro!' });
    }

    // 4. 檢查 Gemini API Key
    const apiKey = process.env.GEMINI_API_KEY; 
    if (!apiKey) {
      return res.status(500).json({ error: 'API key missing in Vercel settings' });
    }

    // 5. 呼叫 Google Gemini，賦予極致學術 Prompt 職責
    const systemInstruction = 
      "You are a premier, world-class academic editor and peer reviewer for top-tier international journals (e.g., Nature, Science, IEEE). " +
      "Analyze the provided thesis text and generate a premium, rigorous editorial feedback report in professional English. " +
      "Your feedback must be clearly structured into four sections using markdown titles:\n" +
      "### 1. Executive Summary & Tone Assessment\n" +
      "### 2. Grammar, Spelling & Syntax Corrections (Highlight exact changes)\n" +
      "### 3. Logical Flow & Argumentative Structure\n" +
      "### 4. Actionable Recommendations for Publication Standards\n" +
      "Maintain a critical, constructive, and scholarly tone.";

    // 修改後的網址（Pro）
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `${systemInstruction}\n\nHere is the user's academic text to analyze:\n--- \n${finalInput}\n ---` 
          }] 
        }],
        generationConfig: { 
          maxOutputTokens: 2500,
          temperature: 0.2 // 調低溫度，確保學術輸出高度嚴謹與穩定
        }
      })
    });

    const data = await response.json();
    
    // 如果 API 回傳非 200，抓取更精準的 Gemini 錯誤細節
    if (!response.ok) {
      console.error('Gemini API Error Detail:', JSON.stringify(data));
      return res.status(response.status).json({ 
        error: data.error?.message || 'Gemini API Error - Failed to fetch AI response.' 
      });
    }

    // 安全防禦：防止 Gemini 返回空的 candidates
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
      return res.status(502).json({ error: 'AI provider generated an empty response. Please try again.' });
    }

    const resultText = data.candidates[0].content.parts[0].text;

    // 6. 扣點邏輯（真正分析成功才扣點）
    let updatedCredits = user.credits_remains;
    if (user.role !== 'pro' && user.role !== 'admin') {
      updatedCredits = user.credits_remains - 1;
      await supabase
        .from('users')
        .update({ credits_remains: updatedCredits })
        .eq('id', currentUserId);
    }

    // 7. 正確回傳 JSON
    return res.status(200).json({ 
      result: resultText,
      data: resultText,
      creditsRemains: (user.role === 'pro' || user.role === 'admin') ? '∞' : updatedCredits,
      userRole: user.role
    });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: '伺服器內部錯誤: ' + error.message });
  }
};
