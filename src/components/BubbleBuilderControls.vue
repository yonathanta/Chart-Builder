<script setup lang="ts">
import { computed } from 'vue';
import type { BubbleChartConfig } from '../charts/bubble';

const props = defineProps<{ config: BubbleChartConfig }>();
const emit = defineEmits<{ (e: 'update:config', value: BubbleChartConfig): void }>();

const local = computed({
  get: () => props.config,
  set: (v) => emit('update:config', v)
});
</script>

<template>
  <div class="form-grid">
    <div class="form-field">
      <label>Top bubbles color</label>
      <input type="color" v-model="local.topColor" />
    </div>
    <div class="form-field">
      <label>Bottom bubbles color</label>
      <input type="color" v-model="local.bottomColor" />
    </div>
    <div class="form-field">
      <label>Middle bubbles color</label>
      <input type="color" v-model="local.middleColor" />
    </div>
    <div class="form-field">
      <label>Text color</label>
      <input type="color" v-model="local.textColor" />
    </div>
  </div>
</template>
