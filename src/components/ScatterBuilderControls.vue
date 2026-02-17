<script setup lang="ts">
import { computed } from "vue";

export interface ScatterBuilderConfig {
    animationDuration?: number;
    pointRadius?: number;
    showGridlines?: boolean;
    showLegend?: boolean;
    showTooltip?: boolean;
}

const props = defineProps<{
    config: ScatterBuilderConfig;
    fields: string[];
}>();

const emit = defineEmits<{
    (e: "update:config", payload: ScatterBuilderConfig): void;
}>();

function updateField(key: keyof ScatterBuilderConfig, value: any) {
    emit("update:config", { ...props.config, [key]: value });
}
</script>

<template>
    <div class="builder-controls">
        <div class="control-group">
            <label>Point Radius</label>
            <input 
                type="range" 
                min="1" 
                max="20" 
                :value="config.pointRadius || 5" 
                @input="e => updateField('pointRadius', parseInt((e.target as HTMLInputElement).value))"
            />
            <span class="value">{{ config.pointRadius || 5 }}px</span>
        </div>

        <div class="control-group">
            <label>Animation Duration</label>
            <input 
                type="range" 
                min="0" 
                max="3000" 
                step="100"
                :value="config.animationDuration || 1000" 
                @input="e => updateField('animationDuration', parseInt((e.target as HTMLInputElement).value))"
            />
            <span class="value">{{ config.animationDuration || 1000 }}ms</span>
        </div>

        <div class="control-group checkbox">
            <label>
                <input 
                    type="checkbox" 
                    :checked="config.showGridlines !== false" 
                    @change="e => updateField('showGridlines', (e.target as HTMLInputElement).checked)"
                />
                Show Gridlines
            </label>
        </div>

        <div class="control-group checkbox">
            <label>
                <input 
                    type="checkbox" 
                    :checked="config.showLegend !== false" 
                    @change="e => updateField('showLegend', (e.target as HTMLInputElement).checked)"
                />
                Show Legend
            </label>
        </div>

        <div class="control-group checkbox">
            <label>
                <input 
                    type="checkbox" 
                    :checked="config.showTooltip !== false" 
                    @change="e => updateField('showTooltip', (e.target as HTMLInputElement).checked)"
                />
                Show Tooltips
            </label>
        </div>
    </div>
</template>

<style scoped>
.builder-controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 8px;
}

.control-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.control-group.checkbox {
    flex-direction: row;
    align-items: center;
}

label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #475569;
}

input[type="range"] {
    width: 100%;
}

.value {
    font-size: 0.75rem;
    color: #64748b;
    text-align: right;
}

input[type="checkbox"] {
    margin-right: 0.5rem;
}
</style>
