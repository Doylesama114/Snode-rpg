<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMultiplayer } from '@/composables/useMultiplayer'
import { useGameClient } from '@/composables/useGameClient'
import type { ReforgeOption, Card, GameState } from '@/types/game'

const router = useRouter()
const multiplayer = useMultiplayer()

// 使用客户端游戏逻辑
const game = useGameClient()

const reforgeOptions = ref<ReforgeOption[]>([])
const loadingTimeoutId = ref<number | null>(null)

// 处理游戏状态更新（从服务器接收）
function handleGameStateUpdate(newState: GameState) {
  console.log('=== [CardGameMultiplayer] 收到游戏状态更新 ===')
  console.log('[CardGameMultiplayer] phase:', newState.phase)
  console.log('[CardGameMultiplayer] round:', newState.round)
  console.log('[CardGameMultiplayer] message:', newState.message)
  console.log('[CardGameMultiplayer] 我的决策状态 (myDecisionMade):', game.myDecisionMade.value)
  console.log('[CardGameMultiplayer] 对手决策状态 (opponentDecisionMade):', game.opponentDecisionMade.value)
  console.log('[CardGameMultiplayer] 我的玩家名:', game.myPlayer.value?.name)
  
  // 清除加载超时
  if (loadingTimeoutId.value) {
    clearTimeout(loadingTimeoutId.value)
    loadingTimeoutId.value = null
  }
  
  game.updateGameState(newState)
  
  // 检查是否需要重置决策状态（新回合开始）
  if (newState.phase === 'decision') {
    console.log('[CardGameMultiplayer] 检测到decision阶段 -> 重置决策状态')
    game.resetDecisionState()
    game.resetReadyState()
  }
  
  // 如果进入 action 阶段，说明双方都已决策
  if (newState.phase === 'action') {
    console.log('[CardGameMultiplayer] 进入action阶段 -> 双方都已决策')
    if (!game.myDecisionMade.value) {
      console.log('[CardGameMultiplayer] 我还没决策，标记为已决策（对手先决策了）')
      game.myDecisionMade.value = true
    }
    if (!game.opponentDecisionMade.value) {
      console.log('[CardGameMultiplayer] 对手标记为已决策')
      game.opponentDecisionMade.value = true
    }
  }
  
  // 检查服务器端的准备状态
  if (newState.playerReady) {
    const myPlayerId = multiplayer.myPlayerId.value
    const opponentId = newState.players.find((p: any) => p.id !== myPlayerId)?.id
    
    if (myPlayerId && newState.playerReady[myPlayerId]) {
      game.setMyReady()
    }
    if (opponentId && newState.playerReady[opponentId]) {
      game.setOpponentReady()
    }
    
    // 如果双方都准备好，只让一个玩家发送开始新回合的请求
    // 使用玩家ID的字典序来决定谁发送（确保唯一性）
    if (game.bothPlayersReady.value) {
      console.log('[CardGameMultiplayer] 双方都准备完成')
      
      // 获取所有玩家ID并排序
      const playerIds = Object.keys(newState.playerReady).sort()
      const shouldSendRequest = playerIds[0] === myPlayerId
      
      if (shouldSendRequest) {
        console.log('[CardGameMultiplayer] 我的ID最小，2秒后发送 startNewRound')
        setTimeout(() => {
          // 服务器端会自动检查是否应该结束游戏
          multiplayer.sendAction({ type: 'startNewRound' })
        }, 2000)
      } else {
        console.log('[CardGameMultiplayer] 等待ID较小的玩家发送 startNewRound')
      }
    }
  }
  
  console.log('=== [CardGameMultiplayer] 状态更新完成 ===')
}

onMounted(() => {
  console.log('[CardGameMultiplayer] 组件挂载')
  console.log('[CardGameMultiplayer] isInRoom:', multiplayer.isInRoom.value)
  console.log('[CardGameMultiplayer] isGameStarted:', multiplayer.isGameStarted.value)
  
  // 检查是否在房间中
  if (!multiplayer.isInRoom.value || !multiplayer.isGameStarted.value) {
    console.log('[CardGameMultiplayer] 不在房间中或游戏未开始，返回大厅')
    router.replace('/multiplayer')
    return
  }
  
  // 设置游戏状态更新监听
  multiplayer.onGameStateUpdate(handleGameStateUpdate)
  
  // 添加超时检查：如果5秒内没有收到游戏状态，返回大厅
  loadingTimeoutId.value = setTimeout(() => {
    if (!game.gameState.value) {
      console.error('[CardGameMultiplayer] 超时未收到游戏状态，返回大厅')
      alert('无法加载游戏，可能房间已不存在')
      multiplayer.leaveRoom()
      router.replace('/multiplayer')
    }
  }, 5000) as unknown as number
  
  console.log('[CardGameMultiplayer] 等待服务器发送初始游戏状态...')
})

