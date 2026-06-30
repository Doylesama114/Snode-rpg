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

// 处理游戏状态更新（从服务器接收）
function handleGameStateUpdate(newState: GameState) {
  console.log('[CardGameMultiplayer] 收到游戏状态更新')
  game.updateGameState(newState)
  
  // 检查是否有玩家做出决策
  // 注意：服务器端的 phase 变化会告诉我们游戏进展
  if (newState.phase === 'action' && !game.myDecisionMade.value) {
    // 如果进入action阶段但我还没决策，说明对手已决策
    game.handleOpponentDecision()
  }
  
  // 检查是否需要重置决策状态
  if (newState.phase === 'decision') {
    game.resetDecisionState()
  }
}

onMounted(() => {
  console.log('[CardGameMultiplayer] 组件挂载')
  console.log('[CardGameMultiplayer] isInRoom:', multiplayer.isInRoom.value)
  console.log('[CardGameMultiplayer] isGameStarted:', multiplayer.isGameStarted.value)
  
  // 检查是否在房间中
  if (!multiplayer.isInRoom.value || !multiplayer.isGameStarted.value) {
    console.log('[CardGameMultiplayer] 不在房间中或游戏未开始，返回大厅')
    router.push('/multiplayer')
    return
  }
  
  // 设置游戏状态更新监听
  multiplayer.onGameStateUpdate(handleGameStateUpdate)
  
  console.log('[CardGameMultiplayer] 等待服务器发送初始游戏状态...')
})

onUnmounted(() => {
  multiplayer.offGameStateUpdate()
})

// 处理选择出牌
function handleChoosePlay() {
  console.log('[CardGameMultiplayer] handleChoosePlay 被调用')
  const action = game.choosePlay()
  multiplayer.sendAction(action)
  
  if (!game.opponentDecisionMade.value) {
    // 显示等待提示会由服务器状态更新触发
  }
}

// 处理选择重铸
function handleChooseReforge() {
  console.log('[CardGameMultiplayer] handleChooseReforge 被调用')
  const action = game.chooseReforge()
  multiplayer.sendAction(action)
  
  if (!game.opponentDecisionMade.value) {
    // 显示等待提示会由服务器状态更新触发
  }
}

// 处理手牌点击
function onHandCardClick(index: number) {
  if (game.reforgeState.value.active && reforgeOptions.value.includes('redraw') && game.reforgeState.value.selectedCard === null) {
    game.selectReforgeCard(index)
    
    if (reforgeOptions.value.length === 2) {
      const action = game.executeReforge([reforgeOptions.value[0], reforgeOptions.value[1]])
      multiplayer.sendAction(action)
      reforgeOptions.value = []
      game.setMyReady()
    }
  } else if (game.gameState.value?.phase === 'action' && !game.reforgeState.value.active) {
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
    
    // 检查是否还能继续出牌
    if (!game.myPlayer.value.canPlayExtra) {
      game.setMyReady()
      // 如果双方都准备好，发送开始新回合的请求
      if (game.bothPlayersReady.value) {
        setTimeout(() => {
          if (game.gameState.value?.isFinalRound) {
            multiplayer.sendAction({ type: 'endGame' })
          } else {
            multiplayer.sendAction({ type: 'startNewRound' })
          }
          game.resetReadyState()
        }, 2000)
      }
    }
  }
}

// 处理跳过回合
function handleSkipTurn() {
  console.log('[CardGameMultiplayer] handleSkipTurn 被调用')
  game.setMyReady()
  
  // 如果双方都准备好，发送开始新回合的请求
  if (game.bothPlayersReady.value) {
    setTimeout(() => {
      if (game.gameState.value?.isFinalRound) {
        multiplayer.sendAction({ type: 'endGame' })
      } else {
        multiplayer.sendAction({ type: 'startNewRound' })
      }
      game.resetReadyState()
    }, 2000)
  }
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
  if (confirm('确定要离开游戏吗？')) {
    multiplayer.leaveRoom()
    router.push('/')
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
            v-for="(slot, index) in game.opponent.value.field.filter((s: any) => !s.isExtra)" 
            :key="index" 
            class="field-slot"
            :class="{ 'has-card': slot.card }"
          >
            <div v-if="slot.card" class="field-card">
              <div class="card-name-small">{{ slot.card.name }}</div>
              <div class="card-power" :style="{ color: getPowerColor(slot.card) }">
                {{ slot.card.currentPower }}
              </div>
            </div>
            <div v-else class="empty-slot">空</div>
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
            v-for="(slot, index) in game.myPlayer.value.field.filter((s: any) => !s.isExtra)" 
            :key="index" 
            class="field-slot"
            :class="{ 
              'has-card': slot.card,
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
            <div v-else class="empty-slot">{{ index + 1 }}</div>
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
            <template v-if="card !== 'hidden'">
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
              <div class="card-keywords">{{ card.keywords.join('/') }}</div>
              <div class="card-effect">{{ card.effects[0]?.description || '无效果' }}</div>
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
  </div>
</template>

<style scoped>
/* 复用原有样式 */
.game-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  color: white;
  max-width: 1600px;
  margin: 0 auto;
}

.loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 24px;
}

