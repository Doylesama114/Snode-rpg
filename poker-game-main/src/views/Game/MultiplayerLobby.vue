<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useMultiplayer } from '@/composables/useMultiplayer'
import { useRouter } from 'vue-router'
import { getServerUrl, getServerUrlByMode, saveServerUrl, type ServerMode } from '@/config/multiplayer'
import type { AccountState } from '@/types/game'
import {
  readAccountState,
  writeAccountState,
  migrateAccountState,
  getActiveDeckSlot,
  switchActiveDeckSlot,
} from '@/utils/deckSlots'
import ServerConfigDialog from './ServerConfigDialog.vue'

const router = useRouter()
const {
  connected,
  currentRoom,
  availableRooms,
  error,
  isInRoom,
  isGameStarted,
  roomPlayerCount,
  connect,
  disconnect,
  createRoom,
  joinRoom,
  getRooms,
  leaveRoom
} = useMultiplayer()

const playerNameInput = ref('')
const roomIdInput = ref('')
const showCreateDialog = ref(false)
const showJoinDialog = ref(false)
const serverMode = ref<ServerMode>('auto')
const serverUrl = ref(getServerUrl())
const showServerConfig = ref(false)
const showConfigDialog = ref(false)
const playerCount = ref(2)

const account = ref<AccountState | null>(null)

const savedDecks = computed(() => account.value?.savedDecks ?? [])

const activeDeckSlot = computed(() =>
  account.value ? getActiveDeckSlot(account.value) : undefined,
)

const activeDeckLabel = computed(() => {
  const active = activeDeckSlot.value
  const count = active?.cardIds?.length ?? account.value?.deckCardIds?.length ?? 0
  const name = active?.name ?? '默认卡组'
  return `${name}（${count} 张）`
})

function loadAccountDeck() {
  const loaded = readAccountState()
  if (!loaded?.isRegistered) {
    router.replace('/account-setup')
    return false
  }
  account.value = migrateAccountState(loaded)
  writeAccountState(account.value)
  if (account.value.playerName) {
    playerNameInput.value = account.value.playerName
  }
  return true
}

function selectDeckSlot(slotId: string) {
  if (!account.value || isInRoom.value) return
  if (account.value.activeDeckSlotId === slotId) return
  switchActiveDeckSlot(account.value, slotId)
  writeAccountState(account.value)
}

onMounted(() => {
  if (!loadAccountDeck()) return

  // 只在未连接时才连接
  if (!connected.value) {
    connect(serverUrl.value)
  }
})

// 不要在unmounted时断开连接，因为游戏界面还需要使用
// onUnmounted(() => {
//   disconnect()
// })

function changeServerMode(mode: ServerMode) {
  serverMode.value = mode
  serverUrl.value = getServerUrlByMode(mode)
  saveServerUrl(serverUrl.value) // 保存配置
  disconnect()
  setTimeout(() => {
    connect(serverUrl.value)
  }, 500)
}

function handleConfigSave(url: string) {
  serverUrl.value = url
  saveServerUrl(url) // 保存配置
  showConfigDialog.value = false
  disconnect()
  setTimeout(() => {
    connect(serverUrl.value)
  }, 500)
}

function handleCreateRoom() {
  if (!playerNameInput.value.trim()) {
    alert('请输入玩家名称')
    return
  }
  createRoom(playerNameInput.value, playerCount.value)
  showCreateDialog.value = false
}

function handleJoinRoom(roomId?: string) {
  if (!playerNameInput.value.trim()) {
    alert('请输入玩家名称')
    return
  }
  const targetRoomId = roomId || roomIdInput.value
  if (!targetRoomId.trim()) {
    alert('请输入房间ID')
    return
  }
  joinRoom(targetRoomId, playerNameInput.value)
  showJoinDialog.value = false
}

function handleRefreshRooms() {
  getRooms()
}

function startGame() {
  router.push('/game/multiplayer')
}

function disbandRoom() {
  if (confirm('确定要解散房间吗？')) {
    leaveRoom()
    router.replace('/')
  }
}

// 监听游戏开始
watch(isGameStarted, (started) => {
  if (started) {
    setTimeout(() => {
      startGame()
    }, 1000)
  }
})
</script>

