<script setup lang="ts">
import type { ChartType } from "../specs/chartSpec";

const props = defineProps<{
  selected: ChartType;
}>();

const emit = defineEmits<{
  (e: "select", type: ChartType): void;
  (e: "preset", payload: { type: ChartType; layoutPreset?: "single" | "horizontal" | "vertical" | "grid" | "smallMultiples"; mode?: "grouped" | "stacked" | "percent" | "simple" }): void;
}>();

type Tile = {
  key: string;
  label: string;
  type: ChartType | "unsupported";
  enabled: boolean;
  icon: string; // inline SVG path or markup
};

const tiles: Tile[] = [
  { key: "bar", label: "Bar Chart", type: "bar", enabled: true, icon: "M4 18h4V6H4v12zm6 0h4V10h-4v8zm6 0h4V14h-4v4z" },
  { key: "bar-stacked", label: "Stacked Bars", type: "bar", enabled: true, icon: "M4 18h4v-4H4v4zm0-6h4V6H4v6zm6 6h4v-6h-4v6zm6 0h4v-8h-4v8z" },
  { key: "bar-grouped", label: "Grouped Bars", type: "bar", enabled: true, icon: "M4 18h3V6H4v12zm4 0h3V10H8v8zm5 0h3V6h-3v12zm4 0h3V12h-3v6z" },
  { key: "bar-split", label: "Split Bars", type: "bar", enabled: true, icon: "M4 18h6V6H4v12zm8 0h6V6h-6v12z" },
  { key: "bullet", label: "Bullet Bars", type: "unsupported", enabled: false, icon: "M4 11h12v2H4v-2zm0-5h16v2H4V6zm0 10h10v2H4v-2z" },
  { key: "column", label: "Column Chart", type: "bar", enabled: true, icon: "M5 18h3V8H5v10zm5 0h3V6h-3v12zm5 0h3V12h-3v6z" },
  { key: "column-stacked", label: "Stacked Columns", type: "bar", enabled: true, icon: "M5 18h3v-4H5v4zm0-6h3V6H5v6zm5 6h3v-6h-3v6zm5 0h3v-8h-3v8z" },
  { key: "column-grouped", label: "Grouped Columns", type: "bar", enabled: true, icon: "M5 18h2V8H5v10zm3 0h2V10H8v8zm4 0h2V8h-2v10zm3 0h2V12h-2v6z" },
  { key: "multi-columns", label: "Multiple Columns", type: "bar", enabled: true, icon: "M4 18h2V6H4v12zm4 0h2V8H8v10zm4 0h2V10h-2v8zm4 0h2V12h-2v6z" },
  { key: "lines", label: "Lines", type: "line", enabled: true, icon: "M4 16l4-4 4 3 4-6 2 2" },
  { key: "multi-lines", label: "Multiple Lines", type: "line", enabled: true, icon: "M4 16l3-3 3 2 3-5 3 3M4 12l3-2 3 1 3-3 3 2" },
  { key: "area", label: "Area Chart", type: "area", enabled: true, icon: "M4 16l4-4 3 1 5-6 4 5v4H4z" },
  { key: "bubble", label: "Bubble Chart", type: "bubble", enabled: true, icon: "M12 4a8 8 0 100 16 8 8 0 000-16z" },
  { key: "scatter", label: "Scatter Plot", type: "scatter", enabled: true, icon: "M6 14h2v2H6v-2zm4-6h2v2h-2V8zm5 3h2v2h-2v-2zm-8-3h2v2H7V8z" },
  { key: "dot-donut", label: "Dot Donut", type: "dotDonut", enabled: true, icon: "M12 4a8 8 0 100 16 8 8 0 000-16zm0 5a3 3 0 110 6 3 3 0 010-6z" },
  { key: "dot", label: "Dot Plot", type: "unsupported", enabled: false, icon: "M6 10h10v2H6v-2zm0 4h10v2H6v-2z" },
  { key: "range", label: "Range Plot", type: "unsupported", enabled: false, icon: "M6 9h10v2H6V9zm6 4h4v2h-4v-2z" },
  { key: "arrow", label: "Arrow Plot", type: "unsupported", enabled: false, icon: "M6 14l4-4-1-1 5-5v6h-6l1-1-4 4z" },
  { key: "election-donut", label: "Election Donut", type: "unsupported", enabled: false, icon: "M12 4a8 8 0 100 16 8 8 0 000-16zm0 3a5 5 0 110 10 5 5 0 010-10z" },
  { key: "pie", label: "Pie Chart", type: "pie", enabled: true, icon: "M12 4v8h8A8 8 0 0012 4zM4 12a8 8 0 008 8v-8H4z" },
  { key: "multi-pies", label: "Multiple Pies", type: "unsupported", enabled: false, icon: "M7 7a4 4 0 100 8 4 4 0 000-8zm10-2a4 4 0 100 8 4 4 0 000-8z" },
  { key: "donut", label: "Donut Chart", type: "unsupported", enabled: false, icon: "M12 4a8 8 0 100 16 8 8 0 000-16zm0 5a3 3 0 110 6 3 3 0 010-6z" },
  { key: "map", label: "Africa Map", type: "map", enabled: true, icon: "M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" },
  { key: "orbit-donut", label: "Multiple Pies", type: "orbitDonut", enabled: true, icon: "M7 7a4 4 0 100 8 4 4 0 000-8zm10-2a4 4 0 100 8 4 4 0 000-8z" },
];

