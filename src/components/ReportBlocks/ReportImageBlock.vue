<script setup lang="ts">
const props = defineProps<{
  modelValue: string // Base64 or object URL
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    emit('update:modelValue', e.target?.result as string)
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="report-image-block">
    <div v-if="!modelValue" class="image-placeholder">
      <input type="file" accept="image/*" @change="handleFileChange" id="image-upload" hidden />
      <label for="image-upload" class="upload-label">
        <span class="icon">🖼️</span>
        <span>Click to upload image</span>
      </label>
    </div>
    <div v-else class="image-preview">
      <img :src="modelValue" alt="Report image" />
      <label for="image-upload-edit" class="edit-overlay">
        <span>Change Image</span>
      </label>
      <input type="file" accept="image/*" @change="handleFileChange" id="image-upload-edit" hidden />
    </div>
  </div>
</template>

<style scoped>
.report-image-block {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #f8fafc;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-placeholder {
  padding: 40px;
  text-align: center;
}

.upload-label {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #64748b;
  transition: color 0.2s;
}

.upload-label:hover {
  color: #2563eb;
}

.icon {
  font-size: 2rem;
}

.image-preview {
  position: relative;
  width: 100%;
  line-height: 0;
}

.image-preview img {
  width: 100%;
  height: auto;
  border-radius: 8px;
}

.edit-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 12px;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  line-height: normal;
}

.image-preview:hover .edit-overlay {
  opacity: 1;
}
</style>