<template>
  <div class="lobby-container">
    <div class="lobby-header">
      <h1>🎮 卡牌游戏 - 联机大厅</h1>
      <div class="connection-info">
        <div class="connection-status">
          <span :class="{ connected, disconnected: !connected }">
            {{ connected ? '● 已连接' : '○ 未连接' }}
          </span>
        </div>
        <div class="server-info">
          <button @click="showConfigDialog = true" class="btn-link">
            ⚙️ 配置服务器
          </button>
          <span class="server-url">{{ serverUrl }}</span>
        </div>
      </div>
    </div>

    <!-- 服务器配置 -->
    <div v-if="showServerConfig" class="server-config">
      <h3>服务器配置</h3>
      <div class="server-modes">
        <button 
          @click="changeServerMode('auto')" 
          :class="{ active: serverMode === 'auto' }"
          class="btn btn-mode"
        >
          自动检测
        </button>
        <button 
          @click="changeServerMode('local')" 
          :class="{ active: serverMode === 'local' }"
          class="btn btn-mode"
        >
          本地 (localhost)
        </button>
        <button 
          @click="changeServerMode('lan')" 
          :class="{ active: serverMode === 'lan' }"
          class="btn btn-mode"
        >
          局域网 (192.168.1.7)
        </button>
        <button 
          @click="changeServerMode('frp')" 
          :class="{ active: serverMode === 'frp' }"
          class="btn btn-mode"
        >
          🌸 Sakura FRP
        </button>
      </div>
      <div class="server-help">
        <p><strong>本地模式：</strong>同一台电脑测试（使用无痕窗口模拟第二个玩家）</p>
        <p><strong>局域网模式：</strong>同一WiFi下的朋友可以访问 <code>http://192.168.1.7:5173</code></p>
        <p><strong>Sakura FRP：</strong>通过内网穿透让互联网上的朋友访问</p>
        <p><strong>自动检测：</strong>根据访问地址自动选择</p>
      </div>
    </div>

    <div v-if="error" class="error-message">
      ⚠️ {{ error }}
    </div>

    <!-- 未在房间 -->
    <div v-if="!isInRoom" class="lobby-content">
      <!-- Deck info & player name -->
      <div class="deck-info-bar">
        <span class="player-display">👤 {{ playerNameInput || '玩家' }}</span>
        <div class="deck-section">
          <span class="deck-display">当前卡组：{{ activeDeckLabel }}</span>
          <div v-if="savedDecks.length > 0" class="deck-switcher">
            <span class="deck-switcher__label">切换卡组</span>
            <div class="deck-switcher__chips">
              <button
                v-for="slot in savedDecks"
                :key="slot.id"
                type="button"
                class="deck-chip"
                :class="{ 'deck-chip--active': slot.id === account?.activeDeckSlotId }"
                @click="selectDeckSlot(slot.id)"
              >
                {{ slot.name }}
              </button>
            </div>
          </div>
          <p class="deck-switch-hint">在此仅可切换已保存的卡组；修改内容请前往「管理卡组」</p>
        </div>
      </div>
      <div class="actions">
        <button @click="showCreateDialog = true" class="btn btn-primary" :disabled="!connected">
          创建房间
        </button>
        <button @click="showJoinDialog = true" class="btn btn-secondary" :disabled="!connected">
          加入房间
        </button>
        <button @click="handleRefreshRooms" class="btn btn-info" :disabled="!connected">
          刷新房间列表
        </button>
      </div>

      <!-- 房间列表 -->
      <div class="room-list">
        <h2>可用房间</h2>
        <div v-if="availableRooms.length === 0" class="empty-rooms">
          暂无可用房间
        </div>
        <div v-else class="rooms">
          <div 
            v-for="room in availableRooms" 
            :key="room.id" 
            class="room-card"
            :class="{ 'room-playing': room.status === 'playing' }"
            @click="room.status === 'waiting' && (roomIdInput = room.id, showJoinDialog = true)"
          >
            <div class="room-id">房间: {{ room.id }}</div>
            <div class="room-info">
              <span>房主: {{ room.hostName }}</span>
              <span>玩家: {{ room.onlinePlayers || room.playerCount }}/{{ room.maxPlayers || 2 }}</span>
              <span v-if="room.status === 'playing'" class="room-status">游戏中</span>
              <span v-else class="room-status waiting">等待中</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 创建房间对话框 -->
      <div v-if="showCreateDialog" class="dialog-overlay" @click="showCreateDialog = false">
        <div class="dialog" @click.stop>
          <h3>创建房间</h3>
          <input 
            v-model="playerNameInput" 
            type="text" 
            placeholder="输入你的名字"
            @keyup.enter="handleCreateRoom"
            class="input"
          />
          <label class="pregame-label" style="display:block;margin-bottom:12px;text-align:left">
            对局人数
            <select v-model="playerCount" class="input" style="margin-top:6px">
              <option :value="2">2 人对局</option>
              <option :value="3">3 人对局</option>
              <option :value="4">4 人对局</option>
            </select>
          </label>
          <div class="dialog-actions">
            <button @click="handleCreateRoom" class="btn btn-primary">创建</button>
            <button @click="showCreateDialog = false" class="btn btn-secondary">取消</button>
          </div>
        </div>
      </div>

      <!-- 加入房间对话框 -->
      <div v-if="showJoinDialog" class="dialog-overlay" @click="showJoinDialog = false">
        <div class="dialog" @click.stop>
          <h3>加入房间</h3>
          <input 
            v-model="playerNameInput" 
            type="text" 
            placeholder="输入你的名字"
            class="input"
          />
          <input 
            v-model="roomIdInput" 
            type="text" 
            placeholder="输入房间ID"
            @keyup.enter="handleJoinRoom()"
            class="input"
          />
          <div class="dialog-actions">
            <button @click="handleJoinRoom()" class="btn btn-primary">加入</button>
            <button @click="showJoinDialog = false" class="btn btn-secondary">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 在房间中 -->
    <div v-else class="room-waiting">
      <div class="room-info-card">
        <h2>房间: {{ currentRoom?.id }}</h2>
        <p class="deck-in-room">使用卡组：{{ activeDeckLabel }}</p>
        <div class="players-waiting">
          <h3>玩家列表 ({{ roomPlayerCount }}/{{ currentRoom?.maxPlayers || 2 }})</h3>
          <div class="player-list">
            <div 
              v-for="player in currentRoom?.players" 
              :key="player.id"
              class="player-item"
            >
              <span class="player-icon">👤</span>
              <span class="player-name">{{ player.name || '未知玩家' }}</span>
            </div>
          </div>
        </div>
        
        <div v-if="roomPlayerCount < (currentRoom?.maxPlayers || 2)" class="waiting-message">
          等待对手加入...
        </div>
        <div v-else class="ready-message">
          游戏即将开始！
        </div>
        <button @click="disbandRoom" class="btn btn-danger" style="margin-top:15px">
          解散房间
        </button>
      </div>
    </div>

    <div class="back-button">
      <button @click="router.push('/')" class="btn btn-secondary">
        返回主页
      </button>
    </div>

    <!-- 服务器配置对话框 -->
    <ServerConfigDialog 
      v-if="showConfigDialog"
      @close="showConfigDialog = false"
      @save="handleConfigSave"
    />
  </div>
