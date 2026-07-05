<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'small'
  disabled?: boolean
  type?: 'button' | 'submit'
}>(), {
  variant: 'secondary',
  disabled: false,
  type: 'button',
})
</script>

<template>
  <button
    :type="type"
    class="game-btn"
    :class="[`game-btn--${variant}`, { 'game-btn--disabled': disabled }]"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style scoped>
.game-btn {
  font-family: var(--game-font-ui);
  font-weight: 700;
  border: none;
  border-radius: var(--game-radius-md);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s;
  padding: 12px 20px;
  font-size: 15px;
  min-height: 44px;
}

.game-btn--primary {
  background: linear-gradient(180deg, #d4a84a 0%, #a46d1f 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(164, 109, 31, 0.35);
}

.game-btn--secondary {
  background: var(--game-bg-panel-elevated);
  color: var(--game-text-primary);
  border: 1px solid var(--game-border);
}

.game-btn--danger {
  background: linear-gradient(180deg, #e07070 0%, #b84040 100%);
  color: #fff;
}

.game-btn--ghost {
  background: transparent;
  color: var(--game-text-secondary);
  border: 1px solid var(--game-border);
}

.game-btn--small {
  padding: 8px 14px;
  font-size: 13px;
  min-height: 36px;
}

.game-btn:not(.game-btn--disabled):hover {
  transform: translateY(-1px);
}

.game-btn--primary:not(.game-btn--disabled):hover {
  box-shadow: 0 6px 16px rgba(164, 109, 31, 0.45);
}

.game-btn--disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none !important;
}
</style>
