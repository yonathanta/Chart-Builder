<script setup lang="ts">
import type { Layout, Style } from "../specs/chartSpec";

const props = defineProps<{
  layout?: Layout;
  style?: Style;
}>();

const emit = defineEmits<{
  (e: "update:layout", payload: Partial<Layout>): void;
  (e: "update:style", payload: Partial<Style>): void;
}>();

const layoutPresets: Layout["preset"][] = [
  "single",
  "horizontal",
  "vertical",
  "grid",
  "smallMultiples",
];

function updateLayout(key: keyof Layout, value: unknown) {
  emit("update:layout", { [key]: value } as Partial<Layout>);
}

function updateStyle(key: keyof Style, value: unknown) {
  emit("update:style", { [key]: value } as Partial<Style>);
}
</script>

<template>
  <section class="panel">
    <header class="panel__header">
      <div>
        <p class="eyebrow">Step 2</p>
        <h2 class="panel__title">Configure options</h2>
      </div>
    </header>

    <div class="form-grid">
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

      <label class="form-field">
        <span>Background</span>
        <input
          type="text"
          placeholder="#ffffff"
          :value="style?.background ?? ''"
          @input="updateStyle('background', ($event.target as HTMLInputElement).value || undefined)"
        />
      </label>

      <label class="form-field">
        <span>Palette (comma-separated)</span>
        <input
          type="text"
          :value="style?.palette?.join(', ') ?? ''"
          placeholder="#2E86AB, #F6C85F, #6FB07F"
          @input="updateStyle('palette', ($event.target as HTMLInputElement).value
            .split(',')
            .map(v => v.trim())
            .filter(Boolean))"
        />
      </label>
    </div>
  </section>
</template>