onUnmounted(() => {
  // 清除超时
  if (loadingTimeoutId.value) {
    clearTimeout(loadingTimeoutId.value)
  }
  
  multiplayer.offGameStateUpdate()
})

// 处理选择出牌
function handleChoosePlay() {
  console.log('=== [CardGameMultiplayer] handleChoosePlay 被调用 ===')
  console.log('[CardGameMultiplayer] 当前 phase:', game.gameState.value?.phase)
  console.log('[CardGameMultiplayer] 我的玩家名:', game.myPlayer.value?.name)
  
  const action = game.choosePlay()
  console.log('[CardGameMultiplayer] 发送 choosePlay 操作')
  multiplayer.sendAction(action)
  
  if (!game.opponentDecisionMade.value) {
    console.log('[CardGameMultiplayer] 对手还未决策，等待中...')
  } else {
    console.log('[CardGameMultiplayer] 对手已决策')
  }
}

// 处理选择重铸
function handleChooseReforge() {
  console.log('=== [CardGameMultiplayer] handleChooseReforge 被调用 ===')
  console.log('[CardGameMultiplayer] 当前 phase:', game.gameState.value?.phase)
  console.log('[CardGameMultiplayer] 我的玩家名:', game.myPlayer.value?.name)
  
  const action = game.chooseReforge()
  console.log('[CardGameMultiplayer] 发送 chooseReforge 操作')
  multiplayer.sendAction(action)
  
  if (!game.opponentDecisionMade.value) {
    console.log('[CardGameMultiplayer] 对手还未决策，等待中...')
  } else {
    console.log('[CardGameMultiplayer] 对手已决策')
  }
}

// 处理手牌点击
function onHandCardClick(index: number) {
  // 检查是否选择了重铸
  const myPlayerId = multiplayer.myPlayerId.value
  const myDecision = game.gameState.value?.playerDecisions?.[myPlayerId]
  
  if (myDecision && myDecision.choice === 'reforge') {
    // 选择了重铸，处理重铸逻辑
    if (game.reforgeState.value.active && reforgeOptions.value.includes('redraw') && game.reforgeState.value.selectedCard === null) {
      game.selectReforgeCard(index)
      
      if (reforgeOptions.value.length === 2) {
        const action = game.executeReforge([reforgeOptions.value[0], reforgeOptions.value[1]])
        multiplayer.sendAction(action)
        reforgeOptions.value = []
        game.setMyReady()
      }
    }
    return
  }
  
  // 选择了出牌，处理出牌逻辑
  if (game.gameState.value?.phase === 'action' && !game.reforgeState.value.active) {
    // 只有双方都做出决策后才能选择手牌
    if (!game.bothDecisionsMade.value) {
      return
    }
    game.selectCardToPlay(index)
  }
}

// 处理槽位选择
function handleSelectSlot(slotIndex: number) {
  console.log('[CardGameMultiplayer] handleSelectSlot 被调用, slotIndex:', slotIndex)
  
  // 检查是否选择了重铸
  const myPlayerId = multiplayer.myPlayerId.value
  const myDecision = game.gameState.value?.playerDecisions?.[myPlayerId]
  
  if (myDecision && myDecision.choice === 'reforge') {
    console.log('[CardGameMultiplayer] 选择了重铸，不能出牌')
    return
  }
  
  // 只有双方都做出决策后才能部署单位
  if (!game.bothDecisionsMade.value) {
    return
  }
  
  if (!game.myPlayer.value) return
  
  // 找到选中的手牌索引
  const cardIndex = game.myPlayer.value.hand.findIndex(c => c === game.selectedCard.value)
  if (cardIndex === -1) return
  
  const action = game.selectSlotToPlay(slotIndex, cardIndex)
  if (action) {
    console.log('[CardGameMultiplayer] 发送 playCard 操作:', action)
    multiplayer.sendAction(action)
  }
}

