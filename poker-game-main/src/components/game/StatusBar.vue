<script setup lang="ts">
import { phaseLabel } from '@/utils/gameUi'

defineProps<{
  round: number
  phase?: string
  isFinalRound?: boolean
  isPreGame?: boolean
  energy?: number
  totalPower?: number
  isYourTurn?: boolean
}>()
</script>

<template>
  <header class="status-bar" :class="{ 'status-bar--your-turn': isYourTurn }">
    <div class="status-bar__left">
      <span class="status-bar__round">R{{ round }}</span>
      <span v-if="phase" class="status-bar__phase">{{ phaseLabel(phase) }}</span>
      <span v-if="isFinalRound" class="status-bar__final game-anim-pulse">最后一回合</span>
      <span v-if="isPreGame" class="status-bar__pregame">未开始</span>
    </div>
    <div v-if="energy !== undefined" class="status-bar__right">
      <span class="stat-chip" :class="{ 'stat-chip--energy-negative': energy < 0 }">
        费用 <strong>{{ energy }}</strong>
      </span>
      <span v-if="totalPower !== undefined" class="stat-chip stat-chip--power">
        战力 <strong>{{ totalPower }}</strong>
      </span>
    </div>
    <div v-if="isYourTurn" class="status-bar__turn-badge">你的回合</div>
  </header>
</template>

<style scoped>
.status-bar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  min-height: var(--game-status-height);
  padding: 8px 14px;
  background: #fffdf8;
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--game-border);
}

.status-bar--your-turn {
  border-bottom-color: var(--game-accent-gold-dim);
  box-shadow: 0 4px 20px rgba(196, 146, 58, 0.12);
}

.status-bar__left,
.status-bar__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.status-bar__round {
  font-size: 18px;
  font-weight: 800;
  color: var(--game-accent-gold);
  font-variant-numeric: tabular-nums;
}

.status-bar__phase {
  font-size: 13px;
  color: var(--game-text-secondary);
  padding: 2px 8px;
  border-radius: 999px;
  background: #f6f4ef;
}

.status-bar__final {
  font-size: 12px;
  font-weight: 700;
  color: var(--game-danger);
}

.status-bar__pregame {
  font-size: 12px;
  color: var(--game-text-muted);
}

.status-bar__turn-badge {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: 700;
  color: var(--game-accent-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  pointer-events: none;
}

@media (max-width: 520px) {
  .status-bar__turn-badge {
    display: none;
  }
}
</style>
