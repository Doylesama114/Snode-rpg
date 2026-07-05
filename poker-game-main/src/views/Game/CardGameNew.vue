<script setup lang="ts">
import { useGame } from '@/composables/useGameNew'
import type { ReforgeOption } from '@/types/game'
import CardDetailPopover from '@/components/CardDetailPopover.vue'

const { 
  gameState, 
  currentPlayer, 
  otherPlayers, 
  aiHiddenCards, 
  reforgeState, 
  hasPlayedThisTurn, 
  canPlayExtra,
  initGame, 
  choosePlay, 
  chooseReforge, 
  selectCardToPlay,
  selectSlotToPlay,
  selectCrossPlayerSlotToPlay,
  isCrossPlayerSlotAvailable,
  selectTacticTarget,
  selectQuickPlayTarget,
  selectReforgeCard, 
  executeReforge, 
  endTurn,
  isCardPlayable
} = useGame()

const reforgeOptions = ref<ReforgeOption[]>([])
const hoveredCardKey = ref<string | null>(null)

function fieldCardKey(playerId: string, slotKey: string | number) {
  return `${playerId}-${slotKey}`
}

function onFieldSlotClick(playerIndex: number, slotRef: unknown) {
  const player = gameState.value.players[playerIndex]
  if (!player) return
  const actualIndex = player.field.indexOf(slotRef as typeof player.field[0])
  if (actualIndex < 0) return
  if (player.id === 'player' && gameState.value.phase === 'selectSlot' && isSlotAvailable(actualIndex)) {
    selectSlotToPlay(actualIndex)
    return
  }
  if (gameState.value.phase === 'selectCrossPlayerSlot' && isCrossPlayerSlotAvailable(playerIndex, actualIndex)) {
    selectCrossPlayerSlotToPlay(playerIndex, actualIndex)
  }
}

function onFieldCardEnter(playerId: string, slotKey: string | number) {
  hoveredCardKey.value = fieldCardKey(playerId, slotKey)
}

function onFieldCardLeave(playerId: string, slotKey: string | number) {
  if (hoveredCardKey.value === fieldCardKey(playerId, slotKey)) {
    hoveredCardKey.value = null
  }
}

function selectReforgeOption(option: ReforgeOption) {
  if (reforgeOptions.value.length < 2) {
    reforgeOptions.value.push(option)
    
    if (reforgeOptions.value.length === 2) {
      if (reforgeOptions.value.includes('redraw') && reforgeState.value.selectedCard === null) {
        return
      }
      
      executeReforge([reforgeOptions.value[0], reforgeOptions.value[1]])
      reforgeOptions.value = []
    }
  }
}

function onHandCardClick(index: number) {
  if (reforgeState.value.active && reforgeOptions.value.includes('redraw') && reforgeState.value.selectedCard === null) {
    selectReforgeCard(index)
    
    if (reforgeOptions.value.length === 2) {
      executeReforge([reforgeOptions.value[0], reforgeOptions.value[1]])
      reforgeOptions.value = []
    }
  } else if (gameState.value.phase === 'action' && currentPlayer.value.id === 'player' && !reforgeState.value.active) {
    selectCardToPlay(index)
  }
}

function getTotalPower(playerIndex: number) {
  const player = gameState.value.players[playerIndex]
  let totalPower = player.bonusPower
  player.field.forEach(slot => {
    if (slot.card && !slot.isExtra) {
      totalPower += slot.card.currentPower
    }
  })
  return totalPower
}

function getPowerColor(card: { currentPower: number; basePower: number }): string {
  if (card.currentPower > card.basePower) return '#2f6f5e'
  if (card.currentPower < card.basePower) return '#9d2f2f'
  return '#1f2522'
}

function getCardTypeDisplay(card: { type: string }): string {
  if (card.type === 'environment') return '环境'
  if (card.type === 'tactic') return '战术'
  return ''
}

function isSlotAvailable(slotIndex: number): boolean {
  return gameState.value.availableSlots?.includes(slotIndex) || false
}

