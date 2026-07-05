<script setup lang="ts">
import { useGame } from '@/composables/useGameNew'
import type { ReforgeOption } from '@/types/game'
import CardDetailPopover from '@/components/CardDetailPopover.vue'
import GameAnimationLayer from '@/components/GameAnimationLayer.vue'
import GameBroadcastPanel from '@/components/GameBroadcastPanel.vue'
import StatusBar from '@/components/game/StatusBar.vue'
import ActionDock from '@/components/game/ActionDock.vue'
import PlayerStrip from '@/components/game/PlayerStrip.vue'
import PlayerFieldSection from '@/components/game/PlayerFieldSection.vue'
import GameCard from '@/components/game/GameCard.vue'
import GameButton from '@/components/game/GameButton.vue'
import { useFieldCardDetail } from '@/composables/useFieldCardDetail'
import { useGameAnimations } from '@/composables/useGameAnimations'
import { registerEscHandler } from '@/utils/escNavigation'
import { computed, ref, unref, watch, onMounted, onUnmounted } from 'vue'
import { syncBroadcastFromMessage } from '@/utils/gameBroadcast'
import { EffectManager } from '@/game/effectManager'

const gameApi = useGame()
const { 
  gameState, 
  currentPlayer, 
  otherPlayers, 
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
  cancelActionChoice,
  resolveEffectBranchChoice,
  skipEffectBranch,
  isCardPlayable,
  canChoosePlay,
  canChooseReforge,
  finalRoundTacticsOnly,
} = gameApi

/** AI 隐藏牌（保留 ref 引用，避免解构丢响应式） */
const aiHiddenCardsMap = computed(() => unref(gameApi.aiHiddenCards) as Record<string, Array<{ card: import('@/types/game').Card, slot: number }>>)

function getAiHiddenAtSlot(playerId: string, slotIndex: number) {
  return aiHiddenCardsMap.value[playerId]?.find(item => item.slot === slotIndex) ?? null
}

function getAiHiddenDomKey(playerId: string, slotIndex: number) {
  const list = aiHiddenCardsMap.value[playerId] ?? []
  const hi = list.findIndex(item => item.slot === slotIndex)
  return hi >= 0 ? `${playerId}-${hi}` : `${playerId}-slot-${slotIndex}`
}

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

const { animState, triggerSlotShake, isSlotShaking, isSlotBouncing, getPowerPulseDelta } = useGameAnimations()

function slotFlashKey(playerId: string, slotIndex: number) {
  return `${playerId}-${slotIndex}`
}

function isSlotFlashing(playerId: string, slotIndex: number) {
  const f = animState.landFlash
  return f && f.fieldOwnerId === playerId && f.slotIndex === slotIndex
}

const reforgeOptions = ref<ReforgeOption[]>([])
const effectBranchDiscardIndex = ref<number | null>(null)

const pendingEffectBranch = computed(() =>
  gameState.value.pendingEffectBranches?.['player'] ?? null,
)

function handleCancelAction() {
  cancelActionChoice()
  reforgeOptions.value = []
}

function onEffectBranchHandClick(index: number) {
  const pending = pendingEffectBranch.value
  if (!pending || gameState.value.phase !== 'selectEffectBranch') return
  const card = currentPlayer.value.hand[index]
  if (!card || !pending.discardHandAttributes.includes(card.attribute)) return
  effectBranchDiscardIndex.value = index
}

function confirmEffectBranch(branch: 'A' | 'B' | 'C') {
  if (effectBranchDiscardIndex.value === null) {
    gameState.value.message = '请先选择要弃置的水属性手牌'
    return
  }
  resolveEffectBranchChoice(branch, effectBranchDiscardIndex.value)
  effectBranchDiscardIndex.value = null
}

function handleSkipEffectBranch() {
  skipEffectBranch()
  effectBranchDiscardIndex.value = null
}

let prevBroadcastMessage = ''
watch(() => gameState.value.message, (msg) => {
  if (!msg) return
  syncBroadcastFromMessage(gameState.value, prevBroadcastMessage)
  prevBroadcastMessage = msg
})

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

