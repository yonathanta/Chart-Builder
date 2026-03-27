<script setup lang="ts">
import type { ChartType } from "../specs/chartSpec";
import type { ChartRecommendation } from "../utils/chartRecommendations";

const props = defineProps<{
  suggestions: ChartRecommendation[];
  selectedType: ChartType | null;
  appliedRecommendationId?: string | null;
}>();

const emit = defineEmits<{
  (e: "apply", recommendation: ChartRecommendation): void;
}>();

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}% match`;
}

function buildLinePoints(values: number[]): string {
  if (!values.length) {
    return "";
  }

  return values
    .map((value, index) => {
      const x = 12 + (index * 72) / Math.max(1, values.length - 1);
      const y = 48 - value * 28;
      return `${x},${y}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[]): string {
  if (!values.length) {
    return "";
  }

  const line = buildLinePoints(values).split(" ");
  return `M 12 48 L ${line.join(" L ")} L 84 48 Z`;
}

function isApplied(recommendation: ChartRecommendation): boolean {
  return props.appliedRecommendationId === recommendation.id;
}
</script>

<template>
  <section v-if="suggestions.length > 0" class="recommendations">
    <div class="recommendations__header">
      <div>
        <h3>Recommended Charts</h3>
        <p>Detected from your dataset structure and sample values.</p>
      </div>
      <span class="recommendations__hint">Manual override is still available below.</span>
    </div>

    <div class="recommendations__grid">
      <button
        v-for="recommendation in suggestions"
        :key="recommendation.id"
        type="button"
        class="recommendation-card"
        :class="{
          'recommendation-card--applied': isApplied(recommendation),
          'recommendation-card--selected': selectedType === recommendation.type,
        }"
        @click="emit('apply', recommendation)"
      >
        <div class="recommendation-card__preview">
          <svg viewBox="0 0 96 60" aria-hidden="true">
            <g v-if="recommendation.preview.kind === 'line'">
              <polyline :points="buildLinePoints(recommendation.preview.values)" fill="none" stroke="#0f766e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
              <circle v-for="(value, index) in recommendation.preview.values" :key="index" :cx="12 + (index * 72) / Math.max(1, recommendation.preview.values.length - 1)" :cy="48 - value * 28" r="2.6" fill="#0f766e" />
            </g>
            <g v-else-if="recommendation.preview.kind === 'area'">
              <path :d="buildAreaPath(recommendation.preview.values)" fill="rgba(20, 184, 166, 0.22)" />
              <polyline :points="buildLinePoints(recommendation.preview.values)" fill="none" stroke="#14b8a6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            </g>
            <g v-else-if="recommendation.preview.kind === 'bar'">
              <rect v-for="(value, index) in recommendation.preview.values" :key="index" :x="10 + index * 12" :y="50 - value * 30" width="8" :height="Math.max(4, value * 30)" rx="2" fill="#2563eb" />
            </g>
            <g v-else-if="recommendation.preview.kind === 'groupedBar'">
              <template v-for="(group, groupIndex) in recommendation.preview.groups" :key="groupIndex">
                <rect v-for="(value, valueIndex) in group" :key="`${groupIndex}-${valueIndex}`" :x="10 + groupIndex * 18 + valueIndex * 5" :y="50 - value * 26" width="4" :height="Math.max(4, value * 26)" rx="1.5" :fill="['#2563eb', '#0ea5e9', '#22c55e'][valueIndex % 3]" />
              </template>
            </g>
            <g v-else-if="recommendation.preview.kind === 'pie'">
              <circle cx="48" cy="30" r="18" fill="#e2e8f0" />
              <circle cx="48" cy="30" r="18" fill="transparent" stroke="#0ea5e9" stroke-width="12" :stroke-dasharray="`${(recommendation.preview.segments[0] ?? 0.4) * 113} 113`" transform="rotate(-90 48 30)" />
              <circle cx="48" cy="30" r="18" fill="transparent" stroke="#f59e0b" stroke-width="12" :stroke-dasharray="`${(recommendation.preview.segments[1] ?? 0.25) * 113} 113`" :stroke-dashoffset="-1 * ((recommendation.preview.segments[0] ?? 0.4) * 113)" transform="rotate(-90 48 30)" />
            </g>
            <g v-else-if="recommendation.preview.kind === 'scatter'">
              <circle v-for="(point, index) in recommendation.preview.points" :key="index" :cx="10 + point.x * 76" :cy="50 - point.y * 34" :r="2 + (point.r ?? 0.4) * 3" fill="#0f766e" fill-opacity="0.75" />
            </g>
          </svg>
        </div>

        <div class="recommendation-card__body">
          <div class="recommendation-card__row">
            <strong>{{ recommendation.title }}</strong>
            <span class="recommendation-card__confidence">{{ formatConfidence(recommendation.confidence) }}</span>
          </div>
          <p>{{ recommendation.reason }}</p>
          <span v-if="isApplied(recommendation)" class="recommendation-card__badge">Applied</span>
        </div>
      </button>
    </div>
  </section>
</template>

<style scoped>
.recommendations {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%);
}

.recommendations__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.recommendations__header h3 {
  margin: 0;
  font-size: 15px;
}

.recommendations__header p {
  margin: 4px 0 0;
  color: #475569;
  font-size: 12px;
}

.recommendations__hint {
  font-size: 11px;
  color: #0f766e;
  white-space: nowrap;
}

.recommendations__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
}

.recommendation-card {
  display: grid;
  gap: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  background: #ffffff;
  padding: 10px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.recommendation-card:hover {
  border-color: #38bdf8;
  box-shadow: 0 10px 18px rgba(14, 116, 144, 0.08);
  transform: translateY(-1px);
}

.recommendation-card--selected,
.recommendation-card--applied {
  border-color: #0ea5e9;
  box-shadow: 0 0 0 1px #0ea5e9 inset;
}

.recommendation-card__preview {
  border-radius: 10px;
  background: linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%);
  border: 1px solid #e2e8f0;
  padding: 6px;
}

.recommendation-card__preview svg {
  width: 100%;
  height: 60px;
  display: block;
}

.recommendation-card__body strong {
  font-size: 13px;
  color: #0f172a;
}

.recommendation-card__body p {
  margin: 6px 0 0;
  font-size: 12px;
  color: #475569;
  line-height: 1.4;
}

.recommendation-card__row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
}

.recommendation-card__confidence {
  font-size: 11px;
  color: #0369a1;
}

.recommendation-card__badge {
  display: inline-flex;
  margin-top: 8px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #e0f2fe;
  color: #075985;
  font-size: 11px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .recommendations__header {
    flex-direction: column;
  }

  .recommendations__hint {
    white-space: normal;
  }
}
</style>