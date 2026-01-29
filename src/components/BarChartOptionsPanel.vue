<script setup lang="ts">
const props = defineProps<{
  orientation: "vertical" | "horizontal";
  mode: "grouped" | "stacked" | "percent";
  sort?: { field: "category" | "value"; order: "asc" | "desc" };
  showAxes?: boolean;
  showLabels?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:orientation", value: "vertical" | "horizontal"): void;
  (e: "update:mode", value: "grouped" | "stacked" | "percent"): void;
  (e: "update:sort", value: { field: "category" | "value"; order: "asc" | "desc" } | undefined): void;
  (e: "update:showAxes", value: boolean): void;
  (e: "update:showLabels", value: boolean): void;
}>();

function onOrientation(value: "vertical" | "horizontal") {
  emit("update:orientation", value);
}

function onMode(value: "grouped" | "stacked" | "percent") {
  emit("update:mode", value);
}

function onSortField(field: "category" | "value") {
  emit("update:sort", { field, order: props.sort?.order ?? "desc" });
}

function onSortOrder(order: "asc" | "desc") {
  emit("update:sort", props.sort ? { ...props.sort, order } : { field: "value", order });
}

function onSortClear() {
  emit("update:sort", undefined);
}
</script>

<template>
  <section class="panel">
    <header class="panel__header">
      <div>
        <p class="eyebrow">Bar chart options</p>
        <h3 class="panel__title">Orientation, grouping, labels</h3>
      </div>
    </header>

    <div class="form-grid">
      <div class="form-field">
        <span>Orientation</span>
        <div class="pill-group">
          <button
            type="button"
            class="pill"
            :class="{ 'pill--active': orientation === 'vertical' }"
            @click="onOrientation('vertical')"
          >Vertical</button>
          <button
            type="button"
            class="pill"
            :class="{ 'pill--active': orientation === 'horizontal' }"
            @click="onOrientation('horizontal')"
          >Horizontal</button>
        </div>
      </div>

      <div class="form-field">
        <span>Layout mode</span>
        <div class="pill-group">
          <button
            type="button"
            class="pill"
            :class="{ 'pill--active': mode === 'grouped' }"
            @click="onMode('grouped')"
          >Grouped</button>
          <button
            type="button"
            class="pill"
            :class="{ 'pill--active': mode === 'stacked' }"
            @click="onMode('stacked')"
          >Stacked</button>
          <button
            type="button"
            class="pill"
            :class="{ 'pill--active': mode === 'percent' }"
            @click="onMode('percent')"
          >100% stacked</button>
        </div>
      </div>

      <div class="form-field form-field--wide">
        <span>Sorting</span>
        <div class="pill-group">
          <button
            type="button"
            class="pill"
            :class="{ 'pill--active': sort?.field === 'value' }"
            @click="onSortField('value')"
          >By value</button>
          <button
            type="button"
            class="pill"
            :class="{ 'pill--active': sort?.field === 'category' }"
            @click="onSortField('category')"
          >By category</button>
          <button type="button" class="pill" @click="onSortClear">None</button>
        </div>
        <div class="pill-group" style="margin-top: 8px">
          <button
            type="button"
            class="pill"
            :class="{ 'pill--active': sort?.order === 'asc' }"
            @click="onSortOrder('asc')"
          >Asc</button>
          <button
            type="button"
            class="pill"
            :class="{ 'pill--active': sort?.order === 'desc' }"
            @click="onSortOrder('desc')"
          >Desc</button>
        </div>
      </div>

      <div class="form-field">
        <label class="checkbox">
          <input type="checkbox" :checked="showAxes ?? true" @change="emit('update:showAxes', ($event.target as HTMLInputElement).checked)" />
          <span>Show axes</span>
        </label>
      </div>

      <div class="form-field">
        <label class="checkbox">
          <input type="checkbox" :checked="showLabels ?? false" @change="emit('update:showLabels', ($event.target as HTMLInputElement).checked)" />
          <span>Show labels on bars</span>
        </label>
      </div>
    </div>
  </section>
</template>
