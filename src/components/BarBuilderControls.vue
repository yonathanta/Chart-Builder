<script setup lang="ts">
import { computed } from "vue";

export type BarBuilderConfig = {
  cornerRadius: number;
  barPadding: number;
  barColor: string;
  animationDuration: number;
  staggerDelay: number;
  showGridlines: boolean;
  showValues: boolean;
  xLabelOffset: number;
  xLabelRotation: number;
  yLabelOffset: number;
  // New options
  labelAlignment: "left" | "right";
  separateLabelLine: boolean;
  valueAlignment: "left" | "right";
  numberFormat: string;
  swapLabelsAndValues: boolean;
  replaceCodesWithFlags: boolean;
  valueMin?: number;
  valueMax?: number;
  customizeColors: boolean;
  // Gradient coloring across min/max
  useGradientColors: boolean;
  gradientLowColor?: string;
  gradientHighColor?: string;
  // Value-based coloring
  useValueColors: boolean;
  lowThreshold?: number;
  highThreshold?: number;
  lowColor?: string;
  midColor?: string;
  highColor?: string;
  separatingLines: boolean;
  barBackground: boolean;
  thickerBars: boolean;
  sortBars: boolean;
  reverseOrder: boolean;
  groupBarsByColumn: boolean;
  overlays: BarOverlay[];
};

export type BarOverlay = {
  id: string;
  name: string;
  type: "value" | "range";
  column: string;
  rangeMinColumn?: string;
  rangeMaxColumn?: string;
  labelMode: "first" | "legend" | "hidden";
  labelText?: string;
  color: string;
  opacity: number; // 0-1
  visible: boolean;
};

const props = defineProps<{
  config: BarBuilderConfig;
  fields?: string[];
}>();

const fields = computed(() => props.fields ?? []);

const emit = defineEmits<{
  (e: "update:config", value: BarBuilderConfig): void;
}>();

const cornerRadius = computed({
  get: () => props.config.cornerRadius,
  set: (v: number) => emit("update:config", { ...props.config, cornerRadius: v }),
});

const barPadding = computed({
  get: () => props.config.barPadding,
  set: (v: number) => emit("update:config", { ...props.config, barPadding: v }),
});

const barColor = computed({
  get: () => props.config.barColor,
  set: (v: string) => emit("update:config", { ...props.config, barColor: v }),
});

const animationDuration = computed({
  get: () => props.config.animationDuration,
  set: (v: number) => emit("update:config", { ...props.config, animationDuration: v }),
});

const staggerDelay = computed({
  get: () => props.config.staggerDelay,
  set: (v: number) => emit("update:config", { ...props.config, staggerDelay: v }),
});

const showGridlines = computed({
  get: () => props.config.showGridlines,
  set: (v: boolean) => emit("update:config", { ...props.config, showGridlines: v }),
});

const showValues = computed({
  get: () => props.config.showValues,
  set: (v: boolean) => emit("update:config", { ...props.config, showValues: v }),
});

const xLabelOffset = computed({
  get: () => props.config.xLabelOffset,
  set: (v: number) => emit("update:config", { ...props.config, xLabelOffset: v }),
});

const xLabelRotation = computed({
  get: () => props.config.xLabelRotation,
  set: (v: number) => emit("update:config", { ...props.config, xLabelRotation: v }),
});

const yLabelOffset = computed({
  get: () => props.config.yLabelOffset,
  set: (v: number) => emit("update:config", { ...props.config, yLabelOffset: v }),
});

const labelAlignment = computed({
  get: () => props.config.labelAlignment,
  set: (v: "left" | "right") => emit("update:config", { ...props.config, labelAlignment: v }),
});

const separateLabelLine = computed({
  get: () => props.config.separateLabelLine,
  set: (v: boolean) => emit("update:config", { ...props.config, separateLabelLine: v }),
});

const valueAlignment = computed({
  get: () => props.config.valueAlignment,
  set: (v: "left" | "right") => emit("update:config", { ...props.config, valueAlignment: v }),
});

const numberFormat = computed({
  get: () => props.config.numberFormat,
  set: (v: string) => emit("update:config", { ...props.config, numberFormat: v }),
});

const swapLabelsAndValues = computed({
  get: () => props.config.swapLabelsAndValues,
  set: (v: boolean) => emit("update:config", { ...props.config, swapLabelsAndValues: v }),
});

const replaceCodesWithFlags = computed({
  get: () => props.config.replaceCodesWithFlags,
  set: (v: boolean) => emit("update:config", { ...props.config, replaceCodesWithFlags: v }),
});