function onClick(tile: Tile) {
  if (!tile.enabled) return;
  if (tile.type === "unsupported") return;
  emit("select", tile.type as ChartType);
  // Suggest preset changes for supported categories
  if (tile.type === "bar") {
    const map: Record<string, { layoutPreset?: "horizontal" | "vertical" | "grid" | "smallMultiples"; mode?: "grouped" | "stacked" | "percent" | "simple" }> = {
      bar: { layoutPreset: "vertical", mode: "simple" },
      "bar-stacked": { layoutPreset: "horizontal", mode: "stacked" },
      "bar-grouped": { layoutPreset: "horizontal", mode: "grouped" },
      "bar-split": { layoutPreset: "horizontal", mode: "percent" },
      column: { layoutPreset: "vertical", mode: "simple" },
      "column-stacked": { layoutPreset: "vertical", mode: "stacked" },
      "column-grouped": { layoutPreset: "vertical", mode: "grouped" },
      "multi-columns": { layoutPreset: "grid", mode: "grouped" },
    };
    const preset = map[tile.key];
    if (preset) emit("preset", { type: "bar", layoutPreset: preset.layoutPreset, mode: preset.mode });
  }
}
</script>

<template>
  <section class="panel">
    <header class="panel__header">
      <div>
        <p class="eyebrow">Step 1</p>
        <h2 class="panel__title">Select chart type</h2>
      </div>
    </header>
    <div class="type-grid">
      <button
        v-for="tile in tiles"
        :key="tile.key"
        class="type-tile"
        :class="{ 'type-tile--active': tile.type !== 'unsupported' && tile.type === selected, 'type-tile--disabled': !tile.enabled || tile.type === 'unsupported' }"
        type="button"
        :title="tile.enabled ? tile.label : tile.label + ' (coming soon)'"
        @click="onClick(tile)"
      >
        <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
          <path :d="tile.icon" fill="#0ea5b7"></path>
        </svg>
        <span class="type-tile__label">{{ tile.label }}</span>
      </button>
    </div>
  </section>
  
</template>

<style scoped>
.type-grid {
  display: grid;
  /* Force two columns and constrain overall width to fit them cleanly */
  grid-template-columns: repeat(2, minmax(120px, 1fr));
  gap: 12px;
  max-width: 240px;
  margin: 0 auto;
}
.type-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 8px;
  background: #ffffff;
  color: #0f172a;
  box-sizing: border-box;
  width: 100%;
  /* Keep tiles visually consistent when switching types */
  min-height: 84px;
}
.type-tile:hover { box-shadow: 0 0 0 2px #0891b220; }
.type-tile--active { box-shadow: 0 0 0 2px #0ea5b7; border-color: #0ea5b7; }
.type-tile--disabled { opacity: 0.45; cursor: not-allowed; }
.type-tile__label { margin-top: 6px; font-size: 13px; }

/* Responsive: collapse to single column on narrow viewports */
@media (max-width: 420px) {
  .type-grid {
    grid-template-columns: 1fr;
    max-width: 320px;
  }
}
</style>
