
import { supabase } from './supabase.js';

const loginForm = document.getElementById('loginForm');
const message = document.getElementById('message');
const loginButton = document.getElementById('loginButton');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  loginButton.disabled = true;
  loginButton.textContent = '登入中...';
  message.textContent = '';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('無法取得使用者資料');
    }

    message.textContent = '登入成功！';
    message.style.color = 'green';

    console.log('主持人登入成功');
    console.log('User ID:', data.user.id);
    // 登入成功後，前往主持人控制台
    setTimeout(() => {
        window.location.href = './host.html';
    }, 800);

  } catch (error) {
    console.error('登入失敗:', error.message);
    message.textContent = '登入失敗，請確認 Email 與密碼。';
    message.style.color = 'red';

  } finally {
    loginButton.disabled = false;
    loginButton.textContent = '登入';
  }
});
