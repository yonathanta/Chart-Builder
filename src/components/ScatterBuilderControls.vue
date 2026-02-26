<script setup lang="ts">

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
    <div class="form-grid">
        <div class="form-field">
            <span>Point Radius</span>
            <input 
                type="range" 
                min="1" 
                max="20" 
                :value="config.pointRadius || 5" 
                @input="e => updateField('pointRadius', parseInt((e.target as HTMLInputElement).value))"
            />
            <small class="muted">{{ config.pointRadius || 5 }}px</small>
        </div>

        <div class="form-field">
            <span>Animation Duration</span>
            <input 
                type="range" 
                min="0" 
                max="3000" 
                step="100"
                :value="config.animationDuration || 1000" 
                @input="e => updateField('animationDuration', parseInt((e.target as HTMLInputElement).value))"
            />
            <small class="muted">{{ config.animationDuration || 1000 }}ms</small>
        </div>

        <div class="form-field">
            <label class="checkbox">
                <input 
                    type="checkbox" 
                    :checked="config.showGridlines !== false" 
                    @change="e => updateField('showGridlines', (e.target as HTMLInputElement).checked)"
                />
                <span>Show Gridlines</span>
            </label>
        </div>

        <div class="form-field">
            <label class="checkbox">
                <input 
                    type="checkbox" 
                    :checked="config.showLegend !== false" 
                    @change="e => updateField('showLegend', (e.target as HTMLInputElement).checked)"
                />
                <span>Show Legend</span>
            </label>
        </div>

        <div class="form-field">
            <label class="checkbox">
                <input 
                    type="checkbox" 
                    :checked="config.showTooltip !== false" 
                    @change="e => updateField('showTooltip', (e.target as HTMLInputElement).checked)"
                />
                <span>Show Tooltips</span>
            </label>
        </div>
    </div>
</template>

<style scoped>
/* No component-specific styles needed, using global form-grid/form-field */
</style>