</template>

<style scoped>
.lobby-container {
  min-height: 100vh;
  background: var(--game-bg-table);
  padding: 20px;
  color: var(--game-text-primary);
  font-family: var(--game-font-ui);
}

.lobby-header {
  text-align: center;
  margin-bottom: 30px;
}

.lobby-header h1 {
  margin: 0 0 10px 0;
  font-size: 36px;
}

.connection-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.connection-status {
  font-size: 18px;
}

.server-info {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  gap: 10px;
}

.server-url {
  font-family: monospace;
  background: #fffdf8; border: 1px solid #d8d2c4;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.btn-link {
  background: none;
  border: none;
  color: #2f6f5e;
  cursor: pointer;
  text-decoration: underline;
  font-size: 14px;
  padding: 5px 10px;
}

.btn-link:hover {
  color: #45a049;
}

.server-config {
  background: #fffdf8; border: 1px solid #d8d2c4;
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 20px;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.server-config h3 {
  margin: 0 0 15px 0;
  text-align: center;
}

.server-modes {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.btn-mode {
  padding: 10px 20px;
  background: #f6f4ef;
  border: 1px solid #d8d2c4;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-mode:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.btn-mode.active {
  background: #a46d1f;
  border-color: #a46d1f;
  font-weight: bold;
}

.server-help {
  background: #fffdf8; border: 1px solid #d8d2c4;
  padding: 15px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
}

.server-help p {
  margin: 8px 0;
}

.server-help code {
  background: #fffdf8; border: 1px solid #d8d2c4;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  color: #2f6f5e;
}

.connected {
  color: #2f6f5e;
}

.disconnected {
  color: #9d2f2f;
}

.error-message {
  background: rgba(244, 67, 54, 0.9);
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
  text-align: center;
  font-weight: bold;
}

.lobby-content {
  max-width: 800px;
  margin: 0 auto;
}

.deck-info-bar {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 20px;
  padding: 16px 24px;
  margin-bottom: 20px;
  background: #fffdf8;
  border: 1px solid #d8d2c4;
  border-radius: 12px;
  flex-wrap: wrap;
}

.deck-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-width: min(100%, 420px);
}

.deck-switcher {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deck-switcher__label {
  font-size: 13px;
  color: #69706b;
  font-weight: 600;
}

.deck-switcher__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.deck-chip {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid #d8d2c4;
  background: #f6f4ef;
  color: #1f2522;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.deck-chip:hover {
  border-color: #a46d1f;
  background: #fffdf8;
}

.deck-chip--active {
  border-color: #a46d1f;
  background: rgba(164, 109, 31, 0.12);
  color: #a46d1f;
  font-weight: 700;
  box-shadow: 0 0 0 1px rgba(164, 109, 31, 0.25);
}

.deck-switch-hint {
  margin: 0;
  font-size: 12px;
  color: #69706b;
  line-height: 1.4;
}

.deck-in-room {
  margin: -16px 0 24px;
  font-size: 16px;
  color: #a46d1f;
  font-weight: 600;
}

.player-display {
  font-size: 18px;
  font-weight: bold;
  color: #1f2522;
}

.deck-display {
  font-size: 16px;
  color: #a46d1f;
  font-weight: 500;
}

.actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.room-list {
  background: #fffdf8; border: 1px solid #d8d2c4;
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 20px;
}

.room-list h2 {
  margin: 0 0 15px 0;
  text-align: center;
}

.empty-rooms {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 18px;
}

.rooms {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
}

.room-card {
  background: #f6f4ef;
  border: 1px solid #d8d2c4;
  border-radius: 10px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s;
}

.room-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
  border-color: #a46d1f;
}

.room-card.room-playing {
  background: rgba(255, 152, 0, 0.2);
  border-color: rgba(255, 152, 0, 0.5);
  cursor: not-allowed;
  opacity: 0.7;
}

.room-card.room-playing:hover {
  transform: none;
  border-color: rgba(255, 152, 0, 0.5);
}

.room-id {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 10px;
}

.room-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  flex-wrap: wrap;
  gap: 8px;
}

