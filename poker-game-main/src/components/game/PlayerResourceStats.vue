<script setup lang="ts">
defineProps<{
  energy: number
  totalPower: number
}>()
</script>

<template>
  <span
    class="stat-chip stat-chip--energy"
    :class="{ 'stat-chip--energy-negative': energy < 0 }"
  >
    费用 <strong>{{ energy }}</strong>
  </span>
  <span class="stat-chip stat-chip--power">
    战力 <strong>{{ totalPower }}</strong>
  </span>
</template>
