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
  margin-bottom: 10px;
}

.broadcast-bar {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(180deg, #fffdf8 0%, #f6f4ef 100%);
  border: 1px solid #d8d2c4;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  box-shadow: 0 2px 6px rgba(31, 37, 34, 0.06);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.broadcast-bar:hover {
  border-color: #a46d1f;
  box-shadow: 0 3px 10px rgba(164, 109, 31, 0.12);
}

.broadcast-panel.expanded .broadcast-bar {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom-color: #e8e4da;
}

.broadcast-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.broadcast-latest {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #1f2522;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.broadcast-toggle {
  flex-shrink: 0;
  font-size: 12px;
  color: #a46d1f;
  font-weight: 600;
}

.broadcast-count {
  flex-shrink: 0;
  font-size: 11px;
  background: #2f6f5e;
  color: #fff;
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
  background: #fffdf8;
  border: 1px solid #d8d2c4;
  border-top: none;
  border-radius: 0 0 10px 10px;
  box-shadow: 0 8px 20px rgba(31, 37, 34, 0.12);
}

.broadcast-dropdown-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #69706b;
  background: #f6f4ef;
  border-bottom: 1px solid #e8e4da;
  position: sticky;
  top: 0;
}

.broadcast-round-hint {
  font-weight: normal;
  color: #888;
}

.broadcast-list {
  list-style: none;
  margin: 0;
  padding: 6px 0;
}

.broadcast-item {
  padding: 8px 14px;
  border-bottom: 1px solid #f0ece4;
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
  color: #69706b;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.broadcast-item-source {
  background: rgba(164, 109, 31, 0.15);
  color: #a46d1f;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.broadcast-item-time {
  margin-left: auto;
  color: #aaa;
}

.broadcast-item-text {
  font-size: 13px;
  color: #1f2522;
  line-height: 1.4;
}

.broadcast-empty {
  margin: 0;
  padding: 20px 14px;
  text-align: center;
  color: #888;
  font-size: 13px;
}
</style>
