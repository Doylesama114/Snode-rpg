<script setup lang="ts">
import { useGame } from '@/composables/useGame'
import type { ReforgeOption } from '@/types/game'

const { gameState, currentPlayer, opponent, aiHiddenCards, reforgeState, hasPlayedThisTurn, canPlayExtra, initGame, choosePlay, chooseReforge, playCard, selectReforgeCard, executeReforge, endTurn } = useGame()

// 重铸选项
const reforgeOptions = ref<ReforgeOption[]>([])

function selectReforgeOption(option: ReforgeOption) {
  if (reforgeOptions.value.length < 2) {
    reforgeOptions.value.push(option)
    
    if (reforgeOptions.value.length === 2) {
      // 如果选择了换牌，需要先选择手牌
      if (reforgeOptions.value.includes('redraw') && reforgeState.value.selectedCard === null) {
        // 等待玩家选择手牌
        return
      }
      
      executeReforge([reforgeOptions.value[0], reforgeOptions.value[1]])
      reforgeOptions.value = []
    }
  }
}

function onHandCardClick(index: number) {
  // 如果在重铸模式且选择了换牌选项
  if (reforgeState.value.active && reforgeOptions.value.includes('redraw') && reforgeState.value.selectedCard === null) {
    selectReforgeCard(index)
    
    // 如果已经选择了2个重铸选项，执行重铸
    if (reforgeOptions.value.length === 2) {
      executeReforge([reforgeOptions.value[0], reforgeOptions.value[1]])
      reforgeOptions.value = []
    }
  } else if (gameState.value.phase === 'action' && currentPlayer.value.id === 'player' && !reforgeState.value.active) {
    // 正常出牌
    playCard(index)
  }
}

// 计算总战力
function getTotalPower(playerIndex: number) {
  const player = gameState.value.players[playerIndex]
  const fieldPower = player.field.reduce((sum, card) => sum + card.power, 0)
  return fieldPower + player.bonusPower
}

// 检查卡牌是否可以打出
function isCardPlayable(index: number) {
  // 必须在action阶段
  if (gameState.value.phase !== 'action') {
    return false
  }
  
  // 必须是玩家回合
  if (currentPlayer.value.id !== 'player') {
    return false
  }
  
  // 不能在重铸模式
  if (reforgeState.value.active) {
    return false
  }
  
  const card = gameState.value.players[0].hand[index]
  if (!card) return false
  
  // 检查是否已经出过牌且没有额外出牌机会
  if (hasPlayedThisTurn.value && !canPlayExtra.value) {
    return false
  }
  
  // 检查费用和槽位
  return currentPlayer.value.currentCost >= card.cost && currentPlayer.value.field.length < 6
}
</script>

