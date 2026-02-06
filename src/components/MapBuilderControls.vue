<script setup lang="ts">
import { computed } from 'vue';
import type { MapConfig } from '../charts/map';

const props = defineProps<{ config: MapConfig }>();
const emit = defineEmits<{ (e: 'update:config', value: MapConfig): void }>();

const local = computed({
  get: () => props.config,
  set: (v) => emit('update:config', v)
});

const COLOR_SCHEMES = [
  { label: 'Blues', value: 'interpolateBlues' },
  { label: 'Greens', value: 'interpolateGreens' },
  { label: 'Reds', value: 'interpolateReds' },
  { label: 'Purples', value: 'interpolatePurples' },
  { label: 'Greys', value: 'interpolateGreys' },
  { label: 'Viridis', value: 'interpolateViridis' },
  { label: 'Magma', value: 'interpolateMagma' },
  { label: 'Inferno', value: 'interpolateInferno' },
  { label: 'Plasma', value: 'interpolatePlasma' },
  { label: 'Cividis', value: 'interpolateCividis' },
  { label: 'Warm', value: 'interpolateWarm' },
  { label: 'Cool', value: 'interpolateCool' },
  { label: 'Spectral', value: 'interpolateSpectral' },
];

function updateCenter(index: number, val: string) {
    const center = [...(local.value.projectionCenter || [20, 5])] as [number, number];
    center[index] = Number(val);
    local.value = { ...local.value, projectionCenter: center };
}

function updateThresholds(val: string) {
    const thresholds = val.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
    local.value = { ...local.value, thresholds };
}
</script>

<template>
  <div class="form-grid">
    <div class="form-field">
      <label>Color Mode</label>
      <select v-model="local.colorMode">
        <option value="gradient">Gradient (Continuous)</option>
        <option value="threshold">Threshold (Discrete)</option>
      </select>
    </div>

    <!-- Custom Gradient Stops -->
    <div class="form-field" style="grid-column: 1 / -1; background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <label style="font-weight: 600; margin: 0;">Gradient Stops (Custom)</label>
            <input type="checkbox" v-model="local.useCustomGradient" />
        </div>
        <div v-if="local.useCustomGradient" style="display: grid; grid-template-columns: 1fr; gap: 12px;">
            <div class="form-field">
                <label>Lowest value color</label>
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="color" v-model="local.gradientLowColor" style="width:40px; height:32px; padding:0; border:1px solid #ddd; border-radius:4px;" />
                    <input type="text" v-model="local.gradientLowColor" style="flex:1" />
                </div>
            </div>
            <div class="form-field">
                <label>Highest value color</label>
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="color" v-model="local.gradientHighColor" style="width:40px; height:32px; padding:0; border:1px solid #ddd; border-radius:4px;" />
                    <input type="text" v-model="local.gradientHighColor" style="flex:1" />
                </div>
            </div>
            <p style="grid-column: 1 / -1; font-size: 11px; margin: 4px 0 0;" class="muted">
                Interpolates between lowest and highest values; overrides palette/thresholds.
            </p>
        </div>
    </div>

    <div v-if="!local.useCustomGradient" class="form-field">
      <label>Color Scheme</label>
      <select v-model="local.colorScheme">
        <option v-for="scheme in COLOR_SCHEMES" :key="scheme.value" :value="scheme.value">{{ scheme.label }}</option>
      </select>
    </div>

    <div v-if="local.colorMode === 'threshold'" class="form-field">
      <label>Thresholds (comma separated)</label>
      <input type="text" :value="local.thresholds?.join(',')" @input="updateThresholds(($event.target as HTMLInputElement).value)" placeholder="e.g. 20, 40, 60, 80" />
    </div>

    <div class="form-field">
      <label>Map Scale</label>
      <div style="display:flex; align-items:center; gap:12px;">
        <input type="range" min="100" max="2000" step="50" :value="local.scale" @input="local.scale = Number(($event.target as HTMLInputElement).value)" style="flex:1" />
        <small class="muted" style="min-width:36px">{{ local.scale }}</small>
      </div>
    </div>
    
    <div class="form-field">
      <label>Center Longitude</label>
      <input type="number" step="0.5" :value="local.projectionCenter?.[0]" @input="updateCenter(0, ($event.target as HTMLInputElement).value)" />
    </div>

    <div class="form-field">
      <label>Center Latitude</label>
      <input type="number" step="0.5" :value="local.projectionCenter?.[1]" @input="updateCenter(1, ($event.target as HTMLInputElement).value)" />
    </div>

    <div class="form-field">
        <label>Background Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
            <input type="color" v-model="local.backgroundColor" style="width:40px; height:32px; padding:0; border:1px solid #ddd; border-radius:4px;" />
            <input type="text" v-model="local.backgroundColor" style="flex:1" />
        </div>
    </div>

    <div class="form-field">
        <label>No-data Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
            <input type="color" v-model="local.noDataColor" style="width:40px; height:32px; padding:0; border:1px solid #ddd; border-radius:4px;" />
            <input type="text" v-model="local.noDataColor" style="flex:1" />
        </div>
    </div>

    <div class="form-field">
      <label>Animation duration (ms)</label>
      <input type="number" min="0" step="100" v-model.number="local.animationDuration" />
    </div>

    <div class="form-field">
      <label>Show Tooltip</label>
      <select v-model="local.showTooltip">
        <option :value="true">Yes</option>
        <option :value="false">No</option>
      </select>
    </div>
  </div>
</template>
