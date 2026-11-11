
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
const logoutPlayerButton = document.getElementById('logoutPlayerButton');

// 玩家資料儲存名稱
const STORAGE_KEY = 'unoTeaPartyPlayer';

// 顯示玩家加入成功畫面
function showPlayerInfo(playerData) {
  joinSection.hidden = true;
  playerResult.hidden = false;

  joinedRoomName.textContent = playerData.room_name;
  joinedPlayerName.textContent = playerData.player_name;

  playerStatus.textContent = '玩家身分驗證成功！';
}

// 驗證玩家身分
async function verifyPlayer(playerData) {
  const { data, error } = await supabase.functions.invoke(
    'verify-player',
    {
      body: {
        room_code: playerData.room_code,
        player_id: playerData.player_id,
        player_token: playerData.player_token
      }
    }
  );

  if (error) {
    const verifyError = new Error(
      data?.error || error.message || '玩家身分驗證失敗'
    );

    verifyError.status = error.context?.status;
    throw verifyError;
  }

  if (
    !data?.success ||
    !data?.room ||
    !data?.player
  ) {
    throw new Error(data?.error || '驗證資料不完整');
  }

  return data;
}

// 初始化玩家頁面
async function initPlayerPage() {
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

    // 驗證期間暫時隱藏加入畫面
    joinSection.hidden = true;
    playerStatus.textContent = '正在確認玩家身分...';

    // 向後端驗證玩家 Token
    const result = await verifyPlayer(playerData);

    // 使用後端確認過的資料更新本機紀錄
    const verifiedData = {
      ...playerData,
      room_id: result.room.id,
      room_code: result.room.room_code,
      room_name: result.room.room_name,
      player_id: result.player.id,
      player_name: result.player.player_name
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(verifiedData)
    );

    // 驗證成功，恢復玩家畫面
    showPlayerInfo(verifiedData);

    console.log('玩家身分驗證成功：', {
      room_code: result.room.room_code,
      player_id: result.player.id,
      player_name: result.player.player_name
    });

  } catch (error) {
    console.error('玩家身分驗證失敗：', error);

    // Token 無效或玩家與房間不符
    if (error.status === 401 || error.status === 403) {
      localStorage.removeItem(STORAGE_KEY);

      playerResult.hidden = true;
      joinSection.hidden = false;

      playerStatus.textContent = '玩家身分已失效，請重新加入房間。';
      return;
    }

    // 其他錯誤可能只是網路或伺服器暫時異常
    // 保留原本 Token，避免誤刪玩家資料
    playerResult.hidden = true;
    joinSection.hidden = false;

    playerStatus.textContent =
      '目前無法確認玩家身分，請重新整理頁面再試一次。';
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

// 玩家登出
function logoutPlayer() {
  const confirmed = confirm(
    '確定要登出目前的玩家身分嗎？\n登出後需要重新加入房間。'
  );

  if (!confirmed) {
    return;
  }

  // 清除本機玩家資料，不刪除資料庫紀錄
  localStorage.removeItem(STORAGE_KEY);

  // 恢復加入房間畫面
  playerResult.hidden = true;
  joinSection.hidden = false;

  // 清除原本的玩家資訊
  joinedRoomName.textContent = '';
  joinedPlayerName.textContent = '';

  // 更新提示
  playerStatus.textContent = '已登出玩家身分，歡迎重新加入！';
  message.textContent = '';

  // 清空輸入欄位
  roomCodeInput.value = '';
  playerNameInput.value = '';

  console.log('玩家已登出');
}

// 綁定事件
joinForm.addEventListener('submit', joinRoom);
logoutPlayerButton.addEventListener('click', logoutPlayer);

// 啟動頁面
initPlayerPage();