const valueMin = computed({
  get: () => props.config.valueMin,
  set: (v?: number) => emit("update:config", { ...props.config, valueMin: v }),
});

const valueMax = computed({
  get: () => props.config.valueMax,
  set: (v?: number) => emit("update:config", { ...props.config, valueMax: v }),
});

const customizeColors = computed({
  get: () => props.config.customizeColors,
  set: (v: boolean) => emit("update:config", { ...props.config, customizeColors: v }),
});

const useGradientColors = computed({
  get: () => props.config.useGradientColors,
  set: (v: boolean) => emit("update:config", { ...props.config, useGradientColors: v }),
});

const gradientLowColor = computed({
  get: () => props.config.gradientLowColor ?? '#a7f3d0',
  set: (v: string) => emit("update:config", { ...props.config, gradientLowColor: v }),
});

const gradientHighColor = computed({
  get: () => props.config.gradientHighColor ?? '#065f46',
  set: (v: string) => emit("update:config", { ...props.config, gradientHighColor: v }),
});

const useValueColors = computed({
  get: () => props.config.useValueColors,
  set: (v: boolean) => emit("update:config", { ...props.config, useValueColors: v }),
});

const lowThreshold = computed<number>({
  get: () => props.config.lowThreshold ?? 10,
  set: (v: number) => emit("update:config", { ...props.config, lowThreshold: v }),
});

const highThreshold = computed<number>({
  get: () => props.config.highThreshold ?? 90,
  set: (v: number) => emit("update:config", { ...props.config, highThreshold: v }),
});

const lowColor = computed({
  get: () => props.config.lowColor ?? '#a7f3d0',
  set: (v: string) => emit("update:config", { ...props.config, lowColor: v }),
});

const midColor = computed({
  get: () => props.config.midColor ?? '#34d399',
  set: (v: string) => emit("update:config", { ...props.config, midColor: v }),
});

const highColor = computed({
  get: () => props.config.highColor ?? '#065f46',
  set: (v: string) => emit("update:config", { ...props.config, highColor: v }),
});

const separatingLines = computed({
  get: () => props.config.separatingLines,
  set: (v: boolean) => emit("update:config", { ...props.config, separatingLines: v }),
});

const barBackground = computed({
  get: () => props.config.barBackground,
  set: (v: boolean) => emit("update:config", { ...props.config, barBackground: v }),
});

const thickerBars = computed({
  get: () => props.config.thickerBars,
  set: (v: boolean) => emit("update:config", { ...props.config, thickerBars: v }),
});

const sortBars = computed({
  get: () => props.config.sortBars,
  set: (v: boolean) => emit("update:config", { ...props.config, sortBars: v }),
});

const reverseOrder = computed({
  get: () => props.config.reverseOrder,
  set: (v: boolean) => emit("update:config", { ...props.config, reverseOrder: v }),
});

const groupBarsByColumn = computed({
  get: () => props.config.groupBarsByColumn,
  set: (v: boolean) => emit("update:config", { ...props.config, groupBarsByColumn: v }),
});

function updateOverlays(next: BarOverlay[]) {
  emit("update:config", { ...props.config, overlays: next });
}

function addOverlay() {
  const next: BarOverlay = {
    id: `ov-${Date.now()}`,
    name: `Overlay ${props.config.overlays.length + 1}`,
    type: "value",
    column: props.fields?.[0] ?? "",
    labelMode: "first",
    labelText: "",
    color: "#0891b2",
    opacity: 0.6,
    visible: true,
  };
  updateOverlays([...props.config.overlays, next]);
}

function updateOverlay(id: string, patch: Partial<BarOverlay>) {
  updateOverlays(props.config.overlays.map(o => o.id === id ? { ...o, ...patch } : o));
}

function deleteOverlay(id: string) {
  updateOverlays(props.config.overlays.filter(o => o.id !== id));
}
</script>