// 处理跳过回合
function handleSkipTurn() {
  console.log('[CardGameMultiplayer] handleSkipTurn 被调用')
  
  // 发送跳过回合操作到服务器
  multiplayer.sendAction({ type: 'skipTurn' })
  
  console.log('[CardGameMultiplayer] 已发送 skipTurn 操作到服务器')
}

// 选择重铸选项
function selectReforgeOption(option: ReforgeOption) {
  if (reforgeOptions.value.length < 2) {
    reforgeOptions.value.push(option)
    
    if (reforgeOptions.value.length === 2) {
      if (reforgeOptions.value.includes('redraw') && game.reforgeState.value.selectedCard === null) {
        return
      }
      
      const action = game.executeReforge([reforgeOptions.value[0], reforgeOptions.value[1]])
      multiplayer.sendAction(action)
      reforgeOptions.value = []
      game.setMyReady()
    }
  }
}

// 获取战力颜色
function getPowerColor(card: Card): string {
  if (card.currentPower > card.basePower) return 'green'
  if (card.currentPower < card.basePower) return 'red'
  return 'white'
}

// 离开游戏
function leaveGame() {
  console.log('[CardGameMultiplayer] leaveGame 被调用')
  
  if (!confirm('确定要离开游戏吗？')) {
    return
  }
  
  try {
    // 移除事件监听
    multiplayer.offGameStateUpdate()
    
    // 离开房间
    multiplayer.leaveRoom()
    
    // 使用 replace 而不是 push，避免返回按钮回到游戏
    console.log('[CardGameMultiplayer] 跳转到主页')
    router.replace('/').then(() => {
      console.log('[CardGameMultiplayer] 已跳转到主页')
    }).catch(err => {
      console.error('[CardGameMultiplayer] 跳转失败:', err)
      // 如果跳转失败，强制刷新页面
      window.location.href = '/'
    })
  } catch (error) {
    console.error('[CardGameMultiplayer] 离开游戏时出错:', error)
    // 出错时强制跳转
    window.location.href = '/'
  }
}
</script>

