<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  id: string
  width: number
  height: number
  isResizable?: boolean
}>()

const emit = defineEmits<{
  (e: 'update-layout', payload: { id: string; width: number; height: number }): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const isResizing = ref(false)
const currentWidth = ref(props.width || 400)
const currentHeight = ref(props.height || 300)

let startX = 0
let startY = 0
let startWidth = 0
let startHeight = 0

function startResize(e: MouseEvent) {
  if (!props.isResizable) return
  isResizing.value = true
  startX = e.clientX
  startY = e.clientY
  startWidth = currentWidth.value
  startHeight = currentHeight.value

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  e.preventDefault()
}

function handleMouseMove(e: MouseEvent) {
  if (!isResizing.value) return
  
  const deltaX = e.clientX - startX
  const deltaY = e.clientY - startY
  
  currentWidth.value = Math.max(200, startWidth + deltaX)
  currentHeight.value = Math.max(150, startHeight + deltaY)
}

function handleMouseUp() {
  if (isResizing.value) {
    isResizing.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    
    emit('update-layout', {
      id: props.id,
      width: currentWidth.value,
      height: currentHeight.value
    })
  }
}
</script>

<template>
  <div 
    ref="containerRef"
    class="chart-container" 
    :style="{ width: currentWidth + 'px', height: currentHeight + 'px' }"
  >
    <div class="chart-content">
      <slot></slot>
    </div>
    <div 
      v-if="isResizable"
      class="resize-handle" 
      @mousedown="startResize"
      title="Drag to resize"
    ></div>
  </div>
</template>

<style scoped>
.chart-container {
  position: relative;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s;
  overflow: hidden;
}

.chart-container:hover {
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
}

.chart-content {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 12px;
}

.resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, #cbd5e1 50%);
  border-bottom-right-radius: 8px;
  z-index: 10;
}

.resize-handle:hover {
  background: linear-gradient(135deg, transparent 50%, #94a3b8 50%);
}
</style>
