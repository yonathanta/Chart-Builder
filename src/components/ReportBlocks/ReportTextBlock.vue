<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div class="text-block">
    <textarea 
      :value="modelValue" 
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      class="text-input" 
      rows="4"
      placeholder="Enter text content..."
    ></textarea>
  </div>
</template>

<style scoped>
.text-input {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.6;
  resize: vertical;
  color: #334155;
  transition: border-color 0.2s;
}

.text-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
</style>
