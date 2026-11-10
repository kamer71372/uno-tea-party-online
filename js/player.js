
import { supabase } from './supabase.js';

// 取得頁面元素
const joinForm = document.getElementById('joinForm');
const joinSection = document.getElementById('joinSection');
const playerResult = document.getElementById('playerResult');

const roomCodeInput = document.getElementById('roomCode');
const playerNameInput = document.getElementById('playerName');
const joinButton = document.getElementById('joinButton');

const playerStatus = document.getElementById('playerStatus');
const joinedRoomName = document.getElementById('joinedRoomName');
const joinedPlayerName = document.getElementById('joinedPlayerName');
const message = document.getElementById('message');

// 玩家資料儲存名稱
const STORAGE_KEY = 'unoTeaPartyPlayer';

// 顯示玩家加入成功畫面
function showPlayerInfo(playerData) {
  joinSection.hidden = true;
  playerResult.hidden = false;

  joinedRoomName.textContent = playerData.room_name;
  joinedPlayerName.textContent = playerData.player_name;

  playerStatus.textContent = '已記住這台裝置的玩家資料';
}

// 初始化玩家頁面
function initPlayerPage() {
  const savedData = localStorage.getItem(STORAGE_KEY);

  if (!savedData) {
    playerStatus.textContent = '歡迎參加茶會！';
    return;
  }

  try {
    const playerData = JSON.parse(savedData);

    if (
      !playerData.room_code ||
      !playerData.player_id ||
      !playerData.player_token
    ) {
      throw new Error('玩家資料不完整');
    }

    // 顯示上次儲存的玩家資料
    showPlayerInfo(playerData);

  } catch (error) {
    console.error('讀取玩家資料失敗：', error);
    localStorage.removeItem(STORAGE_KEY);
    playerStatus.textContent = '歡迎參加茶會！';
  }
}

// 加入遊戲房間
async function joinRoom(event) {
  event.preventDefault();

  const roomCode = roomCodeInput.value.trim();
  const playerName = playerNameInput.value.trim();

  if (!/^\d{6}$/.test(roomCode)) {
    message.textContent = '請輸入正確的六位數房間代碼。';
    message.style.color = 'red';
    return;
  }

  if (!playerName || playerName.length > 20) {
    message.textContent = '玩家姓名請輸入 1-20 個字元。';
    message.style.color = 'red';
    return;
  }

  joinButton.disabled = true;
  joinButton.textContent = '加入中...';
  message.textContent = '';

  try {
    // 呼叫 Supabase join-room
    const { data, error } = await supabase.functions.invoke(
      'join-room',
      {
        body: {
          room_code: roomCode,
          player_name: playerName
        }
      }
    );

    if (error) {
      console.error('加入房間錯誤：', error);
      throw new Error(
        data?.error || error.message || '加入房間失敗'
      );
    }

    if (
      !data?.success ||
      !data?.room ||
      !data?.player ||
      !data?.player_token
    ) {
      throw new Error(data?.error || '伺服器回傳資料不完整');
    }

    // 儲存玩家身分
    const playerData = {
      room_id: data.room.id,
      room_code: data.room.room_code,
      room_name: data.room.room_name,
      player_id: data.player.id,
      player_name: data.player.player_name,
      player_token: data.player_token
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(playerData)
    );

    // 顯示加入成功
    showPlayerInfo(playerData);

    message.textContent = '成功加入遊戲房間！';
    message.style.color = 'green';

    console.log('玩家加入成功：', {
      room_code: data.room.room_code,
      player_id: data.player.id,
      player_name: data.player.player_name
    });

  } catch (error) {
    console.error('加入房間失敗：', error);
    message.textContent = error.message;
    message.style.color = 'red';

  } finally {
    joinButton.disabled = false;
    joinButton.textContent = '加入房間';
  }
}

// 綁定事件
joinForm.addEventListener('submit', joinRoom);

// 啟動頁面
initPlayerPage();
