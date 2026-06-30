const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

// 用 try-catch 包裹，防止環境變數空白時整台伺服器直接炸裂
try {
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (e) {
  console.error("Supabase 初始化失敗:", e);
}

module.exports = { supabase };