function onExtraSlotClick(slotIndex: number) {
  if (gameState.value.phase === 'selectSlot' && isSlotAvailable(slotIndex)) {
    selectSlotToPlay(slotIndex)
  }
}

const playerCountStart = ref(2)
</script>

<template>
  <div class="game-container">
    <!-- 游戏信息栏 -->
    <div class="game-info">
      <div class="round-info">
        <span>回合: {{ gameState.round }}</span>
        <span v-if="gameState.isFinalRound" class="final-round">最后一回合！</span>
        <span v-if="gameState.phase === 'draw' && gameState.round === 0" style="margin-left:auto;display:flex;align-items:center;gap:8px">
          人数:
          <select v-model="playerCountStart" style="padding:4px 8px;border-radius:4px;border:1px solid #d8d2c4">
            <option :value="2">2人</option>
            <option :value="3">3人</option>
            <option :value="4">4人</option>
          </select>
        </span>
      </div>
      <div class="message">{{ gameState.message }}</div>
    </div>

    <!-- N-player areas -->
    <div class="players-grid" :class="'players-' + gameState.players.length">
      <div
        v-for="(player, index) in gameState.players"
        :key="player.id"
        class="player-cell"
        :class="{
          'is-human': player.id === 'player',
          'is-ai': player.id.startsWith('ai'),
          'is-current': index === gameState.currentPlayerIndex
        }"
      >
        <div class="player-header">
          <h3>{{ player.name }} {{ player.id === 'player' ? '(你)' : '' }}</h3>
          <div class="stats">
            <span :class="{ 'negative-cost': player.currentCost < 0 }">费用: {{ player.currentCost }}</span>
            <span class="power-display">总战力: <strong>{{ getTotalPower(index) }}</strong></span>
            <span>手牌: {{ player.hand.length }}</span>
            <span>牌组: {{ player.deck.length }}</span>
          </div>
        </div>

        <!-- 场上 -->
        <div class="field">
          <div class="field-label">场上</div>
          <div class="field-grid">
            <div
              v-for="(slot, si) in player.field.filter(s => !s.isExtra)"
              :key="si"
              class="field-slot"
              :class="{
                'has-card': slot.card,
                'selectable': (player.id === 'player' && (isSlotAvailable(player.field.indexOf(slot)) || (gameState.phase === 'selectTarget' && slot.card)))
                  || isCrossPlayerSlotAvailable(index, player.field.indexOf(slot)),
                'selected': player.id === 'player' && gameState.selectedSlot === player.field.indexOf(slot)
              }"
              @click="onFieldSlotClick(index, slot); player.id === 'player' && gameState.phase === 'selectTarget' && slot.card && selectQuickPlayTarget(slot.card!)"
            >
              <div
                v-if="slot.card"
                class="field-card"
                @mouseenter="onFieldCardEnter(player.id, si)"
                @mouseleave="onFieldCardLeave(player.id, si)"
              >
                <div class="card-name-small">{{ slot.card.name }}</div>
                <div class="card-power" :style="{ color: getPowerColor(slot.card) }">
                  {{ slot.card.currentPower }}
                </div>
                <CardDetailPopover
                  v-if="hoveredCardKey === fieldCardKey(player.id, si)"
                  :card="slot.card"
                />
              </div>
              <div v-else class="empty-slot">{{ player.id === 'player' ? si + 1 : '空' }}</div>

              <!-- 额外槽位 -->
              <div v-if="player.field.find(s => s.isExtra && s.parentSlot === si)" class="extra-slot-container">
                <div
                  v-for="extraSlot in player.field.filter(s => s.isExtra && s.parentSlot === si)"
                  :key="extraSlot.position"
                  class="extra-slot"
                  :class="{
                    'selectable': player.id === 'player' && isSlotAvailable(extraSlot.position),
                    'selected': player.id === 'player' && gameState.selectedSlot === extraSlot.position
                  }"
                  @click.stop="onExtraSlotClick(extraSlot.position)"
                >
                  <div
                    v-if="extraSlot.card"
                    class="field-card extra"
                    @mouseenter="onFieldCardEnter(player.id, extraSlot.position)"
                    @mouseleave="onFieldCardLeave(player.id, extraSlot.position)"
                  >
                    <div class="card-name-small">{{ extraSlot.card.name }}</div>
                    <div class="card-power" :style="{ color: getPowerColor(extraSlot.card) }">
                      {{ extraSlot.card.currentPower }}
                    </div>
                    <CardDetailPopover
                      v-if="hoveredCardKey === fieldCardKey(player.id, extraSlot.position)"
                      :card="extraSlot.card"
                    />
                  </div>
                  <div v-else class="empty-slot extra">额外</div>
                </div>
              </div>
            </div>

            <!-- AI隐藏卡牌 -->
            <div v-if="!player.id.startsWith('player')" v-for="(item, hi) in (aiHiddenCards[player.id] || [])" :key="'hidden-' + hi" class="field-slot has-card">
              <div class="field-card hidden">
                <div class="card-back">?</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 手牌（人类玩家） -->
        <div v-if="player.id === 'player'" class="hand">
          <div class="hand-label">
            手牌
            <span v-if="reforgeState.active && reforgeOptions.includes('redraw') && reforgeState.selectedCard === null" class="hint">(点选放回)</span>
            <span v-else-if="!reforgeState.active && hasPlayedThisTurn && !canPlayExtra" class="hint-disabled">(已出牌)</span>
            <span v-else-if="!reforgeState.active && canPlayExtra" class="hint-extra">(可额外出牌!)</span>
          </div>
          <div class="hand-cards">
            <div
              v-for="(card, ci) in player.hand"
              :key="ci"
              class="hand-card"
              :class="{
                'playable': isCardPlayable(ci),
                'disabled': !isCardPlayable(ci) && !reforgeState.active,
                'selectable': reforgeState.active && reforgeOptions.includes('redraw') && reforgeState.selectedCard === null,
                'selected': reforgeState.selectedCard === ci
              }"
              @click="onHandCardClick(ci)"
            >
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
            </div>
          </div>
        </div>

        <!-- 操作按钮（人类玩家+当前回合） -->
        <div v-if="player.id === 'player' && index === gameState.currentPlayerIndex" class="actions">
          <button v-if="gameState.phase === 'draw' && gameState.round === 0" @click="initGame(playerCountStart)" class="btn btn-primary">开始游戏</button>
          <template v-if="gameState.phase === 'decision'">
            <button @click="choosePlay" class="btn btn-primary">出牌</button>
            <button @click="chooseReforge" class="btn btn-secondary">重铸</button>
          </template>
          <template v-if="gameState.phase === 'action' && !reforgeState.active">
            <button @click="endTurn" class="btn btn-secondary">结束回合</button>
          </template>
          <div v-if="reforgeState.active && reforgeOptions.length < 2" class="reforge-options">
            <div class="reforge-info">选择操作 ({{ reforgeOptions.length }}/2)
              <span v-if="reforgeOptions.includes('redraw') && reforgeState.selectedCard === null" class="warning"> - 请先选择手牌</span>
            </div>
            <button @click="selectReforgeOption('gainCost')" class="btn btn-small">+2费用</button>
            <button @click="selectReforgeOption('redraw')" class="btn btn-small">换牌</button>
            <button @click="selectReforgeOption('gainPower')" class="btn btn-small">战力+1</button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="gameState.phase === 'gameOver'" class="game-over-overlay">
        <div class="game-over-panel">
          <h2 class="game-over-title">游戏结束</h2>
          <p class="game-over-message">{{ gameState.message }}</p>
          <div class="game-over-actions">
            <button @click="initGame(playerCountStart)" class="btn btn-primary">重新开始</button>
            <button @click="$router.push('/')" class="btn btn-secondary">返回主页</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.game-container {
  height: 100vh;
  width: 100vw;
  background: #f6f4ef;
  color: #1f2522;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
  padding: 8px 12px;
}
.players-grid {
  flex: 1 0 auto;
  display: grid;
  gap: 8px;
  min-height: min-content;
  overflow: visible;
  padding: 4px 0 24px;
}
.players-2 { grid-template-columns: 1fr; grid-auto-rows: auto; }
.players-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: auto; }
.players-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: auto; }
.players-3 .player-cell.is-human,
.players-4 .player-cell.is-human {
  grid-column: 1 / -1;
}
.player-cell { background: #fffdf8; border: 1px solid #d8d2c4; border-radius: 8px; padding: 6px 8px; min-height: min-content; display: flex; flex-direction: column; }
.player-cell.is-current { border-color: #a46d1f; border-width: 2px; }
.player-cell.is-human { border-left: 4px solid #2f6f5e; }
.player-cell.is-ai { border-left: 4px solid #9d2f2f; }

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

.ai-area {
  border: 1px solid #d8d2c4;
  border-left: 4px solid #9d2f2f;
}

.player-area-main {
  border: 1px solid #d8d2c4;
  border-left: 4px solid #2f6f5e;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
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
  grid-template-columns: repeat(6, minmax(72px, 1fr));
  gap: 6px;
  padding: 0;
  overflow-x: auto;
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
  position: relative;
}

.field-card.hidden {
  background: #f6f4ef;
  padding: 15px;
  border-radius: 8px;
}

.card-back {
  font-size: 40px;
  font-weight: bold;
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

.extra-slot-container {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed rgba(255, 255, 255, 0.3);
}

.extra-slot {
  background: rgba(255, 215, 0, 0.2);
  border: 1px dashed rgba(255, 215, 0, 0.5);
  border-radius: 4px;
  padding: 4px;
  margin-top: 4px;
  transition: all 0.3s;
}

.extra-slot.selectable {
  border-color: #a46d1f;
  cursor: pointer;
}

.extra-slot.selectable:hover {
  transform: scale(1.05);
}

.field-card.extra {
  font-size: 11px;
}

.empty-slot.extra {
  font-size: 9px;
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
  transform: translateY(-8px);
  box-shadow: 0 8px 20px rgba(76, 175, 80, 0.7);
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

.target-selection {
  background: #fffdf8; border: 1px solid #d8d2c4;
  padding: 10px;
  border-radius: 10px;
  flex-shrink: 0;
}

.target-label {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 8px;
}

.target-cards {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.target-card {
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid transparent;
}

.target-card:hover {
  border-color: #a46d1f;
  transform: scale(1.05);
  box-shadow: 0 0 15px rgba(76, 175, 80, 0.5);
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: space-between;
  padding: 10px 0 0;
  flex-shrink: 0;
  margin-top: auto;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: #a46d1f;
  color: #fff;
}

.btn-primary:hover {
  background: #8a5718;
  transform: scale(1.05);
}

.btn-secondary {
  background: #f6f4ef;
  border: 1px solid #d8d2c4;
  color: #1f2522;
}

.btn-secondary:hover {
  background: #e8e4da;
  transform: scale(1.05);
}

.btn-small {
  padding: 6px 14px;
  font-size: 13px;
  background: #a46d1f;
  color: #fff;
}

.btn-small:hover {
  background: #8a5718;
}

.reforge-options {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  background: #fffdf8; border: 1px solid #d8d2c4;
  padding: 6px 10px;
  border-radius: 8px;
  width: 100%;
}

.reforge-info {
  font-weight: bold;
  font-size: 14px;
  margin-right: 8px;
}

.warning {
  color: #9d2f2f;
  font-size: 13px;
}

.negative-cost { color: #9d2f2f; font-weight: bold; }

.game-over-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(31, 37, 34, 0.55);
  padding: 16px;
}

.game-over-panel {
  background: #fffdf8;
  border: 2px solid #a46d1f;
  border-radius: 14px;
  padding: 24px 28px;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: 0 12px 40px rgba(31, 37, 34, 0.25);
}

.game-over-title {
  margin: 0 0 12px;
  font-size: 22px;
  color: #a46d1f;
}

.game-over-message {
  margin: 0 0 20px;
  font-size: 15px;
  line-height: 1.5;
  color: #1f2522;
}

.game-over-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}
</style>
