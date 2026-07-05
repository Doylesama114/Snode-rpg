<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BroadcastEntry } from '@/types/game'

const props = defineProps<{
  entries: BroadcastEntry[]
  fallback?: string
  round?: number
}>()

const expanded = ref(false)

const latest = computed(() => props.entries[0]?.text ?? props.fallback ?? '等待游戏事件…')

function toggle() {
  expanded.value = !expanded.value
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="broadcast-panel" :class="{ expanded }">
    <button type="button" class="broadcast-bar" @click="toggle">
      <span class="broadcast-icon">📢</span>
      <span class="broadcast-latest">{{ latest }}</span>
      <span class="broadcast-toggle">{{ expanded ? '▲ 收起' : '▼ 历史' }}</span>
      <span v-if="entries.length" class="broadcast-count">{{ entries.length }}</span>
    </button>
    <div v-if="expanded" class="broadcast-dropdown">
      <div class="broadcast-dropdown-head">
        <span>广播记录</span>
        <span v-if="round !== undefined" class="broadcast-round-hint">当前第 {{ round }} 回合</span>
      </div>
      <ul v-if="entries.length" class="broadcast-list">
        <li v-for="entry in entries" :key="entry.id" class="broadcast-item">
          <div class="broadcast-item-meta">
            <span class="broadcast-item-round">R{{ entry.round }}</span>
            <span v-if="entry.source" class="broadcast-item-source">{{ entry.source }}</span>
            <span class="broadcast-item-time">{{ formatTime(entry.timestamp) }}</span>
          </div>
          <div class="broadcast-item-text">{{ entry.text }}</div>
        </li>
      </ul>
      <p v-else class="broadcast-empty">暂无历史记录</p>
    </div>
  </div>
</template>

<style scoped>
.broadcast-panel {
  position: relative;
  z-index: 20;
}

.broadcast-bar {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--game-bg-panel);
  border: 1px solid var(--game-border);
  border-radius: var(--game-radius-md);
  cursor: pointer;
  text-align: left;
  box-shadow: var(--game-shadow-card);
  transition: border-color 0.15s, box-shadow 0.15s;
  color: var(--game-text-primary);
  font-family: var(--game-font-ui);
}

.broadcast-bar:hover {
  border-color: var(--game-border-strong);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.broadcast-panel.expanded .broadcast-bar {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom-color: transparent;
}

.broadcast-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.broadcast-latest {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--game-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.broadcast-toggle {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--game-accent-gold);
  font-weight: 600;
}

.broadcast-count {
  flex-shrink: 0;
  font-size: 11px;
  background: var(--game-human-dim);
  color: var(--game-human);
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 600;
}

.broadcast-dropdown {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  max-height: min(320px, 45vh);
  overflow-y: auto;
  background: var(--game-bg-panel-elevated);
  border: 1px solid var(--game-border);
  border-top: none;
  border-radius: 0 0 var(--game-radius-md) var(--game-radius-md);
  box-shadow: var(--game-shadow-lift);
}

.broadcast-dropdown-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--game-text-secondary);
  background: var(--game-bg-table);
  border-bottom: 1px solid var(--game-border);
  position: sticky;
  top: 0;
}

.broadcast-round-hint {
  font-weight: normal;
  color: var(--game-text-muted);
}

.broadcast-list {
  list-style: none;
  margin: 0;
  padding: 6px 0;
}

.broadcast-item {
  padding: 8px 14px;
  border-bottom: 1px solid var(--game-border);
}

.broadcast-item:last-child {
  border-bottom: none;
}

.broadcast-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
  font-size: 11px;
}

.broadcast-item-round {
  background: #e8e4da;
  color: var(--game-text-secondary);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.broadcast-item-source {
  background: var(--game-accent-gold-dim);
  color: var(--game-accent-gold);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.broadcast-item-time {
  margin-left: auto;
  color: var(--game-text-muted);
}

.broadcast-item-text {
  font-size: 13px;
  color: var(--game-text-primary);
  line-height: 1.4;
}

.broadcast-empty {
  margin: 0;
  padding: 20px 14px;
  text-align: center;
  color: var(--game-text-muted);
  font-size: 13px;
}
</style>
