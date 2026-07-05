<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMultiplayer } from '@/composables/useMultiplayer'
import { useGameClient } from '@/composables/useGameClient'
import type { ReforgeOption, Card, GameState } from '@/types/game'
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
import { diffFieldAnimations, diffDrawEvents, diffPhaseBanner, fieldAnimKey } from '@/utils/fieldAnimationDiff'
import { parseCombatFloats } from '@/utils/parseCombatFloats'
import { shouldSkipAnimations } from '@/utils/gameSettings'
import { registerEscHandler } from '@/utils/escNavigation'
import { syncBroadcastFromMessage } from '@/utils/gameBroadcast'

const router = useRouter()
const multiplayer = useMultiplayer()
const animations = useGameAnimations()
const {
  animState,
  triggerSlotShake,
  isSlotShaking,
  isSlotBouncing,
  getPowerPulseDelta,
} = animations
const localAnimSkip = ref(new Set<string>())
const isRoundTransitioning = ref(false)
let lastMpFloatedMessage = ''
let prevMpBroadcastMessage = ''

// 使用客户端游戏逻辑
const game = useGameClient(multiplayer.myPlayerId.value || '')

watch(() => multiplayer.myPlayerId.value, (id) => {
  if (id) game.setMyPlayerId(id)
}, { immediate: true })

const reforgeOptions = ref<ReforgeOption[]>([])
const effectBranchDiscardIndex = ref<number | null>(null)
const loadingTimeoutId = ref<number | null>(null)

const pendingEffectBranch = computed(() => {
  const myId = multiplayer.myPlayerId.value
  if (!myId) return null
  return game.gameState.value?.pendingEffectBranches?.[myId] ?? null
})

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

function onFieldCardEnter(e: MouseEvent, playerId: string, slotKey: string | number, card: Card) {
  onFieldCardEnterDetail(e, playerId, slotKey, card)
}

function onHandCardEnter(e: MouseEvent, playerId: string, cardIndex: number, card: Card) {
  onFieldCardEnterDetail(e, playerId, `hand-${cardIndex}`, card)
}

function onHandCardLeave(playerId: string, cardIndex: number) {
  onFieldCardLeave(playerId, `hand-${cardIndex}`)
}

function blockFieldDetailClick() {
  return !!(game.gameState.value?.phase === 'action' && game.selectedCard.value)
}

function isSlotFlashing(playerId: string, slotIndex: number) {
  const f = animState.landFlash
  return f && f.fieldOwnerId === playerId && f.slotIndex === slotIndex
}

function powerPulseClass(playerId: string, slotIndex: number) {
  const d = getPowerPulseDelta(playerId, slotIndex)
  if (d === undefined) return ''
  if (d > 0) return 'power-pulse-up'
  if (d < 0) return 'power-pulse-down'
  return ''
}

function handleFieldSlotClick(playerId: string, si: number) {
  if (playerId !== multiplayer.myPlayerId.value) return
  if (game.gameState.value?.phase === 'action' && game.selectedCard.value) {
    if (game.isSlotAvailable(si)) {
      void handleSelectSlot(si)
    } else {
      triggerSlotShake(playerId, si)
    }
  }
}

function markLocalAnim(key: string) {
  localAnimSkip.value.add(key)
  setTimeout(() => localAnimSkip.value.delete(key), 2500)
}

