
import { supabase } from './supabase.js';

async function testConnection() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    console.log('Supabase Client 初始化成功！');
    console.log('目前登入狀態：', data.session ? '已登入' : '尚未登入');

  } catch (err) {
    console.error('連線初始化失敗：', err.message);
  }
}

testConnection();
