<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ config: Record<string, any> }>();

const emit = defineEmits<{ (e: 'update:config', value: Record<string, any>): void }>();

const local = computed({
	get: () => props.config,
	set: (v) => emit('update:config', v)
});

const curveOptions = [
	{ label: 'Linear', value: 'linear' },
	{ label: 'Monotone', value: 'monotone' },
	{ label: 'Basis', value: 'basis' },
	{ label: 'Cardinal', value: 'cardinal' },
	{ label: 'Step', value: 'step' },
];

const xTypeOptions = [
	{ label: 'Time', value: 'time' },
	{ label: 'Linear', value: 'linear' },
	{ label: 'Category', value: 'category' },
];
</script>

<template>
	<div class="form-grid">
		<div class="form-field">
			<label>Area color</label>
			<input type="color" v-model="local.areaColor" />
		</div>
		<div class="form-field">
			<label>Area opacity</label>
			<input type="number" min="0" max="1" step="0.01" v-model.number="local.areaOpacity" />
		</div>
		<div class="form-field">
			<label>Stroke color</label>
			<input type="color" v-model="local.strokeColor" />
		</div>
		<div class="form-field">
			<label>Stroke width</label>
			<input type="number" min="0" step="0.5" v-model.number="local.strokeWidth" />
		</div>
		<div class="form-field">
			<label>Curve</label>
			<select v-model="local.curveType">
				<option v-for="o in curveOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
			</select>
		</div>

		<div class="form-field">
			<label>X scale type</label>
			<select v-model="local.xType">
				<option v-for="o in xTypeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
			</select>
		</div>
		<div class="form-field">
			<label>X parse format (time)</label>
			<input type="text" placeholder="%Y-%m-%d" v-model="local.xParseFormat" />
		</div>

		<div class="form-field">
			<label>Show X Axis</label>
			<select v-model="local.showXAxis">
				<option :value="true">Yes</option>
				<option :value="false">No</option>
			</select>
		</div>
		<div class="form-field">
			<label>Show Y Axis</label>
			<select v-model="local.showYAxis">
				<option :value="true">Yes</option>
				<option :value="false">No</option>
			</select>
		</div>

		<div class="form-field">
			<label>X ticks</label>
			<input type="number" min="0" step="1" v-model.number="local.xTicks" />
		</div>
		<div class="form-field">
			<label>Y ticks</label>
			<input type="number" min="0" step="1" v-model.number="local.yTicks" />
		</div>

		<div class="form-field">
			<label>Show grid</label>
			<select v-model="local.showGrid">
				<option :value="true">Yes</option>
				<option :value="false">No</option>
			</select>
		</div>

		<div class="form-field">
			<label>Tooltip</label>
			<select v-model="local.tooltip">
				<option :value="true">Yes</option>
				<option :value="false">No</option>
			</select>
		</div>

		<div class="form-field">
			<label>Show points</label>
			<select v-model="local.showPoints">
				<option :value="true">Yes</option>
				<option :value="false">No</option>
			</select>
		</div>
		<div class="form-field">
			<label>Point radius</label>
			<input type="number" min="1" step="1" v-model.number="local.pointRadius" />
		</div>
		<div class="form-field">
			<label>Point color</label>
			<input type="color" v-model="local.pointColor" />
		</div>
		<div class="form-field">
			<label>Point stroke</label>
			<input type="color" v-model="local.pointStroke" />
		</div>

		<div class="form-field">
			<label>Hover line</label>
			<select v-model="local.hoverLine">
				<option :value="true">Yes</option>
				<option :value="false">No</option>
			</select>
		</div>
		<div class="form-field">
			<label>Hover color</label>
			<input type="color" v-model="local.hoverColor" />
		</div>
		<div class="form-field">
			<label>Focus circle</label>
			<select v-model="local.focusCircle">
				<option :value="true">Yes</option>
				<option :value="false">No</option>
			</select>
		</div>

		<div class="form-field">
			<label>Animate</label>
			<select v-model="local.animate">
				<option :value="true">Yes</option>
				<option :value="false">No</option>
			</select>
		</div>
		<div class="form-field">
			<label>Duration (ms)</label>
			<input type="number" min="0" step="50" v-model.number="local.duration" />
		</div>
	</div>
</template>