.game-info {
  background: rgba(0, 0, 0, 0.3);
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
}

.round-info {
  display: flex;
  gap: 20px;
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 10px;
  align-items: center;
}

.final-round {
  color: #ff6b6b;
  animation: pulse 1s infinite;
}

.ready-status {
  color: #4caf50;
  font-size: 16px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.message {
  font-size: 16px;
  line-height: 1.5;
  white-space: pre-line;
}

.player-area {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 20px;
}

.opponent-area {
  border: 2px solid rgba(255, 100, 100, 0.5);
}

.my-area {
  border: 2px solid rgba(100, 255, 100, 0.5);
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.player-header h3 {
  margin: 0;
  font-size: 24px;
}

.stats {
  display: flex;
  gap: 15px;
  font-size: 16px;
}

.power-display {
  font-size: 18px;
  color: #ffd700;
}

.power-display strong {
  font-size: 22px;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.field {
  margin-bottom: 20px;
}

.field-label {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 10px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  padding: 0 80px;
}

.field-slot {
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  padding: 8px;
  min-height: 70px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s;
}

.field-slot.selectable {
  border-color: #4caf50;
  cursor: pointer;
  box-shadow: 0 0 15px rgba(76, 175, 80, 0.5);
}

.field-slot.selectable:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(76, 175, 80, 0.8);
}

.field-slot.selected {
  border-color: #ffd700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
}

.field-card {
  text-align: center;
  width: 100%;
}

.card-name-small {
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.card-power {
  font-size: 20px;
  font-weight: bold;
}

.empty-slot {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.opponent-hand {
  margin-bottom: 15px;
}

.hand-cards-hidden {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 10px 0;
}

.hand-card-back {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
  padding: 20px;
  min-width: 60px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.hand {
  margin-bottom: 20px;
}

.hand-label {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 10px;
}

.hint {
  color: #ff9800;
  font-size: 14px;
  font-weight: normal;
  margin-left: 10px;
}

.hint-disabled {
  color: #999;
  font-size: 14px;
  font-weight: normal;
  margin-left: 10px;
}

.hint-extra {
  color: #4caf50;
  font-size: 14px;
  font-weight: bold;
  margin-left: 10px;
  animation: pulse 1s infinite;
}

.hand-cards {
  display: flex;
  gap: 15px;
  overflow-x: auto;
  padding: 10px 0;
}

.hand-card {
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  border-radius: 12px;
  padding: 15px;
  min-width: 200px;
  max-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.3s;
  border: 2px solid transparent;
  cursor: pointer;
}

.hand-card.playable {
  border-color: #4caf50;
  box-shadow: 0 0 15px rgba(76, 175, 80, 0.5);
}

.hand-card.playable:hover {
  transform: translateY(-10px);
  box-shadow: 0 10px 25px rgba(76, 175, 80, 0.7);
}

.hand-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hand-card.selectable {
  border-color: #ff9800;
}

.hand-card.selectable:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 20px rgba(255, 152, 0, 0.7);
}

.hand-card.selected {
  border-color: #f44336;
  background: rgba(244, 67, 54, 0.1);
  transform: translateY(-5px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.card-attribute {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}

.card-cost-power {
  display: flex;
  gap: 5px;
}

.card-type-badge {
  background: #ff9800;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}

.card-name {
  font-weight: bold;
  font-size: 16px;
  text-align: center;
}

.card-keywords {
  font-size: 12px;
  color: #666;
  text-align: center;
}

.card-effect {
  font-size: 11px;
  color: #666;
  font-style: italic;
  line-height: 1.3;
  min-height: 40px;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
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
  background: #4caf50;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #45a049;
  transform: scale(1.05);
}

.btn-secondary {
  background: #2196f3;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #0b7dda;
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
  background: #ff9800;
  color: white;
}

.btn-warning:hover {
  background: #e68900;
  transform: scale(1.05);
}

.no-cost-warning {
  background: rgba(255, 152, 0, 0.2);
  border: 2px solid #ff9800;
  padding: 10px 20px;
  border-radius: 8px;
  color: #ff9800;
  font-weight: bold;
  text-align: center;
  width: 100%;
}

.btn-small {
  padding: 8px 16px;
  font-size: 14px;
  background: #ff9800;
  color: white;
}

.btn-small:hover {
  background: #e68900;
}

.reforge-options {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  background: rgba(0, 0, 0, 0.3);
  padding: 15px;
  border-radius: 10px;
  width: 100%;
}

.reforge-info {
  font-weight: bold;
  margin-right: 10px;
}

.warning {
  color: #f44336;
  font-size: 14px;
}

.waiting-opponent {
  background: rgba(255, 152, 0, 0.2);
  border: 2px solid #ff9800;
  padding: 15px 30px;
  border-radius: 8px;
  color: #ff9800;
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
  color: #4caf50;
  font-weight: bold;
  text-align: center;
  width: 100%;
  font-size: 18px;
}
</style>