function onHandCardEnter(e: MouseEvent, playerId: string, cardIndex: number, card: import('@/types/game').Card) {
  onFieldCardEnterDetail(e, playerId, `hand-${cardIndex}`, card)
}

function onHandCardLeave(playerId: string, cardIndex: number) {
  onFieldCardLeave(playerId, `hand-${cardIndex}`)
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

  if (player.id === 'player' && isDeployPhase()) {
    const slot = player.field[actualIndex]
    if (gameState.value.phase === 'selectSlot' && !isSlotAvailable(actualIndex)) {
      triggerSlotShake(player.id, actualIndex)
      return
    }
    if (gameState.value.phase === 'selectTarget' && slot.card && !isTargetSelectable(slot.card)) {
      triggerSlotShake(player.id, actualIndex)
      return
    }
  }

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
  if (gameState.value.phase === 'selectEffectBranch') {
    onEffectBranchHandClick(index)
    return
  }
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
  return EffectManager.getPlayerTotalPower(player)
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

function isTargetSelectable(card: import('@/types/game').Card | null | undefined): boolean {
  if (gameState.value.phase !== 'selectTarget' || !card) return false
  return gameState.value.availableTargets?.some(t => t === card) ?? false
}

function powerPulseLevel(playerId: string, slotIndex: number): 'up' | 'down' | null {
  const d = getPowerPulseDelta(playerId, slotIndex)
  if (d === undefined) return null
  if (d > 0) return 'up'
  if (d < 0) return 'down'
  return null
}

function countFieldCards(player: import('@/types/game').Player) {
  return player.field.filter(s => s.card).length
}

const humanPlayer = computed(() => gameState.value.players.find(p => p.id === 'player'))
const opponentPlayers = computed(() => layoutPlayers.value.filter(p => p.id !== 'player'))

const showActionDock = computed(() =>
  humanPlayer.value
  && playerIndex('player') === gameState.value.currentPlayerIndex
  && gameState.value.phase !== 'draw',
)

const isYourTurn = computed(() =>
  playerIndex('player') === gameState.value.currentPlayerIndex
  && gameState.value.phase !== 'draw'
  && !isPreGame.value,
)

function onHumanFieldSlotClick(_slot: unknown, si: number) {
  onFieldSlotClick(playerIndex('player'), humanPlayer.value!.field[si])
  if (gameState.value.phase === 'selectTarget') {
    const card = humanPlayer.value?.field[si]?.card
    if (card && isTargetSelectable(card)) selectQuickPlayTarget(card)
  }
}

function onExtraSlotClick(slotIndex: number) {
  if (gameState.value.phase === 'selectSlot') {
    if (isSlotAvailable(slotIndex)) {
      selectSlotToPlay(slotIndex)
    } else {
      triggerSlotShake('player', slotIndex)
    }
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
  <div class="game-table">
    <StatusBar
      :round="gameState.round"
      :phase="gameState.phase"
      :is-final-round="gameState.isFinalRound"
      :is-pre-game="isPreGame"
      :energy="humanPlayer?.currentCost"
      :total-power="humanPlayer ? getTotalPower(playerIndex('player')) : undefined"
      :is-your-turn="isYourTurn"
    />

    <div class="game-table__broadcast">
      <GameBroadcastPanel
        :entries="gameState.broadcastLog ?? []"
        :fallback="gameState.message"
        :round="gameState.round"
      />
    </div>

    <div class="game-table__scroll">
      <div class="game-table__body">
        <PlayerStrip
          v-for="opp in opponentPlayers"
          :key="opp.id"
          :name="opp.name"
          :is-current="playerIndex(opp.id) === gameState.currentPlayerIndex"
          :energy="opp.currentCost"
          :total-power="getTotalPower(playerIndex(opp.id))"
          :hand-count="opp.hand.length"
          :deck-count="opp.deck.length"
          :field-card-count="countFieldCards(opp)"
          :default-collapsed="false"
          :data-player-id="opp.id"
          :data-fly-origin="opp.id"
        >
          <PlayerFieldSection
            :player="opp"
            :player-index="playerIndex(opp.id)"
            :is-human="false"
            :get-hidden-at-slot="(si) => getAiHiddenAtSlot(opp.id, si)"
            :hidden-dom-key="(si) => getAiHiddenDomKey(opp.id, si)"
            :slot-flash-key="(si) => slotFlashKey(opp.id, si)"
            :is-flashing="(si) => !!isSlotFlashing(opp.id, si)"
            :is-shaking="(si) => isSlotShaking(opp.id, si)"
            :is-bouncing="(si) => isSlotBouncing(opp.id, si)"
            :power-pulse="(si) => powerPulseLevel(opp.id, si)"
            @slot-click="(_, si, ev) => onFieldSlotClick(playerIndex(opp.id), opp.field[si])"
            @card-enter="(e, k, c) => onFieldCardEnter(e, opp.id, k, c)"
            @card-leave="(k) => onFieldCardLeave(opp.id, k)"
            @card-click="(c, e) => onFieldCardClick(c, e)"
          />
        </PlayerStrip>

        <div
          v-if="humanPlayer"
          class="player-panel player-panel--human"
          :class="{ 'player-panel--current': isYourTurn }"
          data-player-id="player"
          data-fly-origin="player"
        >
          <div class="player-panel__header">
            <h3 class="player-panel__title">{{ humanPlayer.name }}（你）</h3>
            <div class="player-panel__stats">
              <span class="stat-chip" :class="{ 'stat-chip--energy-negative': humanPlayer.currentCost < 0 }">手牌 {{ humanPlayer.hand.length }}</span>
              <span class="stat-chip" :data-deck-zone="humanPlayer.id">牌组 {{ humanPlayer.deck.length }}</span>
            </div>
          </div>

          <PlayerFieldSection
            :player="humanPlayer"
            :player-index="playerIndex('player')"
            :is-human="true"
            :is-slot-available="isSlotAvailable"
            :is-cross-slot-available="(si) => isCrossPlayerSlotAvailable(playerIndex('player'), si)"
            :is-target-selectable="isTargetSelectable"
            :selected-slot="gameState.selectedSlot"
            :slot-flash-key="(si) => slotFlashKey('player', si)"
            :is-flashing="(si) => !!isSlotFlashing('player', si)"
            :is-shaking="(si) => isSlotShaking('player', si)"
            :is-bouncing="(si) => isSlotBouncing('player', si)"
            :power-pulse="(si) => powerPulseLevel('player', si)"
            @slot-click="onHumanFieldSlotClick"
            @extra-slot-click="onExtraSlotClick"
            @card-enter="(e, k, c) => onFieldCardEnter(e, 'player', k, c)"
            @card-leave="(k) => onFieldCardLeave('player', k)"
            @card-click="(c, e) => onFieldCardClick(c, e, () => isDeployPhase())"
          />

          <div class="hand-section">
            <div class="hand-section__label">
              手牌
              <span v-if="reforgeState.active && reforgeOptions.includes('redraw') && reforgeState.selectedCard === null" class="hand-hint">点选放回</span>
              <span v-else-if="gameState.phase === 'selectEffectBranch'" class="hand-hint">点选水属性手牌</span>
              <span v-else-if="!reforgeState.active && hasPlayedThisTurn && !canPlayExtra" class="hand-hint hand-hint--muted">已出牌</span>
              <span v-else-if="!reforgeState.active && canPlayExtra" class="hand-hint hand-hint--extra">可额外出牌</span>
            </div>
            <div class="hand-row" :data-hand-zone="humanPlayer.id">
              <div
                v-for="(card, ci) in humanPlayer.hand"
                :key="ci"
                class="hand-card-wrap"
                @mouseenter="onHandCardEnter($event, 'player', ci, card)"
                @mouseleave="onHandCardLeave('player', ci)"
                @contextmenu.prevent="onFieldCardClick(card, $event)"
              >
                <GameCard
                  :card="card"
                  size="hand"
                  :data-hand-card="'player-' + ci"
                  :playable="isCardPlayable(ci)"
                  :disabled="!isCardPlayable(ci) && !reforgeState.active && gameState.phase !== 'selectEffectBranch'"
                  :selectable="(reforgeState.active && reforgeOptions.includes('redraw') && reforgeState.selectedCard === null) || (gameState.phase === 'selectEffectBranch' && !!pendingEffectBranch?.discardHandAttributes.includes(card.attribute))"
                  :selected="reforgeState.selectedCard === ci || effectBranchDiscardIndex === ci"
                  @click="onHandCardClick(ci)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ActionDock :visible="showActionDock">
      <div v-if="gameState.phase === 'selectEffectBranch' && pendingEffectBranch" class="action-dock-branch">
        <p class="action-dock-hint">
          {{ pendingEffectBranch.ownerCardName }}：先点选一张水属性手牌，再选效果
          <span v-if="effectBranchDiscardIndex !== null">（已选手牌）</span>
        </p>
        <div class="action-dock-row">
          <GameButton variant="primary" class="game-btn--small" @click="confirmEffectBranch('A')">A · 回复2能量</GameButton>
          <GameButton variant="primary" class="game-btn--small" @click="confirmEffectBranch('B')">B · 单位战力+2</GameButton>
          <GameButton variant="primary" class="game-btn--small" @click="confirmEffectBranch('C')">C · 抽2张牌</GameButton>
          <GameButton variant="ghost" class="game-btn--small" @click="handleSkipEffectBranch">跳过</GameButton>
        </div>
      </div>
      <div v-else-if="gameState.phase === 'decision'" class="action-dock-row">
        <GameButton v-if="canChoosePlay" variant="primary" @click="choosePlay">出牌</GameButton>
        <GameButton v-if="canChooseReforge" variant="secondary" @click="chooseReforge">重铸</GameButton>
        <span v-if="finalRoundTacticsOnly && canChoosePlay" class="action-dock-hint">场地已满，仅可出战术牌</span>
      </div>
      <div v-else-if="isDeployPhase()" class="action-dock-row">
        <GameButton variant="ghost" @click="cancelCardSelection">取消出牌</GameButton>
      </div>
      <template v-else-if="gameState.phase === 'action' && !reforgeState.active">
        <div class="action-dock-row">
          <GameButton v-if="!gameState.selectedCard && !hasPlayedThisTurn" variant="ghost" class="game-btn--small" @click="handleCancelAction">返回选择</GameButton>
          <GameButton variant="secondary" @click="endTurn">结束回合</GameButton>
        </div>
      </template>
      <div v-else-if="reforgeState.active && reforgeOptions.length < 2" class="action-dock-row">
        <span class="action-dock-hint">
          重铸 {{ reforgeOptions.length }}/2
          <span v-if="reforgeOptions.includes('redraw') && reforgeState.selectedCard === null"> — 请先选择手牌</span>
        </span>
        <GameButton variant="small" @click="selectReforgeOption('gainCost')">+2费用</GameButton>
        <GameButton variant="small" @click="selectReforgeOption('redraw')">换牌</GameButton>
        <GameButton variant="small" @click="selectReforgeOption('gainPower')">战力+1</GameButton>
        <GameButton variant="ghost" class="game-btn--small" @click="handleCancelAction">返回</GameButton>
      </div>
    </ActionDock>

    <GameAnimationLayer />

    <Teleport to="body">
      <div v-if="isPreGame" class="game-overlay">
        <div class="game-overlay-panel">
          <h2>单机对战设置</h2>
          <p>选择 AI 对手数量后开始游戏</p>
          <label class="pregame-label">
            对局人数（含你）
            <select v-model="playerCountStart" class="game-overlay-select">
              <option :value="2">2 人（你 + 1 AI）</option>
              <option :value="3">3 人（你 + 2 AI）</option>
              <option :value="4">4 人（你 + 3 AI）</option>
            </select>
          </label>
          <GameButton variant="primary" class="pregame-start" @click="initGame(playerCountStart)">开始游戏</GameButton>
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
      <div v-if="gameState.phase === 'gameOver'" class="game-overlay">
        <div class="game-overlay-panel">
          <h2>游戏结束</h2>
          <p>{{ gameState.message }}</p>
          <div class="game-overlay-actions">
            <GameButton variant="primary" @click="initGame(playerCountStart)">重新开始</GameButton>
            <GameButton variant="secondary" @click="$router.push('/')">返回主页</GameButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.pregame-label {
  display: block;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
}

.pregame-start {
  width: 100%;
}
</style>
