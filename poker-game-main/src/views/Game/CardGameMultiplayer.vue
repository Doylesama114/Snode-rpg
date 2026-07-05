<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMultiplayer } from '@/composables/useMultiplayer'
import { useGameClient } from '@/composables/useGameClient'
import type { ReforgeOption, Card, GameState } from '@/types/game'
import CardDetailPopover from '@/components/CardDetailPopover.vue'
import GameAnimationLayer from '@/components/GameAnimationLayer.vue'
import { useFieldCardDetail } from '@/composables/useFieldCardDetail'
import { useGameAnimations } from '@/composables/useGameAnimations'
import { diffFieldAnimations, diffDrawEvents, fieldAnimKey } from '@/utils/fieldAnimationDiff'
import { parseCombatFloats } from '@/utils/parseCombatFloats'
import { shouldSkipAnimations } from '@/utils/gameSettings'
import { registerEscHandler } from '@/utils/escNavigation'

const router = useRouter()
const multiplayer = useMultiplayer()
const animations = useGameAnimations()
const { animState } = animations
const localAnimSkip = ref(new Set<string>())
let lastMpFloatedMessage = ''

// 使用客户端游戏逻辑
const game = useGameClient(multiplayer.myPlayerId.value || '')

watch(() => multiplayer.myPlayerId.value, (id) => {
  if (id) game.setMyPlayerId(id)
}, { immediate: true })

const reforgeOptions = ref<ReforgeOption[]>([])
const loadingTimeoutId = ref<number | null>(null)

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

function blockFieldDetailClick() {
  return !!(game.gameState.value?.phase === 'action' && game.selectedCard.value)
}

function isSlotFlashing(playerId: string, slotIndex: number) {
  const f = animState.landFlash
  return f && f.fieldOwnerId === playerId && f.slotIndex === slotIndex
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
  }
  
  game.updateGameState(newState)
  
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