<template>
  <div class="game-container">
    <!-- 游戏信息栏 -->
    <div class="game-info">
      <div class="round-info">
        <span>回合: {{ gameState.round }}</span>
        <span v-if="gameState.isFinalRound" class="final-round">最后一回合！</span>
      </div>
      <div class="message">{{ gameState.message }}</div>
    </div>

    <!-- AI区域 -->
    <div class="player-area ai-area">
      <div class="player-header">
        <h3>{{ gameState.players[1].name }}</h3>
        <div class="stats">
          <span>费用: {{ gameState.players[1].currentCost }}</span>
          <span class="power-display">总战力: <strong>{{ getTotalPower(1) }}</strong></span>
          <span>手牌: {{ gameState.players[1].hand.length }}</span>
          <span>牌组: {{ gameState.players[1].deck.length }}</span>
        </div>
      </div>
      
      <!-- AI场上 -->
      <div class="field">
        <div class="field-label">场上 ({{ gameState.players[1].field.length + aiHiddenCards.length }}/6)</div>
        <div class="cards">
          <div v-for="(card, index) in gameState.players[1].field" :key="index" class="card">
            <div class="card-name">{{ card.name }}</div>
            <div class="card-stats">
              <span>⚡{{ card.cost }}</span>
              <span>💪{{ card.power }}</span>
            </div>
          </div>
          <!-- 显示AI隐藏的卡牌 -->
          <div v-for="(card, index) in aiHiddenCards" :key="'hidden-' + index" class="card hidden-card">
            <div class="card-back">?</div>
          </div>
          <div v-for="i in (6 - gameState.players[1].field.length - aiHiddenCards.length)" :key="'empty-' + i" class="card empty">
            空槽位
          </div>
        </div>
      </div>
    </div>

    <!-- 玩家区域 -->
    <div class="player-area player-area-main">
      <div class="player-header">
        <h3>{{ gameState.players[0].name }}</h3>
        <div class="stats">
          <span>费用: {{ gameState.players[0].currentCost }}</span>
          <span class="power-display">总战力: <strong>{{ getTotalPower(0) }}</strong></span>
          <span>手牌: {{ gameState.players[0].hand.length }}</span>
          <span>牌组: {{ gameState.players[0].deck.length }}</span>
        </div>
      </div>

      <!-- 玩家场上 -->
      <div class="field">
        <div class="field-label">场上 ({{ gameState.players[0].field.length }}/6)</div>
        <div class="cards">
          <div v-for="(card, index) in gameState.players[0].field" :key="index" class="card">
            <div class="card-name">{{ card.name }}</div>
            <div class="card-stats">
              <span>⚡{{ card.cost }}</span>
              <span>💪{{ card.power }}</span>
            </div>
            <div class="card-effect" v-if="card.effect">{{ card.effect }}</div>
          </div>
          <div v-for="i in (6 - gameState.players[0].field.length)" :key="'empty-' + i" class="card empty">
            空槽位
          </div>
        </div>
      </div>

      <!-- 玩家手牌 -->
      <div class="hand">
        <div class="hand-label">
          手牌
          <span v-if="reforgeState.active && reforgeOptions.includes('redraw') && reforgeState.selectedCard === null" class="hint">
            (点击选择要放回牌组的卡牌)
          </span>
          <span v-else-if="!reforgeState.active && hasPlayedThisTurn && !canPlayExtra" class="hint-disabled">
            (本回合已出牌)
          </span>
          <span v-else-if="!reforgeState.active && canPlayExtra" class="hint-extra">
            (可以额外出一张牌！)
          </span>
        </div>
        <div class="cards">
          <div 
            v-for="(card, index) in gameState.players[0].hand" 
            :key="index" 
            class="card hand-card"
            :class="{ 
              'playable': isCardPlayable(index),
              'disabled': !isCardPlayable(index) && !reforgeState.active,
              'selectable': reforgeState.active && reforgeOptions.includes('redraw') && reforgeState.selectedCard === null,
              'selected': reforgeState.selectedCard === index
            }"
            @click="onHandCardClick(index)"
          >
            <div class="card-name">{{ card.name }}</div>
            <div class="card-stats">
              <span>⚡{{ card.cost }}</span>
              <span>💪{{ card.power }}</span>
            </div>
            <div class="card-effect" v-if="card.effect">{{ card.effect }}</div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <button 
          v-if="gameState.phase === 'draw' && gameState.round === 0"
          @click="initGame"
          class="btn btn-primary"
        >
          开始游戏
        </button>

        <template v-if="gameState.phase === 'decision' && currentPlayer.id === 'player'">
          <button @click="choosePlay" class="btn btn-primary">出牌</button>
          <button @click="chooseReforge" class="btn btn-secondary">重铸</button>
        </template>

        <template v-if="gameState.phase === 'action' && currentPlayer.id === 'player' && !reforgeState.active">
          <button @click="endTurn" class="btn btn-secondary">结束回合</button>
        </template>

        <!-- 重铸选项 -->
        <div v-if="reforgeState.active && reforgeOptions.length < 2" class="reforge-options">
          <div class="reforge-info">
            选择操作 ({{ reforgeOptions.length }}/2)
            <span v-if="reforgeOptions.includes('redraw') && reforgeState.selectedCard === null" class="warning">
              - 请先选择要换掉的手牌
            </span>
          </div>
          <button @click="selectReforgeOption('gainCost')" class="btn btn-small">恢复2费用</button>
          <button @click="selectReforgeOption('redraw')" class="btn btn-small">换牌</button>
          <button @click="selectReforgeOption('gainPower')" class="btn btn-small">战力+1</button>
        </div>

        <button 
          v-if="gameState.phase === 'gameOver'"
          @click="initGame"
          class="btn btn-primary"
        >
          重新开始
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  color: white;
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
}

.final-round {
  color: #ff6b6b;
  animation: pulse 1s infinite;
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

.ai-area {
  border: 2px solid rgba(255, 100, 100, 0.5);
}

.player-area-main {
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

.field, .hand {
  margin-bottom: 20px;
}

.field-label, .hand-label {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 10px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.card {
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  border-radius: 10px;
  padding: 15px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.3s;
}

.card.empty {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.5);
  border: 2px dashed rgba(255, 255, 255, 0.3);
  justify-content: center;
  align-items: center;
}

.hand-card {
  cursor: pointer;
  border: 2px solid transparent;
}

.hand-card.playable {
  border-color: #4caf50;
  box-shadow: 0 0 15px rgba(76, 175, 80, 0.5);
}

.hand-card.playable:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 20px rgba(76, 175, 80, 0.7);
}

.hand-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hand-card.selectable {
  border-color: #ff9800;
  cursor: pointer;
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

.hidden-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 48px;
  font-weight: bold;
  animation: cardPulse 1.5s infinite;
}

@keyframes cardPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.card-back {
  font-size: 64px;
}

.power-display {
  font-size: 18px;
  color: #ffd700;
}

.power-display strong {
  font-size: 22px;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
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

.warning {
  color: #f44336;
  font-size: 14px;
}

.card-name {
  font-weight: bold;
  font-size: 16px;
}

.card-stats {
  display: flex;
  gap: 10px;
  font-size: 14px;
}

.card-effect {
  font-size: 12px;
  color: #666;
  font-style: italic;
  margin-top: auto;
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

.btn-primary {
  background: #4caf50;
  color: white;
}

.btn-primary:hover {
  background: #45a049;
  transform: scale(1.05);
}

.btn-secondary {
  background: #2196f3;
  color: white;
}

.btn-secondary:hover {
  background: #0b7dda;
  transform: scale(1.05);
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

.btn-cancel {
  background: #f44336;
}

.btn-cancel:hover {
  background: #da190b;
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
</style>