<template>
  <div class="game-container" v-if="game.gameState.value">
    <!-- 游戏信息栏 -->
    <div class="game-info">
      <div class="round-info">
        <span>回合: {{ game.gameState.value.round }}</span>
        <span v-if="game.gameState.value.isFinalRound" class="final-round">最后一回合！</span>
        <span v-if="game.bothPlayersReady.value" class="ready-status">双方准备完毕，进入下一回合...</span>
        <span v-else-if="game.myReady.value" class="ready-status">等待对手...</span>
      </div>
      <div class="message">{{ game.gameState.value.message }}</div>
    </div>

    <!-- 对手区域 -->
    <div class="player-area opponent-area" v-if="game.opponent.value">
      <div class="player-header">
        <h3>{{ game.opponent.value.name }}</h3>
        <div class="stats">
          <span>费用: {{ game.opponent.value.currentCost }}</span>
          <span class="power-display">总战力: <strong>{{ game.getTotalPower(1) }}</strong></span>
          <span>手牌: {{ game.opponent.value.handCount || game.opponent.value.hand.length }}</span>
          <span>牌组: {{ game.opponent.value.deckCount || game.opponent.value.deck.length }}</span>
        </div>
      </div>
      
      <!-- 对手场上 -->
      <div class="field">
        <div class="field-label">场上</div>
        <div class="field-grid">
          <div 
            v-for="(slot, index) in game.opponent.value.field" 
            :key="index" 
            class="field-slot"
            :class="{ 
              'has-card': slot.card,
              'extra-slot': slot.isExtra
            }"
          >
            <div v-if="slot.card" class="field-card">
              <div class="card-name-small">{{ slot.card.name }}</div>
              <div class="card-power" :style="{ color: getPowerColor(slot.card) }">
                {{ slot.card.currentPower }}
              </div>
            </div>
            <div v-else class="empty-slot">{{ slot.isExtra ? '额外' : '空' }}</div>
          </div>
        </div>
      </div>
      
      <!-- 对手手牌（隐藏） -->
      <div class="opponent-hand">
        <div class="hand-label">对手手牌</div>
        <div class="hand-cards-hidden">
          <div 
            v-for="(card, index) in game.opponent.value.hand" 
            :key="index" 
            class="hand-card-back"
          >
            ?
          </div>
        </div>
      </div>
    </div>

    <!-- 我的区域 -->
    <div class="player-area my-area" v-if="game.myPlayer.value">
      <div class="player-header">
        <h3>{{ game.myPlayer.value.name }} (你)</h3>
        <div class="stats">
          <span>费用: {{ game.myPlayer.value.currentCost }}</span>
          <span class="power-display">总战力: <strong>{{ game.getTotalPower(0) }}</strong></span>
          <span>手牌: {{ game.myPlayer.value.hand.length }}</span>
          <span>牌组: {{ game.myPlayer.value.deckCount || game.myPlayer.value.deck.length }}</span>
        </div>
      </div>

      <!-- 我的场上 -->
      <div class="field">
        <div class="field-label">场上</div>
        <div class="field-grid">
          <div 
            v-for="(slot, index) in game.myPlayer.value.field" 
            :key="index" 
            class="field-slot"
            :class="{ 
              'has-card': slot.card,
              'extra-slot': slot.isExtra,
              'selectable': game.isSlotAvailable(index),
              'selected': game.selectedSlot.value === index
            }"
            @click="game.gameState.value.phase === 'action' && game.isSlotAvailable(index) && handleSelectSlot(index)"
          >
            <div v-if="slot.card" class="field-card">
              <div class="card-name-small">{{ slot.card.name }}</div>
              <div class="card-power" :style="{ color: getPowerColor(slot.card) }">
                {{ slot.card.currentPower }}
              </div>
            </div>
            <div v-else class="empty-slot">{{ slot.isExtra ? '额外' : (index + 1) }}</div>
          </div>
        </div>
      </div>

      <!-- 我的手牌 -->
      <div class="hand">
        <div class="hand-label">
          手牌
          <span v-if="game.reforgeState.value.active && reforgeOptions.includes('redraw') && game.reforgeState.value.selectedCard === null" class="hint">
            (点击选择要放回牌组的卡牌)
          </span>
          <span v-else-if="!game.reforgeState.value.active && game.hasPlayedThisTurn.value && !game.canPlayExtra.value" class="hint-disabled">
            (本回合已出牌)
          </span>
          <span v-else-if="!game.reforgeState.value.active && game.canPlayExtra.value" class="hint-extra">
            (可以额外出一张牌！)
          </span>
        </div>
        <div class="hand-cards">
          <div 
            v-for="(card, index) in game.myPlayer.value.hand" 
            :key="index" 
            class="hand-card"
            :class="{ 
              'playable': game.isCardPlayable(index),
              'disabled': !game.isCardPlayable(index) && !game.reforgeState.value.active,
              'selectable': game.reforgeState.value.active && reforgeOptions.includes('redraw') && game.reforgeState.value.selectedCard === null,
              'selected': game.reforgeState.value.selectedCard === index
            }"
            @click="onHandCardClick(index)"
          >
            <template v-if="card !== 'hidden' && card">
              <div class="card-header">
                <span class="card-attribute">{{ card.attribute }}</span>
                <span class="card-cost-power">
                  <span v-if="card.type === 'environment'" class="card-type-badge">环境</span>
                  <span v-else-if="card.type === 'tactic'" class="card-type-badge">战术</span>
                  <span>⚡{{ card.cost }}</span>
                  <span v-if="card.type === 'unit'">💪{{ card.basePower }}</span>
                </span>
              </div>
              <div class="card-name">{{ card.name }}</div>
              <div class="card-keywords">{{ card.keywords?.join('/') || '无' }}</div>
              <div class="card-effect">{{ card.effects?.[0]?.description || '无效果' }}</div>
            </template>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <template v-if="game.gameState.value.phase === 'decision' && !game.myDecisionMade.value">
          <button @click="handleChoosePlay" class="btn btn-primary">出牌</button>
          <button @click="handleChooseReforge" class="btn btn-secondary">重铸</button>
        </template>
        
        <!-- 等待对手决策提示 -->
        <div v-if="game.myDecisionMade.value && !game.opponentDecisionMade.value" class="waiting-opponent">
          ⏳ 等待对手做出决策...
        </div>
        
        <!-- 双方都已决策提示 -->
        <div v-if="game.bothDecisionsMade.value && game.gameState.value.phase === 'action' && !game.reforgeState.value.active" class="both-ready">
          ✅ 双方已决策，可以部署单位了！
        </div>
        
        <!-- 费用不足时显示跳过按钮 -->
        <template v-if="game.gameState.value.phase === 'action' && !game.reforgeState.value.active && game.myPlayer.value.currentCost === 0 && !game.myPlayer.value.canPlayExtra">
          <div class="no-cost-warning">
            费用不足，无法出牌
          </div>
          <button @click="handleSkipTurn" class="btn btn-warning">跳过回合</button>
        </template>

        <!-- 重铸选项 -->
        <div v-if="game.reforgeState.value.active && reforgeOptions.length < 2" class="reforge-options">
          <div class="reforge-info">
            选择操作 ({{ reforgeOptions.length }}/2)
            <span v-if="reforgeOptions.includes('redraw') && game.reforgeState.value.selectedCard === null" class="warning">
              - 请先选择要换掉的手牌
            </span>
          </div>
          <button @click="selectReforgeOption('gainCost')" class="btn btn-small">恢复2费用</button>
          <button @click="selectReforgeOption('redraw')" class="btn btn-small">换牌</button>
          <button @click="selectReforgeOption('gainPower')" class="btn btn-small">战力+1</button>
        </div>

        <button 
          v-if="game.gameState.value.phase === 'gameOver'"
          @click="leaveGame"
          class="btn btn-primary"
        >
          返回大厅
        </button>
        
        <button @click="leaveGame" class="btn btn-danger">
          离开游戏
        </button>
      </div>
    </div>
  </div>
  
  <div v-else class="loading">
    <p>加载游戏中...</p>
    <p class="loading-hint">如果长时间无响应，可能房间已不存在</p>
    <button @click="router.replace('/multiplayer')" class="btn btn-secondary" style="margin-top: 20px;">
      返回大厅
    </button>
  </div>