<template>
  <section class="panel">
    <header class="panel__header">
      <div>
        <p class="eyebrow">Bar styling</p>
        <h3 class="panel__title">Builder controls</h3>
        <p class="muted">Rounded corners, spacing, color, animation, labels.</p>
      </div>
    </header>

    <div class="form-grid">
      <label class="form-field">
        <span>Corner radius (0–20)</span>
        <input
          type="range"
          min="0"
          max="20"
          step="1"
          :value="cornerRadius"
          @input="cornerRadius = Number(($event.target as HTMLInputElement).value)"
        />
        <small class="muted">{{ cornerRadius }} px</small>
      </label>

      <label class="form-field">
        <span>Bar padding (0–0.5)</span>
        <input
          type="range"
          min="0"
          max="0.5"
          step="0.01"
          :value="barPadding"
          @input="barPadding = Number(($event.target as HTMLInputElement).value)"
        />
        <small class="muted">{{ barPadding.toFixed(2) }}</small>
      </label>

      <label class="form-field">
        <span>Bar color</span>
        <input
          type="color"
          :value="barColor"
          @input="barColor = ($event.target as HTMLInputElement).value"
        />
        <input
          type="text"
          :value="barColor"
          @input="barColor = ($event.target as HTMLInputElement).value"
          placeholder="#4F81BD"
          style="margin-top: 6px"
        />
      </label>

      <div class="form-field">
        <label class="checkbox">
          <input type="checkbox" :checked="customizeColors" @change="customizeColors = ($event.target as HTMLInputElement).checked" />
          <span>Customize colors</span>
        </label>
      </div>

      <div class="form-field">
        <label class="checkbox">
          <input type="checkbox" :checked="useGradientColors" @change="useGradientColors = ($event.target as HTMLInputElement).checked" />
          <span>Color by gradient (min → max value)</span>
        </label>
      </div>

      <div v-if="useGradientColors" class="form-field form-field--wide" style="border: 1px dashed #e2e8f0; padding: 8px; border-radius: 6px;">
        <span>Gradient stops</span>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top:8px;">
          <label class="form-field">
            <span>Lowest value color</span>
            <input type="color" :value="gradientLowColor" @input="gradientLowColor = ($event.target as HTMLInputElement).value" />
          </label>
          <label class="form-field">
            <span>Highest value color</span>
            <input type="color" :value="gradientHighColor" @input="gradientHighColor = ($event.target as HTMLInputElement).value" />
          </label>
        </div>
        <small class="muted">Interpolates between lowest and highest bar values; overrides palette/value thresholds.</small>
      </div>

      <div class="form-field">
        <label class="checkbox">
          <input type="checkbox" :checked="useValueColors" @change="useValueColors = ($event.target as HTMLInputElement).checked" />
          <span>Color bars by value (thresholds)</span>
        </label>
      </div>

      <div v-if="useValueColors" class="form-field form-field--wide" style="border: 1px dashed #e2e8f0; padding: 8px; border-radius: 6px;">
        <span>Value-based colors</span>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top:8px;">
          <label class="form-field">
            <span>Low threshold (&lt;)</span>
            <input type="number" :value="lowThreshold ?? 10" @input="lowThreshold = ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined" />
          </label>
          <label class="form-field">
            <span>Low color</span>
            <input type="color" :value="lowColor" @input="lowColor = ($event.target as HTMLInputElement).value" />
          </label>

          <label class="form-field">
            <span>High threshold (&gt;)</span>
            <input type="number" :value="highThreshold ?? 90" @input="highThreshold = ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined" />
          </label>
          <label class="form-field">
            <span>High color</span>
            <input type="color" :value="highColor" @input="highColor = ($event.target as HTMLInputElement).value" />
          </label>

          <label class="form-field">
            <span>Mid-range color</span>
            <input type="color" :value="midColor" @input="midColor = ($event.target as HTMLInputElement).value" />
          </label>
        </div>
        <small class="muted">Rule: value &lt; low → low color, low–high → mid, value &gt; high → high color.</small>
      </div>

      <div class="form-field">
        <label class="checkbox">
          <input type="checkbox" :checked="separatingLines" @change="separatingLines = ($event.target as HTMLInputElement).checked" />
          <span>Separating lines</span>
        </label>
      </div>

      <div class="form-field">
        <label class="checkbox">
          <input type="checkbox" :checked="barBackground" @change="barBackground = ($event.target as HTMLInputElement).checked" />
          <span>Bar background</span>
        </label>
      </div>

      <div class="form-field">
        <label class="checkbox">
          <input type="checkbox" :checked="thickerBars" @change="thickerBars = ($event.target as HTMLInputElement).checked" />
          <span>Thicker bars</span>
        </label>
      </div>

      <label class="form-field">
        <span>Animation duration (ms)</span>
        <input
          type="number"
          min="0"
          max="3000"
          step="50"
          :value="animationDuration"
          @input="animationDuration = Number(($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="form-field">
        <span>Stagger delay (ms)</span>
        <input
          type="number"
          min="0"
          max="300"
          step="10"
          :value="staggerDelay"
          @input="staggerDelay = Number(($event.target as HTMLInputElement).value)"
        />
      </label>

      <div class="form-field">
        <label class="checkbox">
          <input
            type="checkbox"
            :checked="showGridlines"
            @change="showGridlines = ($event.target as HTMLInputElement).checked"
          />
          <span>Show gridlines</span>
        </label>
      </div>

      <div class="form-field">
        <label class="checkbox">
          <input
            type="checkbox"
            :checked="showValues"
            @change="showValues = ($event.target as HTMLInputElement).checked"
          />
          <span>Show values</span>
        </label>
      </div>

      <div class="form-field">
        <label class="checkbox">
          <input type="checkbox" :checked="sortBars" @change="sortBars = ($event.target as HTMLInputElement).checked" />
          <span>Sort bars</span>
        </label>
        <label class="checkbox" style="margin-top:6px">
          <input type="checkbox" :checked="reverseOrder" @change="reverseOrder = ($event.target as HTMLInputElement).checked" />
          <span>Reverse order</span>
        </label>
        <label class="checkbox" style="margin-top:6px">
          <input type="checkbox" :checked="groupBarsByColumn" @change="groupBarsByColumn = ($event.target as HTMLInputElement).checked" />
          <span>Group bars by column</span>
        </label>
      </div>

      <div class="form-field">
        <span>Value alignment</span>
        <div class="pill-group">
          <button type="button" class="pill" :class="{ 'pill--active': valueAlignment === 'left' }" @click="valueAlignment = 'left'">Left</button>
          <button type="button" class="pill" :class="{ 'pill--active': valueAlignment === 'right' }" @click="valueAlignment = 'right'">Right</button>
        </div>
      </div>

      <label class="form-field">
        <span>Number format</span>
        <select :value="numberFormat" @change="numberFormat = ($event.target as HTMLSelectElement).value">
          <option value=",.0f">1,000</option>
          <option value=",.2f">1,000.00</option>
          <option value=",.2~f">1,000[.00]</option>
        </select>
      </label>

      <label class="form-field">
        <span>X label offset (px)</span>
        <input
          type="range"
          min="-10"
          max="10"
          step="1"
          :value="xLabelOffset"
          @input="xLabelOffset = Number(($event.target as HTMLInputElement).value)"
        />
        <small class="muted">{{ xLabelOffset }} px</small>
      </label>

      <label class="form-field">
        <span>X label rotation (deg)</span>
        <input
          type="range"
          min="-90"
          max="90"
          step="5"
          :value="xLabelRotation"
          @input="xLabelRotation = Number(($event.target as HTMLInputElement).value)"
        />
        <small class="muted">{{ xLabelRotation }} deg</small>
      </label>

      <label class="form-field">
        <span>Y label offset (px)</span>
        <input
          type="range"
          min="-10"
          max="10"
          step="1"
          :value="yLabelOffset"
          @input="yLabelOffset = Number(($event.target as HTMLInputElement).value)"
        />
        <small class="muted">{{ yLabelOffset }} px</small>
      </label>

      <div class="form-field">
        <span>Labels alignment</span>
        <div class="pill-group">
          <button type="button" class="pill" :class="{ 'pill--active': labelAlignment === 'left' }" @click="labelAlignment = 'left'">Left</button>
          <button type="button" class="pill" :class="{ 'pill--active': labelAlignment === 'right' }" @click="labelAlignment = 'right'">Right</button>
        </div>
      </div>

      <div class="form-field">
        <label class="checkbox">
          <input type="checkbox" :checked="separateLabelLine" @change="separateLabelLine = ($event.target as HTMLInputElement).checked" />
          <span>Move labels to separate line</span>
        </label>
      </div>

      <div class="form-field">
        <label class="checkbox">
          <input type="checkbox" :checked="swapLabelsAndValues" @change="swapLabelsAndValues = ($event.target as HTMLInputElement).checked" />
          <span>Swap labels and values</span>
        </label>
      </div>

      <div class="form-field">
        <label class="checkbox">
          <input type="checkbox" :checked="replaceCodesWithFlags" @change="replaceCodesWithFlags = ($event.target as HTMLInputElement).checked" />
          <span>Replace country codes with flags</span>
        </label>
      </div>

      <div class="form-field form-field--wide">
        <span>Horizontal axis range</span>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="number" :value="valueMin ?? ''" placeholder="min" @input="valueMin = ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined" />
          <span>–</span>
          <input type="number" :value="valueMax ?? ''" placeholder="max" @input="valueMax = ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined" />
        </div>
      </div>
    </div>

    <section class="panel" style="margin-top: 12px;">
      <header class="panel__header">
        <div>
          <p class="eyebrow">Overlays</p>
          <h4 class="panel__title">Add value or range overlays</h4>
        </div>
        <button class="pill" type="button" @click="addOverlay">Add overlay</button>
      </header>

      <div v-if="props.config.overlays.length" class="overlay-list" style="display: flex; flex-direction: column; gap: 10px;">
        <article v-for="ov in props.config.overlays" :key="ov.id" class="panel" style="padding:12px; border:1px solid #e2e8f0;">
          <header class="panel__header" style="padding:0; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="text" :value="ov.name" @input="updateOverlay(ov.id, { name: ($event.target as HTMLInputElement).value })" />
              <label class="checkbox">
                <input type="checkbox" :checked="ov.visible" @change="updateOverlay(ov.id, { visible: ($event.target as HTMLInputElement).checked })" />
                <span>Visible</span>
              </label>
            </div>
            <button class="pill" type="button" @click="deleteOverlay(ov.id)">Delete</button>
          </header>

          <div class="form-grid">
            <div class="form-field">
              <span>Type</span>
              <div class="pill-group">
                <button type="button" class="pill" :class="{ 'pill--active': ov.type === 'value' }" @click="updateOverlay(ov.id, { type: 'value' })">Value</button>
                <button type="button" class="pill" :class="{ 'pill--active': ov.type === 'range' }" @click="updateOverlay(ov.id, { type: 'range' })">Range</button>
              </div>
            </div>

            <label class="form-field">
              <span>{{ ov.type === 'range' ? 'Column (max)' : 'Column' }}</span>
              <select v-if="fields.length" :value="ov.column" @change="updateOverlay(ov.id, { column: ($event.target as HTMLSelectElement).value })">
                <option v-for="f in fields" :key="f" :value="f">{{ f }}</option>
              </select>
              <input v-else type="text" :value="ov.column" @input="updateOverlay(ov.id, { column: ($event.target as HTMLInputElement).value })" />
            </label>

            <label class="form-field" v-if="ov.type === 'range'">
              <span>Column (min)</span>
              <select v-if="fields.length" :value="ov.rangeMinColumn" @change="updateOverlay(ov.id, { rangeMinColumn: ($event.target as HTMLSelectElement).value })">
                <option v-for="f in fields" :key="f" :value="f">{{ f }}</option>
              </select>
              <input v-else type="text" :value="ov.rangeMinColumn" @input="updateOverlay(ov.id, { rangeMinColumn: ($event.target as HTMLInputElement).value })" />
            </label>

            <div class="form-field">
              <span>Label</span>
              <div class="pill-group">
                <button type="button" class="pill" :class="{ 'pill--active': ov.labelMode === 'first' }" @click="updateOverlay(ov.id, { labelMode: 'first' })">On first bar</button>
                <button type="button" class="pill" :class="{ 'pill--active': ov.labelMode === 'legend' }" @click="updateOverlay(ov.id, { labelMode: 'legend' })">In legend</button>
                <button type="button" class="pill" :class="{ 'pill--active': ov.labelMode === 'hidden' }" @click="updateOverlay(ov.id, { labelMode: 'hidden' })">Hidden</button>
              </div>
              <input type="text" placeholder="Label" :value="ov.labelText ?? ''" @input="updateOverlay(ov.id, { labelText: ($event.target as HTMLInputElement).value })" style="margin-top:6px" />
            </div>

            <label class="form-field">
              <span>Color</span>
              <input type="color" :value="ov.color" @input="updateOverlay(ov.id, { color: ($event.target as HTMLInputElement).value })" />
            </label>

            <label class="form-field">
              <span>Opacity (0-100%)</span>
              <div style="display:flex; gap:8px; align-items:center;">
                <input type="range" min="0" max="1" step="0.01" :value="ov.opacity" @input="updateOverlay(ov.id, { opacity: Number(($event.target as HTMLInputElement).value) })" />
                <input type="number" min="0" max="100" step="5" :value="Math.round(ov.opacity * 100)" @input="updateOverlay(ov.id, { opacity: Number(($event.target as HTMLInputElement).value) / 100 })" style="width:80px" />
              </div>
            </label>
          </div>
        </article>
      </div>
      <p class="muted" v-else>No overlays yet.</p>
    </section>
  </section>
</template>
