
import { supabase } from './supabase.js';

// 頁面元素
const hostStatus = document.getElementById('hostStatus');
const roomSection = document.getElementById('roomSection');
const createRoomButton = document.getElementById('createRoomButton');
const roomNameInput = document.getElementById('roomName');
const message = document.getElementById('message');
const roomResult = document.getElementById('roomResult');
const roomCode = document.getElementById('roomCode');
const roomInfo = document.getElementById('roomInfo');
const playerList = document.getElementById('playerList');
const playerCount = document.getElementById('playerCount');
const realtimeStatus = document.getElementById('realtimeStatus');
const logoutButton = document.getElementById('logoutButton');

// 房間管理元素
const roomLockStatus = document.getElementById('roomLockStatus');
const lockRoomButton = document.getElementById('lockRoomButton');
const unlockRoomButton = document.getElementById('unlockRoomButton');
const roomManagementMessage = document.getElementById('roomManagementMessage');

let currentRoom = null;
let playerChannel = null;

// 更新房間鎖定畫面
function renderRoomLockStatus(isLocked) {
  if (isLocked) {
    roomLockStatus.textContent = '🔒 房間已鎖定，禁止新玩家加入';
    lockRoomButton.hidden = true;
    unlockRoomButton.hidden = false;
  } else {
    roomLockStatus.textContent = '🟢 房間開放加入中';
    lockRoomButton.hidden = false;
    unlockRoomButton.hidden = true;
  }
}

// 顯示玩家名單
function renderPlayers(players) {
  playerCount.textContent = `${players.length} 人`;

  playerList.replaceChildren();

  if (players.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = '目前還沒有玩家加入。';
    playerList.appendChild(emptyMessage);
    return;
  }

  players.forEach((player, index) => {
    const item = document.createElement('div');
    item.className = 'player-item';

    const name = document.createElement('strong');
    name.textContent = `${index + 1}. ${player.player_name}`;

    const time = document.createElement('small');
    time.textContent =
      `加入時間：${new Date(player.joined_at).toLocaleString('zh-TW', {
        hour12: false
      })}`;

    item.append(name, time);
    playerList.appendChild(item);
  });
}

// 從資料庫讀取目前玩家
async function loadPlayers(roomId) {
  const { data, error } = await supabase
    .from('players')
    .select('id, player_name, joined_at')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('讀取玩家名單失敗：', error);
    realtimeStatus.textContent = '玩家名單讀取失敗';
    return;
  }

  renderPlayers(data || []);
}

// 啟動即時玩家監聽
async function startPlayerRealtime(roomId) {
  if (playerChannel) {
    await supabase.removeChannel(playerChannel);
    playerChannel = null;
  }

  realtimeStatus.textContent = '正在連線即時更新...';

  playerChannel = supabase
    .channel(`players-room-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomId}`
      },
      async (payload) => {
        console.log('新玩家加入：', payload.new);
        await loadPlayers(roomId);
      }
    )
    .subscribe((status) => {
      console.log('Realtime 狀態：', status);

      if (status === 'SUBSCRIBED') {
        realtimeStatus.textContent = '🟢 即時更新已連線';
      } else if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT'
      ) {
        realtimeStatus.textContent = '即時連線失敗，請重新整理頁面';
      } else if (status === 'CLOSED') {
        realtimeStatus.textContent = '即時連線已關閉';
      }
    });

  await loadPlayers(roomId);
}

// 顯示房間資料並啟動玩家監聽
async function showRoom(room) {
  currentRoom = room;

  roomCode.textContent = room.room_code;
  roomInfo.textContent = `房間名稱：${room.room_name}`;
  roomResult.hidden = false;

  // 顯示目前房間鎖定狀態
  renderRoomLockStatus(Boolean(room.is_locked));

  roomManagementMessage.textContent = '';

  await startPlayerRealtime(room.id);
}

// 鎖定或解鎖房間
async function updateRoomLock(isLocked) {
  if (!currentRoom) {
    roomManagementMessage.textContent = '目前沒有可管理的房間。';
    return;
  }

  lockRoomButton.disabled = true;
  unlockRoomButton.disabled = true;

  roomManagementMessage.textContent =
    isLocked ? '正在鎖定房間...' : '正在解鎖房間...';

  try {
    // 取得主持人登入資訊
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const session = sessionData.session;

    if (!session) {
      throw new Error('登入已失效，請重新登入。');
    }

    // 呼叫 lock-room Edge Function
    const { data, error } = await supabase.functions.invoke(
      'lock-room',
      {
        body: {
          room_id: currentRoom.id,
          is_locked: isLocked
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );

    if (error) {
      console.error('房間管理錯誤：', error);
      throw new Error(
        data?.error || error.message || '更新房間狀態失敗'
      );
    }

    if (!data?.success || !data?.room) {
      throw new Error(data?.error || '伺服器回傳資料不完整');
    }

    // 更新目前房間資料
    currentRoom = {
      ...currentRoom,
      ...data.room
    };

    // 更新畫面
    renderRoomLockStatus(data.room.is_locked);

    roomManagementMessage.textContent = data.message;
    roomManagementMessage.style.color = 'green';

    console.log('房間狀態更新成功：', data.room);

  } catch (error) {
    console.error('更新房間狀態失敗：', error);

    roomManagementMessage.textContent = error.message;
    roomManagementMessage.style.color = 'red';

  } finally {
    lockRoomButton.disabled = false;
    unlockRoomButton.disabled = false;
  }
}

// 初始化主持人控制台
async function initHostPage() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (!data.session) {
      window.location.href = './host-login.html';
      return;
    }

    hostStatus.textContent = '主持人已登入';
    roomSection.hidden = false;

    // 找出這位主持人最近建立的房間
    const { data: rooms, error: roomError } = await supabase
      .from('game_rooms')
      .select('id, room_code, room_name, status, is_locked, created_at')
      .eq('host_user_id', data.session.user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (roomError) {
      console.error('讀取房間失敗：', roomError);
      return;
    }

    if (rooms && rooms.length > 0) {
      await showRoom(rooms[0]);
    }

  } catch (error) {
    console.error('控制台初始化失敗：', error);
    hostStatus.textContent = '無法載入控制台，請重新登入。';
  }
}

// 建立新房間
async function createRoom() {
  const roomName = roomNameInput.value.trim();

  if (!roomName || roomName.length > 40) {
    message.textContent = '房間名稱請輸入 1-40 個字元。';
    message.style.color = 'red';
    return;
  }

  createRoomButton.disabled = true;
  createRoomButton.textContent = '建立中...';
  message.textContent = '';
  roomResult.hidden = true;

  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const session = sessionData.session;

    if (!session) {
      throw new Error('登入已失效，請重新登入。');
    }

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

    message.textContent = '房間建立成功！';
    message.style.color = 'green';

    console.log('房間建立成功：', data.room);

    await showRoom(data.room);

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

  if (playerChannel) {
    await supabase.removeChannel(playerChannel);
    playerChannel = null;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('登出失敗：', error);
    alert('登出失敗，請稍後再試。');
    return;
  }

  window.location.href = './host-login.html';
}

// 綁定按鈕
createRoomButton.addEventListener('click', createRoom);
lockRoomButton.addEventListener('click', () => {
  updateRoomLock(true);
});
unlockRoomButton.addEventListener('click', () => {
  updateRoomLock(false);
});
logoutButton.addEventListener('click', logout);

// 監聽登出狀態
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    window.location.href = './host-login.html';
  }
});

// 啟動控制台
initHostPage();
