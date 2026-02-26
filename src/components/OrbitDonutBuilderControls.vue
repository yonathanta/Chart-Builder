<script setup lang="ts">
import { computed } from 'vue';
import type { OrbitDonutConfig } from '../charts/orbitDonut';

const props = defineProps<{ config: OrbitDonutConfig }>();
const emit = defineEmits<{ (e: 'update:config', value: OrbitDonutConfig): void }>();

const local = computed({
  get: () => props.config,
  set: (v) => emit('update:config', v)
});
</script>

<template>
  <div class="form-grid">
    <div class="form-field">
      <label>Layout</label>
      <select v-model="local.layout">
        <option value="horizontal">Horizontal</option>
        <option value="vertical">Vertical</option>
        <option value="circular">Circular</option>
        <option value="grid">Grid</option>
      </select>
    </div>
    <div class="form-field">
      <label>Center color</label>
      <input type="color" v-model="local.centerColor" />
    </div>
    <div class="form-field">
      <label>Text color</label>
      <input type="color" v-model="local.textColor" />
    </div>
    <div class="form-field">
      <label>Label color</label>
      <input type="color" v-model="local.labelColor" />
    </div>
  </div>
</template>
