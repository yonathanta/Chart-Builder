<script setup lang="ts">
import { computed } from 'vue';
import type { StackedBarConfig } from '../charts/stackedBar';

const props = defineProps<{ config: StackedBarConfig }>();
const emit = defineEmits<{ (e: 'update:config', value: StackedBarConfig): void }>();

const local = computed({
  get: () => props.config,
  set: (v) => emit('update:config', v)
});
</script>

<template>
  <div class="form-grid">
    <div class="form-field">
      <label>Corner radius</label>
      <input type="range" min="0" max="20" v-model.number="local.cornerRadius" />
      <small class="muted">{{ local.cornerRadius }}px</small>
    </div>
    <div class="form-field">
      <label>Bar padding</label>
      <input type="range" min="0" max="0.5" step="0.05" v-model.number="local.barPadding" />
      <small class="muted">{{ local.barPadding }}</small>
    </div>
    <div class="form-field">
      <label>Animation duration (ms)</label>
      <input type="number" min="0" step="100" v-model.number="local.animationDuration" />
    </div>
    <div class="form-field">
      <label class="checkbox">
        <input type="checkbox" v-model="local.showTooltip" />
        <span>Show tooltip</span>
      </label>
    </div>
    <div class="form-field">
      <label class="checkbox">
        <input type="checkbox" v-model="local.showLegend" />
        <span>Show legend</span>
      </label>
    </div>
    <div class="form-field">
      <label class="checkbox">
        <input type="checkbox" v-model="local.showValues" />
        <span>Show values</span>
      </label>
    </div>
  </div>
</template>
