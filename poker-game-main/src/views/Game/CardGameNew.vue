<script setup lang="ts">
import { useGame } from '@/composables/useGameNew'
import type { ReforgeOption } from '@/types/game'
import CardDetailPopover from '@/components/CardDetailPopover.vue'
import GameAnimationLayer from '@/components/GameAnimationLayer.vue'
import { useFieldCardDetail } from '@/composables/useFieldCardDetail'
import { useGameAnimations } from '@/composables/useGameAnimations'
import { registerEscHandler } from '@/utils/escNavigation'

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
  cancelCardSelection,
  isCardPlayable,
  canChoosePlay,
  canChooseReforge,
  finalRoundTacticsOnly,
} = useGame()

const {
  hoveredCardKey,
  hoveredCard,
  hoverStyle,
  pinnedCard,
  fieldCardKey,
  onFieldCardEnter: onFieldCardEnterDetail,
  onFieldCardLeave,
  onFieldCardClick,
  closePinned,
} = useFieldCardDetail()

const { animState } = useGameAnimations()

function slotFlashKey(playerId: string, slotIndex: number) {
  return `${playerId}-${slotIndex}`
}

function isSlotFlashing(playerId: string, slotIndex: number) {
  const f = animState.landFlash
  return f && f.fieldOwnerId === playerId && f.slotIndex === slotIndex
}

const reforgeOptions = ref<ReforgeOption[]>([])

const isPreGame = computed(() =>
  gameState.value.round === 0
  && gameState.value.phase === 'draw'
  && (gameState.value.players[0]?.hand.length ?? 0) === 0,
)

function isDeployPhase() {
  const p = gameState.value.phase
  return p === 'selectSlot' || p === 'selectCrossPlayerSlot' || p === 'selectTarget'
}

function onFieldCardEnter(e: MouseEvent, playerId: string, slotKey: string | number, card: import('@/types/game').Card) {
  onFieldCardEnterDetail(e, playerId, slotKey, card)
}

let unregisterEsc: (() => void) | undefined
onMounted(() => {
  unregisterEsc = registerEscHandler(() => {
    if (pinnedCard.value) {
      closePinned()
      return true
    }
    return false
  })
})
onUnmounted(() => { unregisterEsc?.() })

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

/** 布局顺序：AI 在上、玩家在下，每行一个场地 */
const layoutPlayers = computed(() => {
  const ps = gameState.value.players
  const human = ps.find(p => p.id === 'player')
  const ais = ps.filter(p => p.id !== 'player')
  return human ? [...ais, human] : ps
})

function playerIndex(playerId: string) {
  return gameState.value.players.findIndex(p => p.id === playerId)
}
</script>

