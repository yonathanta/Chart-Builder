<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div class="title-block">
    <input 
      type="text" 
      :value="modelValue" 
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      class="header-input"
      placeholder="Section Title"
    />
  </div>
</template>

<style scoped>
.header-input {
  font-size: 1.5rem;
  font-weight: 700;
  width: 100%;
  border: none;
  background: transparent;
  color: #1e293b;
  border-bottom: 2px solid transparent;
  padding: 8px 0;
  transition: border-color 0.2s;
}

.header-input:focus {
  outline: none;
  border-bottom-color: #2563eb;
}
</style>
