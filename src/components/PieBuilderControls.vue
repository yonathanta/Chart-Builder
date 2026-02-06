<script setup lang="ts">
import { computed } from 'vue';
import type { PieConfig } from '../charts/pie';

const props = defineProps<{ config: PieConfig }>();
const emit = defineEmits<{ (e: 'update:config', value: PieConfig): void }>();

const local = computed({
  get: () => props.config,
  set: (v) => emit('update:config', v)
});
</script>

<template>
  <div class="form-grid">
    <div class="form-field">
      <label>Inner radius (Donut hole)</label>
      <div style="display:flex; align-items:center; gap:12px;">
        <input type="range" min="0" max="150" step="5" v-model.number="local.innerRadius" style="flex:1" />
        <small class="muted" style="min-width:36px">{{ local.innerRadius }}px</small>
      </div>
    </div>
    <div class="form-field">
      <label>Hover expansion</label>
      <div style="display:flex; align-items:center; gap:12px;">
        <input type="range" min="0" max="50" step="1" v-model.number="local.outerRadiusOffset" style="flex:1" />
        <small class="muted" style="min-width:36px">{{ local.outerRadiusOffset }}px</small>
      </div>
    </div>
    <div class="form-field">
      <label>Animation duration (ms)</label>
      <input type="number" min="0" step="100" v-model.number="local.animationDuration" />
    </div>
    <div class="form-field">
      <label>Show labels</label>
      <select v-model="local.showLabels">
        <option :value="true">Yes</option>
        <option :value="false">No</option>
      </select>
    </div>
  </div>
</template>