// 获取战力颜色
function getPowerColor(card: Card): string {
  if (card.currentPower > card.basePower) return '#2f6f5e'
  if (card.currentPower < card.basePower) return '#9d2f2f'
  return '#1f2522'
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
  <div class="game-container" v-if="game.gameState.value">
    <!-- 游戏信息栏 -->
    <div class="game-info">
      <div class="round-info">
        <span>回合: {{ game.gameState.value.round }}</span>
        <span v-if="game.gameState.value.isFinalRound" class="final-round">最后一回合！</span>
        <span v-if="game.allPlayersReady.value" class="ready-status">所有玩家准备完毕，进入下一回合...</span>
        <span v-else-if="game.myReady.value" class="ready-status">等待其他玩家...</span>
      </div>
      <div class="message">{{ game.gameState.value.message }}</div>
    </div>

    <!-- N-player grid -->
    <div class="players-grid" :class="'players-' + game.gameState.value.players.length">
      <div
        v-for="(player, index) in game.gameState.value.players"
        :key="player.id"
        class="player-cell"
        :data-player-id="player.id"
        :data-fly-origin="player.id"
        :class="{
          'is-current': index === game.gameState.value.currentPlayerIndex,
          'is-own': player.id === multiplayer.myPlayerId.value,
          'is-other': player.id !== multiplayer.myPlayerId.value
        }"
      >
        <div class="player-header">
          <h3>{{ player.name }} {{ player.id === multiplayer.myPlayerId.value ? '(你)' : '' }}</h3>
          <div class="stats">
            <span :class="{ 'negative-cost': player.currentCost < 0 }">费用: {{ player.currentCost }}</span>
            <span class="power-display">总战力: <strong>{{ game.getTotalPower(index) }}</strong></span>
            <span>手牌: {{ player.handCount || player.hand.length }}</span>
            <span :data-deck-zone="player.id">牌组: {{ player.deckCount || player.deck.length }}</span>
          </div>
        </div>

        <!-- 场上 -->
        <div class="field">
          <div class="field-label">场上</div>
          <div class="field-grid">
            <div
              v-for="(slot, si) in player.field"
              :key="si"
              class="field-slot"
              :data-field-slot="player.id + '-' + si"
              :class="{
                'has-card': slot.card,
                'extra-slot': slot.isExtra,
                'slot-land-flash': isSlotFlashing(player.id, si),
                'selectable': player.id === multiplayer.myPlayerId.value && game.isSlotAvailable(si),
                'selected': player.id === multiplayer.myPlayerId.value && game.selectedSlot.value === si
              }"
              @click="player.id === multiplayer.myPlayerId.value && game.gameState.value.phase === 'action' && game.isSlotAvailable(si) && handleSelectSlot(si)"
            >
              <div
                v-if="slot.card"
                class="field-card"
                :class="{ 'hidden-face': slot.card.name === '？？？' || slot.card.id === 'hidden' }"
                @mouseenter="slot.card.name !== '？？？' && slot.card.id !== 'hidden' && onFieldCardEnter($event, player.id, si, slot.card as Card)"
                @mouseleave="onFieldCardLeave(player.id, si)"
                @click="slot.card.name !== '？？？' && slot.card.id !== 'hidden' && onFieldCardClick(slot.card as Card, $event, blockFieldDetailClick)"
              >
                <template v-if="slot.card.name === '？？？' || slot.card.id === 'hidden'">?</template>
                <template v-else>
                  <div class="card-name-small">{{ slot.card.name }}</div>
                  <div class="card-power" :style="{ color: getPowerColor(slot.card) }">
                    {{ slot.card.currentPower }}
                  </div>
                </template>
              </div>
              <div v-else class="empty-slot">{{ slot.isExtra ? '额外' : (player.id === multiplayer.myPlayerId.value ? si + 1 : '空') }}</div>
            </div>
          </div>
        </div>

        <!-- 手牌（自己：真实卡片，对手：卡背） -->
        <div v-if="player.id === multiplayer.myPlayerId.value" class="hand">
          <div class="hand-label">
            手牌
            <span v-if="game.reforgeState.value.active && reforgeOptions.includes('redraw') && game.reforgeState.value.selectedCard === null" class="hint">(点选放回)</span>
            <span v-else-if="!game.reforgeState.value.active && game.hasPlayedThisTurn.value && !game.canPlayExtra.value" class="hint-disabled">(已出牌)</span>
            <span v-else-if="!game.reforgeState.value.active && game.canPlayExtra.value" class="hint-extra">(可额外出牌!)</span>
          </div>
          <div class="hand-cards" :data-hand-zone="player.id">
            <div
              v-for="(card, ci) in player.hand"
              :key="ci"
              class="hand-card"
              :data-hand-card="player.id + '-' + ci"
              :class="{
                'playable': game.isCardPlayable(ci),
                'disabled': !game.isCardPlayable(ci) && !game.reforgeState.value.active,
                'selectable': game.reforgeState.value.active && reforgeOptions.includes('redraw') && game.reforgeState.value.selectedCard === null,
                'selected': game.reforgeState.value.selectedCard === ci
              }"
              @click="onHandCardClick(ci)"
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

        <!-- 对手手牌（卡背） -->
        <div v-if="player.id !== multiplayer.myPlayerId.value" class="opponent-hand">
          <div class="hand-label">对手手牌</div>
          <div class="hand-cards-hidden" :data-hand-zone="player.id">
            <div v-for="(card, ci) in player.hand" :key="ci" class="hand-card-back">?</div>
          </div>
        </div>

        <!-- 操作按钮（仅自己+当前回合） -->
        <div v-if="player.id === multiplayer.myPlayerId.value && index === game.gameState.value.currentPlayerIndex" class="actions">
          <template v-if="game.gameState.value.phase === 'decision' && !game.myDecisionMade.value">
            <button v-if="game.canChoosePlay.value" @click="handleChoosePlay" class="btn btn-primary">出牌</button>
            <button v-if="game.canChooseReforge.value" @click="handleChooseReforge" class="btn btn-secondary">重铸</button>
            <span v-if="game.finalRoundTacticsOnly.value && game.canChoosePlay.value" class="hint">(场地已满，仅可出战术牌)</span>
          </template>

          <div v-if="game.myDecisionMade.value && !game.allOtherDecisionsMade.value" class="waiting-opponent">
            ⏳ 等待其他玩家决策...
          </div>

          <div v-if="game.allOtherDecisionsMade.value && game.gameState.value.phase === 'action' && !game.reforgeState.value.active" class="both-ready">
            ✅ 所有玩家已决策！
          </div>

          <template v-if="game.gameState.value.phase === 'action' && !game.reforgeState.value.active && player.currentCost === 0 && !player.canPlayExtra">
            <div class="no-cost-warning">费用不足，无法出牌</div>
            <button @click="handleSkipTurn" class="btn btn-warning">跳过回合</button>
          </template>

          <div v-if="game.reforgeState.value.active && reforgeOptions.length < 2" class="reforge-options">
            <div class="reforge-info">
              选择 ({{ reforgeOptions.length }}/2)
              <span v-if="reforgeOptions.includes('redraw') && game.reforgeState.value.selectedCard === null" class="warning"> - 请先选择手牌</span>
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
      <div v-if="game.gameState.value.phase === 'gameOver'" class="game-over-overlay">
        <div class="game-over-panel">
          <h2 class="game-over-title">游戏结束</h2>
          <p class="game-over-message">{{ game.gameState.value.message }}</p>
          <div class="game-over-actions">
            <button @click="leaveGameToLobby(true)" class="btn btn-primary">返回大厅</button>
          </div>
        </div>
      </div>
    </Teleport>
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
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
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
.players-3 .player-cell.is-own,
.players-4 .player-cell.is-own {
  grid-column: 1 / -1;
}
.player-cell { background: #fffdf8; border: 1px solid #d8d2c4; border-radius: 8px; padding: 6px 8px; min-height: min-content; display: flex; flex-direction: column; }
.player-cell.is-current { border-color: #a46d1f; border-width: 2px; }
.player-cell.is-own { border-left: 4px solid #2f6f5e; }
.player-cell.is-other { border-left: 4px solid #9d2f2f; }

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

.field-slot.slot-land-flash {
  animation: slot-land-pulse 320ms ease-out;
}

@keyframes slot-land-pulse {
  0% { box-shadow: 0 0 0 rgba(164, 109, 31, 0); transform: scale(1); }
  40% { box-shadow: 0 0 24px rgba(164, 109, 31, 0.85); transform: scale(1.06); border-color: #a46d1f; }
  100% { box-shadow: 0 0 0 rgba(164, 109, 31, 0); transform: scale(1); }
}

.field-card.hidden-face {
  background: linear-gradient(145deg, #4a3728 0%, #2a1f18 100%);
  color: #d4a574;
  border-radius: 6px;
  padding: 8px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: bold;
}

.field-card {
  text-align: center;
  width: 100%;
  position: relative;
  cursor: pointer;
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

.negative-cost { color: #9d2f2f; font-weight: bold; }

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
