<script setup lang="ts">
import { computed } from 'vue';
import type { AreaChartConfig } from '../../config/area.config';

const props = defineProps<{
  config: AreaChartConfig
}>();

const emit = defineEmits<{
  (e: 'update:config', value: AreaChartConfig): void
}>();

const local = computed({
  get: () => props.config,
  set: (v) => emit('update:config', v)
});
</script>

<template>
  <div class="config-panel">
    <section class="config-section">
      <h3 class="section-title">Area Style</h3>
      <div class="form-grid">
        <div class="form-field">
          <label>Fill Color</label>
          <input type="color" v-model="local.areaStyle.fillColor" />
        </div>
        <div class="form-field">
          <label>Fill Opacity</label>
          <input type="range" min="0" max="1" step="0.1" v-model.number="local.areaStyle.fillOpacity" />
          <span>{{ local.areaStyle.fillOpacity }}</span>
        </div>
        <div class="form-field">
          <label>Enable Gradient</label>
          <input type="checkbox" v-model="local.areaStyle.gradientEnabled" />
        </div>
        <div class="form-field">
          <label>Baseline</label>
          <select v-model="local.areaStyle.baseline">
            <option value="zero">Zero</option>
            <option :value="100">100</option>
          </select>
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
          <label>Enable Brush</label>
          <input type="checkbox" v-model="local.interactionConfig.brushEnabled" />
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
</style>