<template>
  <div class="game-container">
    <!-- 游戏信息栏 -->
    <div class="game-info">
      <div class="round-info">
        <span>回合: {{ gameState.round }}</span>
        <span v-if="gameState.isFinalRound" class="final-round">最后一回合！</span>
        <span v-if="isPreGame" class="pregame-badge">未开始</span>
      </div>
      <div class="message">{{ gameState.message }}</div>
    </div>

    <!-- N-player areas（单列滚动，每行一个玩家场地） -->
    <div class="players-grid" :class="'players-' + gameState.players.length">
      <div
        v-for="player in layoutPlayers"
        :key="player.id"
        class="player-cell"
        :data-player-id="player.id"
        :data-fly-origin="player.id"
        :class="{
          'is-human': player.id === 'player',
          'is-ai': player.id.startsWith('ai'),
          'is-current': playerIndex(player.id) === gameState.currentPlayerIndex
        }"
      >
        <div class="player-header">
          <h3>{{ player.name }} {{ player.id === 'player' ? '(你)' : '' }}</h3>
          <div class="stats">
            <span :class="{ 'negative-cost': player.currentCost < 0 }">费用: {{ player.currentCost }}</span>
            <span class="power-display">总战力: <strong>{{ getTotalPower(playerIndex(player.id)) }}</strong></span>
            <span>手牌: {{ player.hand.length }}</span>
            <span :data-deck-zone="player.id">牌组: {{ player.deck.length }}</span>
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
              :data-field-slot="slotFlashKey(player.id, player.field.indexOf(slot))"
              :class="{
                'has-card': slot.card,
                'slot-land-flash': isSlotFlashing(player.id, player.field.indexOf(slot)),
                'selectable': (player.id === 'player' && (isSlotAvailable(player.field.indexOf(slot)) || (gameState.phase === 'selectTarget' && slot.card)))
                  || isCrossPlayerSlotAvailable(playerIndex(player.id), player.field.indexOf(slot)),
                'selected': player.id === 'player' && gameState.selectedSlot === player.field.indexOf(slot)
              }"
              @click="onFieldSlotClick(playerIndex(player.id), slot); player.id === 'player' && gameState.phase === 'selectTarget' && slot.card && selectQuickPlayTarget(slot.card!)"
            >
              <div
                v-if="slot.card"
                class="field-card"
                @mouseenter="onFieldCardEnter($event, player.id, si, slot.card)"
                @mouseleave="onFieldCardLeave(player.id, si)"
                @click="onFieldCardClick(slot.card, $event, () => isDeployPhase())"
              >
                <div class="card-name-small">{{ slot.card.name }}</div>
                <div class="card-power" :style="{ color: getPowerColor(slot.card) }">
                  {{ slot.card.currentPower }}
                </div>
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
                    @mouseenter="onFieldCardEnter($event, player.id, extraSlot.position, extraSlot.card)"
                    @mouseleave="onFieldCardLeave(player.id, extraSlot.position)"
                    @click="onFieldCardClick(extraSlot.card, $event, () => isDeployPhase())"
                  >
                    <div class="card-name-small">{{ extraSlot.card.name }}</div>
                    <div class="card-power" :style="{ color: getPowerColor(extraSlot.card) }">
                      {{ extraSlot.card.currentPower }}
                    </div>
                  </div>
                  <div v-else class="empty-slot extra">额外</div>
                </div>
              </div>
            </div>

            <!-- AI隐藏卡牌 -->
            <div
              v-if="!player.id.startsWith('player')"
              v-for="(item, hi) in (aiHiddenCards[player.id] || [])"
              :key="'hidden-' + hi"
              class="field-slot has-card"
              :data-hidden-card="player.id + '-' + hi"
            >
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
          <div class="hand-cards" :data-hand-zone="player.id">
            <div
              v-for="(card, ci) in player.hand"
              :key="ci"
              class="hand-card"
              :data-hand-card="player.id + '-' + ci"
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

        <!-- 操作按钮（人类玩家+当前回合，紧贴手牌下方） -->
        <div v-if="player.id === 'player' && playerIndex(player.id) === gameState.currentPlayerIndex" class="actions">
          <div v-if="gameState.phase === 'decision'" class="action-group decision-bar">
            <button v-if="canChoosePlay" @click="choosePlay" class="btn btn-primary">出牌</button>
            <button v-if="canChooseReforge" @click="chooseReforge" class="btn btn-secondary">重铸</button>
            <span v-if="finalRoundTacticsOnly && canChoosePlay" class="hint">(场地已满，仅可出战术牌)</span>
          </div>
          <div v-if="isDeployPhase()" class="action-group">
            <button type="button" class="btn btn-secondary" @click="cancelCardSelection">取消出牌</button>
          </div>
          <div v-if="gameState.phase === 'action' && !reforgeState.active" class="action-group">
            <button @click="endTurn" class="btn btn-secondary">结束回合</button>
          </div>
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

    <GameAnimationLayer />

    <Teleport to="body">
      <div v-if="isPreGame" class="pregame-overlay">
        <div class="pregame-panel">
          <h2>单机对战设置</h2>
          <p class="pregame-desc">选择 AI 对手数量后开始游戏</p>
          <label class="pregame-label">
            对局人数（含你）
            <select v-model="playerCountStart" class="pregame-select">
              <option :value="2">2 人（你 + 1 AI）</option>
              <option :value="3">3 人（你 + 2 AI）</option>
              <option :value="4">4 人（你 + 3 AI）</option>
            </select>
          </label>
          <button type="button" class="btn btn-primary pregame-start" @click="initGame(playerCountStart)">开始游戏</button>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="hoveredCard && hoveredCardKey" class="field-hover-popover" :style="hoverStyle">
        <CardDetailPopover :card="hoveredCard" />
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="pinnedCard" class="detail-overlay" @click="closePinned">
        <div class="detail-modal-wrap" @click.stop>
          <CardDetailPopover :card="pinnedCard" variant="modal" />
          <p class="detail-tip">点击空白处关闭</p>
        </div>
      </div>
    </Teleport>

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
  min-height: 100vh;
  width: 100%;
  max-width: 100vw;
  background: #f6f4ef;
  color: #1f2522;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
  padding: 8px 12px 32px;
}
.players-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  min-height: min-content;
  padding: 4px 0 16px;
}
.player-cell {
  background: #fffdf8;
  border: 1px solid #d8d2c4;
  border-radius: 8px;
  padding: 8px 10px;
  min-height: min-content;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
}
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
  grid-template-columns: repeat(6, minmax(80px, 1fr));
  gap: 8px;
  padding: 0;
  width: 100%;
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

.field-slot.slot-land-flash {
  animation: slot-land-pulse 320ms ease-out;
}

@keyframes slot-land-pulse {
  0% { box-shadow: 0 0 0 rgba(164, 109, 31, 0); transform: scale(1); }
  40% { box-shadow: 0 0 24px rgba(164, 109, 31, 0.85); transform: scale(1.06); border-color: #a46d1f; }
  100% { box-shadow: 0 0 0 rgba(164, 109, 31, 0); transform: scale(1); }
}

.field-card {
  text-align: center;
  width: 100%;
  position: relative;
  cursor: pointer;
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
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding: 8px 0 0;
  flex-shrink: 0;
}

.action-group {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
}

.decision-bar {
  padding: 10px 14px;
  background: #f6f4ef;
  border: 1px solid #d8d2c4;
  border-radius: 10px;
}

.decision-bar .btn {
  min-width: 96px;
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

.pregame-badge {
  margin-left: auto;
  font-size: 13px;
  color: #69706b;
  background: #e8e4da;
  padding: 2px 10px;
  border-radius: 999px;
}

.pregame-overlay {
  position: fixed;
  inset: 0;
  z-index: 2500;
  background: rgba(31, 37, 34, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.pregame-panel {
  background: #fffdf8;
  border: 2px solid #a46d1f;
  border-radius: 14px;
  padding: 28px 32px;
  max-width: 360px;
  width: 100%;
  text-align: center;
  box-shadow: 0 12px 40px rgba(31, 37, 34, 0.2);
}

.pregame-panel h2 {
  margin: 0 0 8px;
  color: #1f2522;
}

.pregame-desc {
  margin: 0 0 20px;
  color: #69706b;
  font-size: 14px;
}

.pregame-label {
  display: block;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #1f2522;
}

.pregame-select {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid #d8d2c4;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
}

.pregame-start {
  width: 100%;
  padding: 12px 20px;
  font-size: 16px;
}

.field-hover-popover {
  z-index: 5000;
}

.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(31, 37, 34, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.detail-modal-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.detail-tip {
  margin: 0;
  font-size: 12px;
  color: #fffdf8;
  opacity: 0.9;
}
</style>
