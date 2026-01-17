<script setup lang="ts">
import type { ExportFormat } from "../export/exportService";

const emit = defineEmits<{
  (e: "export", format: ExportFormat): void;
}>();

const formats: ExportFormat[] = ["svg", "png", "pdf"];
</script>

<template>
  <section class="panel">
    <header class="panel__header">
      <div>
        <p class="eyebrow">Step 4</p>
        <h2 class="panel__title">Export</h2>
      </div>
    </header>
    <div class="pill-group">
      <button
        v-for="format in formats"
        :key="format"
        class="pill"
        type="button"
        @click="emit('export', format)"
      >
        Export {{ format.toUpperCase() }}
      </button>
    </div>
    <p class="muted">Exports call dedicated services; UI stays decoupled from D3.</p>
  </section>
</template>
