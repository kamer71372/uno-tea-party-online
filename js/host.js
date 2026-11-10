
import { supabase } from './supabase.js';

// 取得頁面元素
const hostStatus = document.getElementById('hostStatus');
const roomSection = document.getElementById('roomSection');
const createRoomButton = document.getElementById('createRoomButton');
const roomNameInput = document.getElementById('roomName');
const message = document.getElementById('message');
const roomResult = document.getElementById('roomResult');
const roomCode = document.getElementById('roomCode');
const roomInfo = document.getElementById('roomInfo');
const logoutButton = document.getElementById('logoutButton');

// 目前登入的主持人
let currentSession = null;

// 初始化主持人控制台
async function initHostPage() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (!data.session) {
      alert('請先登入主持人帳號！');
      window.location.href = './host-login.html';
      return;
    }

    currentSession = data.session;

    hostStatus.textContent = '主持人已登入';
    roomSection.hidden = false;

  } catch (error) {
    console.error('登入狀態確認失敗：', error);
    hostStatus.textContent = '無法確認登入狀態，請重新登入。';
  }
}

// 建立遊戲房間
async function createRoom() {
  const roomName = roomNameInput.value.trim();

  if (!roomName) {
    message.textContent = '請輸入房間名稱！';
    return;
  }

  createRoomButton.disabled = true;
  createRoomButton.textContent = '建立中...';
  message.textContent = '';
  roomResult.hidden = true;

  try {
    // 重新取得最新登入 Session
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const session = sessionData.session;

    if (!session) {
      throw new Error('登入已失效，請重新登入。');
    }

    currentSession = session;

    // 呼叫 Supabase Edge Function
    const { data, error } = await supabase.functions.invoke(
      'create-room',
      {
        body: {
          room_name: roomName
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );

    if (error) {
      console.error('Edge Function 錯誤：', error);
      throw new Error(
        data?.error || error.message || '建立房間失敗'
      );
    }

    if (!data?.success || !data?.room) {
      throw new Error(data?.error || '伺服器沒有回傳房間資料');
    }

    // 顯示建立成功的房間資料
    roomCode.textContent = data.room.room_code;
    roomInfo.textContent =
      `房間名稱：${data.room.room_name}`;

    roomResult.hidden = false;

    message.textContent = '房間建立成功！';
    message.style.color = 'green';

    console.log('房間建立成功：', data.room);

  } catch (error) {
    console.error('建立房間失敗：', error);

    message.textContent = error.message;
    message.style.color = 'red';

  } finally {
    createRoomButton.disabled = false;
    createRoomButton.textContent = '建立新房間';
  }
}

// 登出
async function logout() {
  const confirmed = confirm('確定要登出主持人帳號嗎？');

  if (!confirmed) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('登出失敗：', error);
    alert('登出失敗，請稍後再試。');
    return;
  }

  window.location.href = './host-login.html';
}

// 綁定按鈕事件
createRoomButton.addEventListener('click', createRoom);
logoutButton.addEventListener('click', logout);

// 監聽登入狀態變化
supabase.auth.onAuthStateChange((event, session) => {
  currentSession = session;

  if (event === 'SIGNED_OUT') {
    window.location.href = './host-login.html';
  }
});

// 啟動頁面
initHostPage();
