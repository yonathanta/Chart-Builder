<script setup lang="ts">
import { computed } from 'vue';
import type { LineChartConfig } from '../../config/line.config';

const props = defineProps<{
  config: LineChartConfig
}>();

const emit = defineEmits<{
  (e: 'update:config', value: LineChartConfig): void
}>();

const local = computed({
  get: () => props.config,
  set: (v) => emit('update:config', v)
});

const curveOptions = [
  { label: 'Linear', value: 'linear' },
  { label: 'Monotone', value: 'monotone' },
  { label: 'Basis', value: 'basis' },
  { label: 'Cardinal', value: 'cardinal' },
  { label: 'Step', value: 'step' },
];
</script>

<template>
  <div class="config-panel">
    <section class="config-section">
      <h3 class="section-title">Line Style</h3>
      <div class="form-grid">
        <div class="form-field">
          <label>Curve Type</label>
          <select v-model="local.lineStyle.curveType">
            <option v-for="o in curveOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div class="form-field">
          <label>Stroke Width</label>
          <input type="number" min="1" step="0.5" v-model.number="local.lineStyle.strokeWidth" />
        </div>
        <div class="form-field">
          <label>Opacity</label>
          <input type="range" min="0" max="1" step="0.1" v-model.number="local.lineStyle.opacity" />
          <span>{{ local.lineStyle.opacity }}</span>
        </div>
        <div class="form-field">
          <label>Dash Array</label>
          <input type="text" placeholder="e.g. 5,5" v-model="local.lineStyle.dashArray" />
        </div>
      </div>
    </section>

    <section class="config-section">
      <h3 class="section-title">Point Style</h3>
      <div class="form-grid">
        <div class="form-field">
          <label>Show Points</label>
          <input type="checkbox" v-model="local.pointStyle.showPoints" />
        </div>
        <div class="form-field" v-if="local.pointStyle.showPoints">
          <label>Radius</label>
          <input type="number" min="1" step="1" v-model.number="local.pointStyle.radius" />
        </div>
        <div class="form-field" v-if="local.pointStyle.showPoints">
          <label>Hover Radius</label>
          <input type="number" min="1" step="1" v-model.number="local.pointStyle.hoverRadius" />
        </div>
      </div>
    </section>

    <section class="config-section">
      <h3 class="section-title">Interaction</h3>
      <div class="form-grid">
        <div class="form-field">
          <label>Enable Tooltip</label>
          <input type="checkbox" v-model="local.interactionConfig.tooltipEnabled" />
        </div>
        <div class="form-field">
          <label>Highlight on Hover</label>
          <input type="checkbox" v-model="local.interactionConfig.highlightOnHover" />
        </div>
        <div class="form-field">
          <label>Enable Zoom</label>
          <input type="checkbox" v-model="local.interactionConfig.zoomEnabled" />
        </div>
      </div>
    </section>

    <section class="config-section">
      <h3 class="section-title">Legend</h3>
      <div class="form-grid">
        <div class="form-field">
          <label>Show Legend</label>
          <input type="checkbox" v-model="local.legendConfig.enabled" />
        </div>
        <div class="form-field" v-if="local.legendConfig.enabled">
          <label>Position</label>
          <select v-model="local.legendConfig.position">
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.config-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.config-section {
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 12px;
  color: #64748b;
}

input[type="checkbox"] {
  width: fit-content;
}
</style>
