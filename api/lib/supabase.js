const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// 建立一個全域通用的資料庫連線實例
const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = { supabase };