let unregisterEsc: (() => void) | undefined
async function handleGameStateUpdate(newState: GameState) {
  console.log('=== [CardGameMultiplayer] 收到游戏状态更新 ===')
  console.log('[CardGameMultiplayer] phase:', newState.phase)
  console.log('[CardGameMultiplayer] round:', newState.round)
  console.log('[CardGameMultiplayer] message:', newState.message)
  console.log('[CardGameMultiplayer] 我的决策状态 (myDecisionMade):', game.myDecisionMade.value)
  console.log('[CardGameMultiplayer] 全部决策完成 (allDecisionsMade):', game.allDecisionsMade.value)
  console.log('[CardGameMultiplayer] 我的玩家名:', game.myPlayer.value?.name)
  
  // 清除加载超时
  if (loadingTimeoutId.value) {
    clearTimeout(loadingTimeoutId.value)
    loadingTimeoutId.value = null
  }

  const prev = game.gameState.value
  const myId = multiplayer.myPlayerId.value || ''
  const isNewRound = !!(prev && newState.round > prev.round)
  if (isNewRound) {
    isRoundTransitioning.value = true
  }
  if (prev && !shouldSkipAnimations()) {
    const draws = diffDrawEvents(prev, newState, myId)
    if (draws.length) {
      await animations.playDrawEvents(draws, localAnimSkip.value)
    }
    const events = diffFieldAnimations(prev, newState, myId)
    if (events.length) {
      await animations.playFieldEvents(events, localAnimSkip.value)
    }
    const anchorId = newState.players[newState.currentPlayerIndex]?.id ?? myId
    const prevParts = new Set(lastMpFloatedMessage.split('|').map(s => s.trim()).filter(Boolean))
    const newParts = newState.message.split('|').map(s => s.trim()).filter(s => s && !prevParts.has(s))
    lastMpFloatedMessage = newState.message
    const floats = newParts.flatMap(p => parseCombatFloats(p).map(f => ({ ...f, playerId: anchorId })))
    if (floats.length) {
      await animations.playFloatTexts(floats)
    }
    const banner = diffPhaseBanner(prev, newState, myId)
    if (banner) {
      await animations.playBanner(banner)
    }
  }
  
  game.updateGameState(newState)
  syncBroadcastFromMessage(newState, prevMpBroadcastMessage)
  prevMpBroadcastMessage = newState.message ?? ''
  if (isNewRound) {
    isRoundTransitioning.value = false
  }
  
  // 检查是否需要重置决策状态（新回合开始）
  if (newState.phase === 'decision') {
    console.log('[CardGameMultiplayer] 检测到decision阶段 -> 重置决策状态')
    game.resetDecisionState()
    game.resetReadyState()
  }
  
  // action 阶段表示所有玩家均已决策
  if (newState.phase === 'action') {
    console.log('[CardGameMultiplayer] 进入 action 阶段 -> 所有玩家已决策')
  }

  // 全部玩家准备完毕 → 由 ID 最小的客户端发送 startNewRound
  if (newState.playerReady && newState.players?.length) {
    const myPlayerId = multiplayer.myPlayerId.value
    if (myPlayerId && newState.playerReady[myPlayerId]) {
      game.setMyReady()
    }

    const allReady = newState.players.every((p: { id: string }) => newState.playerReady?.[p.id])
    if (allReady) {
      console.log('[CardGameMultiplayer] 所有玩家准备完成')

      const playerIds = newState.players.map((p: { id: string }) => p.id).sort()
      const shouldSendRequest = playerIds[0] === myPlayerId

      if (shouldSendRequest) {
        console.log('[CardGameMultiplayer] 我的ID最小，2秒后发送 startNewRound')
        setTimeout(() => {
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
  unregisterEsc = registerEscHandler(() => {
    if (pinnedCard.value) {
      closePinned()
      return true
    }
    return false
  })

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
  unregisterEsc?.()
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
  if (!action) return
  console.log('[CardGameMultiplayer] 发送 choosePlay 操作')
  multiplayer.sendAction(action)
}

// 处理选择重铸
function handleChooseReforge() {
  console.log('=== [CardGameMultiplayer] handleChooseReforge 被调用 ===')
  console.log('[CardGameMultiplayer] 当前 phase:', game.gameState.value?.phase)
  console.log('[CardGameMultiplayer] 我的玩家名:', game.myPlayer.value?.name)
  
  const action = game.chooseReforge()
  if (!action) return
  multiplayer.sendAction(action)
}

// 处理手牌点击
function onHandCardClick(index: number) {
  const myPlayerId = multiplayer.myPlayerId.value
  if (pendingEffectBranch.value) {
    const card = game.myPlayer.value?.hand[index]
    if (card && card !== 'hidden' && pendingEffectBranch.value.discardHandAttributes.includes(card.attribute)) {
      effectBranchDiscardIndex.value = index
    }
    return
  }

  // 检查是否选择了重铸
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
    if (!game.allDecisionsMade.value) {
      return
    }
    const mode = game.selectCardToPlay(index)
    if (mode === 'direct') {
      const card = game.myPlayer.value?.hand[index]
      const myId = multiplayer.myPlayerId.value
      if (card && card !== 'hidden' && myId) {
        void (async () => {
          await animations.playCardFly({
            kind: 'tactic-fade',
            card: card as Card,
            playerId: myId,
            handIndex: index,
          })
          markLocalAnim(`fly-${myId}-0`)
          const action = game.playTacticDirect(index)
          if (action) {
            multiplayer.sendAction(action)
            game.setMyReady()
          }
        })()
      }
    }
  }
}

// 处理槽位选择
async function handleSelectSlot(slotIndex: number) {
  console.log('[CardGameMultiplayer] handleSelectSlot 被调用, slotIndex:', slotIndex)
  
  // 检查是否选择了重铸
  const myPlayerId = multiplayer.myPlayerId.value
  const myDecision = game.gameState.value?.playerDecisions?.[myPlayerId]
  
  if (myDecision && myDecision.choice === 'reforge') {
    console.log('[CardGameMultiplayer] 选择了重铸，不能出牌')
    return
  }
  
  // 只有双方都做出决策后才能部署单位
  if (!game.allDecisionsMade.value) {
    return
  }
  
  if (!game.myPlayer.value) return
  
  // 找到选中的手牌索引
  const cardIndex = game.myPlayer.value.hand.findIndex(c => c === game.selectedCard.value)
  if (cardIndex === -1) return

  const card = game.selectedCard.value
  const myId = multiplayer.myPlayerId.value
  if (card && myId) {
    await animations.playCardFly({
      kind: card.type === 'tactic' ? 'tactic' : 'deploy',
      card,
      playerId: myId,
      fieldOwnerId: myId,
      slotIndex,
      handIndex: cardIndex,
    })
    markLocalAnim(fieldAnimKey({
      type: 'fly',
      playerId: myId,
      fieldOwnerId: myId,
      slotIndex,
      showBack: false,
    }))
  }

  const action = game.selectSlotToPlay(slotIndex, cardIndex)
  if (action) {
    console.log('[CardGameMultiplayer] 发送 playCard 操作:', action)
    multiplayer.sendAction(action)
    if (myId) {
      await animations.flashLand(myId, slotIndex)
    }
    game.setMyReady()
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
async function selectReforgeOption(option: ReforgeOption) {
  if (reforgeOptions.value.length < 2) {
    reforgeOptions.value.push(option)
    
    if (reforgeOptions.value.length === 2) {
      if (reforgeOptions.value.includes('redraw') && game.reforgeState.value.selectedCard === null) {
        return
      }

      const myId = multiplayer.myPlayerId.value
      if (myId) {
        await animations.playReforge({
          playerId: myId,
          options: [reforgeOptions.value[0], reforgeOptions.value[1]],
        })
      }
      
      const action = game.executeReforge([reforgeOptions.value[0], reforgeOptions.value[1]])
      multiplayer.sendAction(action)
      reforgeOptions.value = []
      game.setMyReady()
    }
  }
}

function handleCancelAction() {
  const action = game.cancelActionChoice()
  if (action) multiplayer.sendAction(action)
  reforgeOptions.value = []
}

function confirmEffectBranch(branch: 'A' | 'B' | 'C') {
  if (effectBranchDiscardIndex.value === null) return
  const action = game.resolveEffectBranchChoice(branch, effectBranchDiscardIndex.value)
  multiplayer.sendAction(action)
  effectBranchDiscardIndex.value = null
}

function handleSkipEffectBranch() {
  const action = game.skipEffectBranchChoice()
  multiplayer.sendAction(action)
  effectBranchDiscardIndex.value = null
}

// 获取战力颜色
function getPowerColor(card: Card): string {
  if (card.currentPower > card.basePower) return '#2f6f5e'
  if (card.currentPower < card.basePower) return '#9d2f2f'
  return '#1f2522'
}

function isHiddenFieldCard(card: Card | null | undefined) {
  return !!card && (card.name === '？？？' || card.id === 'hidden')
}

function powerPulseLevel(playerId: string, slotIndex: number): 'up' | 'down' | null {
  const d = getPowerPulseDelta(playerId, slotIndex)
  if (d === undefined) return null
  if (d > 0) return 'up'
  if (d < 0) return 'down'
  return null
}

function countFieldCards(player: { field: Array<{ card?: unknown }> }) {
  return player.field.filter(s => s.card).length
}

const myPlayerIndex = computed(() => {
  const gs = game.gameState.value
  const myId = multiplayer.myPlayerId.value
  if (!gs || !myId) return -1
  return gs.players.findIndex(p => p.id === myId)
})

const humanPlayer = computed(() => game.myPlayer.value)
const opponentPlayers = computed(() =>
  game.gameState.value?.players.filter(p => p.id !== multiplayer.myPlayerId.value) ?? [],
)

const showActionDock = computed(() =>
  !!humanPlayer.value
  && myPlayerIndex.value === game.gameState.value?.currentPlayerIndex
  && game.gameState.value?.phase !== 'draw'
  && !isRoundTransitioning.value,
)

const isYourTurn = computed(() =>
  myPlayerIndex.value === game.gameState.value?.currentPlayerIndex
  && game.gameState.value?.phase !== 'draw'
  && !isRoundTransitioning.value,
)

const readySubtitle = computed(() => {
  if (game.allPlayersReady.value) return '所有玩家准备完毕，进入下一回合…'
  if (game.myReady.value) return '等待其他玩家…'
  return ''
})

function playerIndex(playerId: string) {
  return game.gameState.value?.players.findIndex(p => p.id === playerId) ?? -1
}

// 离开游戏
function leaveGameToLobby(fromGameOver = false) {
  console.log('[CardGameMultiplayer] leaveGameToLobby 被调用', { fromGameOver })

  if (!fromGameOver && !confirm('确定要离开游戏吗？')) {
    return
  }

  try {
    multiplayer.offGameStateUpdate()
    multiplayer.leaveRoom()
    router.replace('/multiplayer').catch(() => {
      window.location.href = '#/multiplayer'
    })
  } catch (error) {
    console.error('[CardGameMultiplayer] 离开游戏时出错:', error)
    window.location.href = '#/multiplayer'
  }
}
</script>

<template>
  <div v-if="game.gameState.value" class="game-table">
    <StatusBar
      :round="game.gameState.value.round"
      :phase="game.gameState.value.phase"
      :is-final-round="game.gameState.value.isFinalRound"
      :energy="humanPlayer?.currentCost"
      :total-power="humanPlayer ? game.getTotalPower(myPlayerIndex) : undefined"
      :is-your-turn="isYourTurn"
    />

    <div v-if="readySubtitle" class="game-table__ready-hint">{{ readySubtitle }}</div>

    <div class="game-table__broadcast">
      <GameBroadcastPanel
        :entries="game.gameState.value.broadcastLog ?? []"
        :fallback="game.gameState.value.message"
        :round="game.gameState.value.round"
      />
    </div>

    <div class="game-table__scroll">
      <div class="game-table__body">
        <PlayerStrip
          v-for="opp in opponentPlayers"
          :key="opp.id"
          :name="opp.name"
          :is-current="playerIndex(opp.id) === game.gameState.value.currentPlayerIndex"
          :energy="opp.currentCost"
          :total-power="game.getTotalPower(playerIndex(opp.id))"
          :hand-count="opp.handCount || opp.hand.length"
          :deck-count="opp.deckCount || opp.deck.length"
          :field-card-count="countFieldCards(opp)"
          :default-collapsed="false"
          :data-player-id="opp.id"
          :data-fly-origin="opp.id"
        >
          <PlayerFieldSection
            :player="opp"
            :player-index="playerIndex(opp.id)"
            :is-human="false"
            :is-face-down-card="isHiddenFieldCard"
            :slot-flash-key="(si) => opp.id + '-' + si"
            :is-flashing="(si) => !!isSlotFlashing(opp.id, si)"
            :is-shaking="(si) => isSlotShaking(opp.id, si)"
            :is-bouncing="(si) => isSlotBouncing(opp.id, si)"
            :power-pulse="(si) => powerPulseLevel(opp.id, si)"
            @card-enter="(e, k, c) => onFieldCardEnter(e, opp.id, k, c)"
            @card-leave="(k) => onFieldCardLeave(opp.id, k)"
            @card-click="(c, e) => onFieldCardClick(c, e)"
          />
          <div class="opponent-hand-row">
            <span class="opponent-hand-row__label">手牌 {{ opp.handCount || opp.hand.length }}</span>
            <GameCard
              v-for="(_, ci) in opp.hand"
              :key="ci"
              size="mini"
              face-down
            />
          </div>
        </PlayerStrip>

        <div
          v-if="humanPlayer"
          class="player-panel player-panel--human"
          :class="{ 'player-panel--current': isYourTurn }"
          :data-player-id="humanPlayer.id"
          :data-fly-origin="humanPlayer.id"
        >
          <div class="player-panel__header">
            <h3 class="player-panel__title">{{ humanPlayer.name }}（你）</h3>
            <div class="player-panel__stats">
              <span class="stat-chip" :class="{ 'stat-chip--energy-negative': humanPlayer.currentCost < 0 }">手牌 {{ humanPlayer.hand.length }}</span>
              <span class="stat-chip" :data-deck-zone="humanPlayer.id">牌组 {{ humanPlayer.deckCount || humanPlayer.deck.length }}</span>
            </div>
          </div>

          <PlayerFieldSection
            :player="humanPlayer"
            :player-index="myPlayerIndex"
            :is-human="true"
            :is-face-down-card="isHiddenFieldCard"
            :is-slot-available="(si) => game.isSlotAvailable(si)"
            :selected-slot="game.selectedSlot.value"
            :slot-flash-key="(si) => humanPlayer.id + '-' + si"
            :is-flashing="(si) => !!isSlotFlashing(humanPlayer.id, si)"
            :is-shaking="(si) => isSlotShaking(humanPlayer.id, si)"
            :is-bouncing="(si) => isSlotBouncing(humanPlayer.id, si)"
            :power-pulse="(si) => powerPulseLevel(humanPlayer.id, si)"
            @slot-click="(_, si) => handleFieldSlotClick(humanPlayer.id, si)"
            @card-enter="(e, k, c) => onFieldCardEnter(e, humanPlayer.id, k, c)"
            @card-leave="(k) => onFieldCardLeave(humanPlayer.id, k)"
            @card-click="(c, e) => onFieldCardClick(c, e, blockFieldDetailClick)"
          />

          <div class="hand-section">
            <div class="hand-section__label">
              手牌
              <span v-if="game.reforgeState.value.active && reforgeOptions.includes('redraw') && game.reforgeState.value.selectedCard === null" class="hand-hint">点选放回</span>
              <span v-else-if="!game.reforgeState.value.active && game.hasPlayedThisTurn.value && !game.canPlayExtra.value" class="hand-hint hand-hint--muted">已出牌</span>
              <span v-else-if="!game.reforgeState.value.active && game.canPlayExtra.value" class="hand-hint hand-hint--extra">可额外出牌</span>
            </div>
            <div class="hand-row" :data-hand-zone="humanPlayer.id">
              <div
                v-for="(card, ci) in humanPlayer.hand"
                :key="ci"
                class="hand-card-wrap"
                @mouseenter="card !== 'hidden' && card && onHandCardEnter($event, humanPlayer.id, ci, card as Card)"
                @mouseleave="onHandCardLeave(humanPlayer.id, ci)"
                @contextmenu.prevent="card !== 'hidden' && card && onFieldCardClick(card as Card, $event)"
              >
                <GameCard
                  :card="card !== 'hidden' && card ? card : undefined"
                  :face-down="card === 'hidden'"
                  size="hand"
                  :data-hand-card="humanPlayer.id + '-' + ci"
                  :playable="game.isCardPlayable(ci)"
                  :disabled="!game.isCardPlayable(ci) && !game.reforgeState.value.active"
                  :selectable="(game.reforgeState.value.active && reforgeOptions.includes('redraw') && game.reforgeState.value.selectedCard === null) || (pendingEffectBranch && card !== 'hidden' && card && pendingEffectBranch.discardHandAttributes.includes(card.attribute))"
                  :selected="game.reforgeState.value.selectedCard === ci || effectBranchDiscardIndex === ci"
                  @click="onHandCardClick(ci)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ActionDock :visible="showActionDock">
      <div v-if="pendingEffectBranch" class="action-dock-branch">
        <p class="action-dock-hint">{{ pendingEffectBranch.ownerCardName }}：先点选水属性手牌，再选效果</p>
        <div class="action-dock-row">
          <GameButton variant="primary" class="game-btn--small" @click="confirmEffectBranch('A')">A · 回复2能量</GameButton>
          <GameButton variant="primary" class="game-btn--small" @click="confirmEffectBranch('B')">B · 单位战力+2</GameButton>
          <GameButton variant="primary" class="game-btn--small" @click="confirmEffectBranch('C')">C · 抽2张牌</GameButton>
          <GameButton variant="ghost" class="game-btn--small" @click="handleSkipEffectBranch">跳过</GameButton>
        </div>
      </div>
      <div v-else-if="game.gameState.value.phase === 'decision' && !game.myDecisionMade.value" class="action-dock-row">
        <GameButton v-if="game.canChoosePlay.value" variant="primary" @click="handleChoosePlay">出牌</GameButton>
        <GameButton v-if="game.canChooseReforge.value" variant="secondary" @click="handleChooseReforge">重铸</GameButton>
        <span v-if="game.finalRoundTacticsOnly.value && game.canChoosePlay.value" class="action-dock-hint">场地已满，仅可出战术牌</span>
      </div>
      <div v-else-if="game.myDecisionMade.value && !game.allOtherDecisionsMade.value" class="action-dock-row">
        <span class="action-dock-hint">⏳ 等待其他玩家决策…</span>
        <GameButton
          v-if="!game.hasPlayedThisTurn.value && humanPlayer && !game.gameState.value?.playerReady?.[humanPlayer.id]"
          variant="ghost"
          class="game-btn--small"
          @click="handleCancelAction"
        >返回选择</GameButton>
      </div>
      <div v-else-if="game.allDecisionsMade.value && game.gameState.value.phase === 'action' && !game.reforgeState.value.active && humanPlayer && !humanPlayer.hasPlayedThisTurn && !game.gameState.value?.playerReady?.[humanPlayer.id]" class="action-dock-row">
        <GameButton variant="ghost" class="game-btn--small" @click="handleCancelAction">返回选择</GameButton>
      </div>
      <div v-else-if="game.allOtherDecisionsMade.value && game.gameState.value.phase === 'action' && !game.reforgeState.value.active" class="action-dock-row">
        <span class="action-dock-hint">✅ 所有玩家已决策</span>
      </div>
      <div v-else-if="game.gameState.value.phase === 'action' && !game.reforgeState.value.active && humanPlayer && humanPlayer.currentCost === 0 && !humanPlayer.canPlayExtra" class="action-dock-row">
        <span class="action-dock-hint">费用不足，无法出牌</span>
        <GameButton variant="danger" @click="handleSkipTurn">跳过回合</GameButton>
      </div>
      <div v-else-if="game.reforgeState.value.active && reforgeOptions.length < 2" class="action-dock-row">
        <span class="action-dock-hint">
          重铸 {{ reforgeOptions.length }}/2
          <span v-if="reforgeOptions.includes('redraw') && game.reforgeState.value.selectedCard === null"> — 请先选择手牌</span>
        </span>
        <GameButton variant="small" @click="selectReforgeOption('gainCost')">+2费用</GameButton>
        <GameButton variant="small" @click="selectReforgeOption('redraw')">换牌</GameButton>
        <GameButton variant="small" @click="selectReforgeOption('gainPower')">战力+1</GameButton>
        <GameButton variant="ghost" class="game-btn--small" @click="handleCancelAction">返回</GameButton>
      </div>
    </ActionDock>

    <GameAnimationLayer />

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
      <div v-if="game.gameState.value.phase === 'gameOver'" class="game-overlay">
        <div class="game-overlay-panel">
          <h2>游戏结束</h2>
          <p>{{ game.gameState.value.message }}</p>
          <div class="game-overlay-actions">
            <GameButton variant="primary" @click="leaveGameToLobby(true)">返回大厅</GameButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.action-dock-hint--warn {
  color: var(--game-danger);
}
</style>
