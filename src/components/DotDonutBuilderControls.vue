<script setup lang="ts">
import { computed } from 'vue';
import type { DotDonutConfig } from '../charts/dotDonut';

const props = defineProps<{ config: DotDonutConfig }>();
const emit = defineEmits<{ (e: 'update:config', value: DotDonutConfig): void }>();

const local = computed({
  get: () => props.config,
  set: (v) => emit('update:config', v)
});
</script>

<template>
  <div class="form-grid">
    <div class="form-field">
      <label>Dot count</label>
      <input type="number" min="10" max="100" v-model.number="local.dotsCount" />
    </div>
    <div class="form-field">
      <label>Active color</label>
      <input type="color" v-model="local.activeColor" />
    </div>
    <div class="form-field">
      <label>Inactive color</label>
      <input type="color" v-model="local.inactiveColor" />
    </div>
    <div class="form-field">
      <label>Text color</label>
      <input type="color" v-model="local.textColor" />
    </div>
  </div>
</template>