</template>

<style scoped>
/* 复用原有样式 */
.game-container {
  height: 100vh;
  width: 100vw;
  background: #f6f4ef;
  padding: 10px 20px;
  color: #1f2522;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.loading {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f6f4ef;
  color: #1f2522;
  font-size: 24px;
}

.loading-hint {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 10px;
}

.game-info {
  background: #fffdf8;
  border: 1px solid #d8d2c4;
  padding: 10px 15px;
  border-radius: 12px;
  flex-shrink: 0;
  color: #1f2522;
}

.round-info {
  display: flex;
  gap: 15px;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 5px;
  align-items: center;
}

.final-round {
  color: #ff6b6b;
  animation: pulse 1s infinite;
}

.ready-status {
  color: #2f6f5e;
  font-size: 14px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.message {
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-line;
}

.player-area {
  background: #fffdf8; border: 1px solid #d8d2c4;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.opponent-area {
  border-left: 4px solid #9d2f2f;
  border: 1px solid #d8d2c4;
}

.my-area {
  border: 1px solid #d8d2c4;
  border-left: 4px solid #2f6f5e;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.player-header h3 {
  margin: 0;
  font-size: 20px;
}

.stats {
  display: flex;
  gap: 10px;
  font-size: 14px;
  flex-wrap: wrap;
}

.power-display {
  font-size: 16px;
  color: #a46d1f;
}

.power-display strong {
  font-size: 18px;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.field {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.field-label {
  font-size: 15px;
  font-weight: bold;
  margin-bottom: 6px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  padding: 0;
}

.field-slot {
  background: #f6f4ef;
  border: 1px solid #d8d2c4;
  border-radius: 8px;
  padding: 6px;
  min-height: 55px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s;
}

.field-slot.extra-slot {
  background: rgba(255, 215, 0, 0.1);
  border-color: rgba(255, 215, 0, 0.5);
  border-style: dashed;
}

.field-slot.selectable {
  border-color: #a46d1f;
  cursor: pointer;
  box-shadow: 0 0 15px rgba(76, 175, 80, 0.5);
}

.field-slot.selectable:hover {
  transform: scale(1.05);
  box-shadow: 0 0 12px rgba(164, 109, 31, 0.3);
}

.field-slot.selected {
  border-color: #a46d1f;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
}

.field-card {
  text-align: center;
  width: 100%;
}

.card-name-small {
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.card-power {
  font-size: 18px;
  font-weight: bold;
}

.empty-slot {
  color: #69706b;
  font-size: 13px;
}

.opponent-hand {
  margin-bottom: 15px;
  flex-shrink: 0;
}

.hand-cards-hidden {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 5px 0;
}

.hand-card-back {
  background: #f6f4ef;
  color: white;
  border-radius: 8px;
  padding: 12px;
  min-width: 50px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.hand {
  flex-shrink: 0;
}

.hand-label {
  font-size: 15px;
  font-weight: bold;
  margin-bottom: 6px;
}

.hint {
  color: #a46d1f;
  font-size: 13px;
  font-weight: normal;
  margin-left: 10px;
}

.hint-disabled {
  color: #999;
  font-size: 13px;
  font-weight: normal;
  margin-left: 10px;
}

.hint-extra {
  color: #2f6f5e;
  font-size: 13px;
  font-weight: bold;
  margin-left: 10px;
  animation: pulse 1s infinite;
}

.hand-cards {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 5px 0;
}

.hand-card {
  background: #fffdf8;
  color: #1f2522;
  border-radius: 10px;
  padding: 10px;
  min-width: 160px;
  max-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: all 0.3s;
  border: 1px solid #d8d2c4;
  cursor: pointer;
  flex-shrink: 0;
}

.hand-card.playable {
  border-color: #a46d1f;
  box-shadow: 0 0 15px rgba(76, 175, 80, 0.5);
}

.hand-card.playable:hover {
  transform: translateY(-10px);
  box-shadow: 0 4px 12px rgba(47, 111, 94, 0.3);
}

.hand-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hand-card.selectable {
  border-color: #a46d1f;
}

.hand-card.selectable:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 20px rgba(255, 152, 0, 0.7);
}

.hand-card.selected {
  border-color: #9d2f2f;
  background: rgba(244, 67, 54, 0.1);
  transform: translateY(-5px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.card-attribute {
  background: rgba(0, 0, 0, 0.1);
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: bold;
}

.card-cost-power {
  display: flex;
  gap: 4px;
}

.card-type-badge {
  background: #a46d1f;
  color: #fff;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: bold;
}

.card-name {
  font-weight: bold;
  font-size: 14px;
  text-align: center;
}

.card-keywords {
  font-size: 11px;
  color: #69706b;
  text-align: center;
}

.card-effect {
  font-size: 10px;
  color: #69706b;
  font-style: italic;
  line-height: 1.2;
  min-height: 30px;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 10px 0 0;
  flex-shrink: 0;
  margin-top: auto;
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

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover {
  background: #da190b;
  transform: scale(1.05);
}

.btn-warning {
  background: #a46d1f;
  color: #fff;
}

.btn-warning:hover {
  background: #8a5718;
  transform: scale(1.05);
}

.no-cost-warning {
  background: rgba(255, 152, 0, 0.2);
  border: 2px solid #ff9800;
  padding: 10px 20px;
  border-radius: 8px;
  color: #a46d1f;
  font-weight: bold;
  text-align: center;
  width: 100%;
}

.btn-small {
  padding: 8px 16px;
  font-size: 14px;
  background: #a46d1f;
  color: #fff;
}

.btn-small:hover {
  background: #8a5718;
}

.reforge-options {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  background: #fffdf8; border: 1px solid #d8d2c4;
  padding: 15px;
  border-radius: 10px;
  width: 100%;
}

.reforge-info {
  font-weight: bold;
  margin-right: 10px;
}

.warning {
  color: #9d2f2f;
  font-size: 14px;
}

.waiting-opponent {
  background: rgba(255, 152, 0, 0.2);
  border: 2px solid #ff9800;
  padding: 15px 30px;
  border-radius: 8px;
  color: #a46d1f;
  font-weight: bold;
  text-align: center;
  width: 100%;
  font-size: 18px;
  animation: pulse 1.5s infinite;
}

.both-ready {
  background: rgba(76, 175, 80, 0.2);
  border: 2px solid #4caf50;
  padding: 15px 30px;
  border-radius: 8px;
  color: #2f6f5e;
  font-weight: bold;
  text-align: center;
  width: 100%;
  font-size: 18px;
}
</style>
