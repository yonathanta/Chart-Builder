<script setup lang="ts">
import type { Layout, Style } from "../specs/chartSpec";

const props = defineProps<{
  layout?: Layout;
  style?: Style;
  title?: string;
}>();

const emit = defineEmits<{
  (e: "update:layout", payload: Partial<Layout>): void;
  (e: "update:style", payload: Partial<Style>): void;
  (e: "update:title", payload: string): void;
}>();

const layoutPresets: Layout["preset"][] = [
  "single",
  "horizontal",
  "vertical",
  "grid",
  "smallMultiples",
  "circular",
];

const backgroundPresets = [
  "#ffffff",
  "#f8fafc",
  "#f1f5f9",
  "#f9fafb",
  "#f3f4f6",
  "#fffbeb",
  "#0f172a",
  "#111827",
];

function updateLayout(key: keyof Layout, value: unknown) {
  emit("update:layout", { [key]: value } as Partial<Layout>);
}

function updateStyle(key: keyof Style, value: unknown) {
  emit("update:style", { [key]: value } as Partial<Style>);
}
</script>

<template>
  <div class="form-grid">
    <label class="form-field" style="grid-column: 1 / -1;">
      <span>Chart title</span>
      <input
        type="text"
        placeholder="Enter chart title..."
        :value="title"
        @input="emit('update:title', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="form-field">
      <span>Layout preset</span>
      <select
        :value="layout?.preset ?? 'single'"
        @change="updateLayout('preset', ($event.target as HTMLSelectElement).value)">
        <option v-for="preset in layoutPresets" :key="preset" :value="preset">{{ preset }}</option>
      </select>
    </label>

    <label class="form-field">
      <span>Width (px)</span>
      <input
        type="number"
        min="320"
        :value="layout?.width ?? ''"
        @input="updateLayout('width', Number(($event.target as HTMLInputElement).value) || undefined)"
      />
    </label>

    <label class="form-field">
      <span>Height (px)</span>
      <input
        type="number"
        min="200"
        :value="layout?.height ?? ''"
        @input="updateLayout('height', Number(($event.target as HTMLInputElement).value) || undefined)"
      />
    </label>

    <div class="form-field" style="grid-column: 1 / -1;">
      <span>Background color</span>
      <div class="color-swatch-grid">
        <button
          v-for="color in backgroundPresets"
          :key="color"
          type="button"
          class="color-swatch"
          :class="{ 'is-active': style?.background === color }"
          :style="{ backgroundColor: color }"
          @click="updateStyle('background', color)"
          :title="color"
        ></button>
        
        <div class="custom-color-trigger">
          <input
            type="color"
            :value="style?.background || '#ffffff'"
            @input="updateStyle('background', ($event.target as HTMLInputElement).value)"
            class="color-input-hidden"
            id="bg-custom-color"
          />
          <label for="bg-custom-color" class="color-swatch custom-trigger" title="Custom color">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-swatch-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--border, #e2e8f0);
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-swatch:hover {
  transform: scale(1.1);
}

.color-swatch.is-active {
  border: 2px solid var(--primary, #2563eb);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.custom-color-trigger {
  position: relative;
}

.color-input-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.custom-trigger {
  background: white;
  color: #64748b;
}

.custom-trigger:hover {
  color: #2563eb;
}
</style>