.room-status {
  background: rgba(76, 175, 80, 0.3);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.room-status.waiting {
  background: rgba(76, 175, 80, 0.3);
  color: #2f6f5e;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  color: #333;
  border-radius: 15px;
  padding: 30px;
  min-width: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.dialog h3 {
  margin: 0 0 20px 0;
  text-align: center;
  font-size: 24px;
}

.input {
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  margin-bottom: 15px;
  box-sizing: border-box;
}

.input:focus {
  outline: none;
  border-color: #667eea;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.room-waiting {
  max-width: 600px;
  margin: 0 auto;
}

.room-info-card {
  background: #fffdf8; border: 1px solid #d8d2c4;
  border-radius: 15px;
  padding: 30px;
  text-align: center;
}

.room-info-card h2 {
  margin: 0 0 30px 0;
  font-size: 32px;
}

.players-waiting h3 {
  margin: 0 0 20px 0;
  font-size: 24px;
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 30px;
}

.player-item {
  background: #f6f4ef;
  padding: 15px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 15px;
  font-size: 20px;
}

.player-icon {
  font-size: 32px;
}

.waiting-message {
  font-size: 20px;
  color: #a46d1f;
  animation: pulse 2s infinite;
}

.ready-message {
  font-size: 24px;
  color: #2f6f5e;
  font-weight: bold;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.back-button {
  text-align: center;
  margin-top: 20px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #a46d1f;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #8a5718;
  transform: scale(1.05);
}

.btn-secondary {
  background: #f6f4ef;
  border: 1px solid #d8d2c4;
  color: #1f2522;
}

.btn-secondary:hover:not(:disabled) {
  background: #e8e4da;
  transform: scale(1.05);
}

.btn-info {
  background: #a46d1f;
  color: #fff;
}

.btn-info:hover:not(:disabled) {
  background: #8a5718;
  transform: scale(1.05);
}
</style>
