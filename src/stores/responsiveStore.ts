import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type DeviceType = 'mobile' | 'tablet' | 'desktop'

const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024

function resolveDeviceType(width: number): DeviceType {
  if (width < MOBILE_BREAKPOINT) {
    return 'mobile'
  }

  if (width <= TABLET_BREAKPOINT) {
    return 'tablet'
  }

  return 'desktop'
}

export const useResponsiveStore = defineStore('responsive', () => {
  const screenWidth = ref(0)
  const screenHeight = ref(0)
  const deviceType = ref<DeviceType>('desktop')

  let rafId = 0
  let initialized = false
  let lastWidth = -1
  let lastHeight = -1

  function updateViewport(): void {
    if (typeof window === 'undefined') {
      return
    }

    const width = Math.max(0, Math.round(window.innerWidth || 0))
    const height = Math.max(0, Math.round(window.innerHeight || 0))

    if (width === lastWidth && height === lastHeight) {
      return
    }

    lastWidth = width
    lastHeight = height
    screenWidth.value = width
    screenHeight.value = height
    deviceType.value = resolveDeviceType(width)
  }

  function scheduleUpdate(): void {
    if (rafId) {
      return
    }

    rafId = window.requestAnimationFrame(() => {
      rafId = 0
      updateViewport()
    })
  }

  function initialize(): void {
    if (typeof window === 'undefined' || initialized) {
      return
    }

    initialized = true
    updateViewport()
    window.addEventListener('resize', scheduleUpdate, { passive: true })
    window.addEventListener('orientationchange', scheduleUpdate, { passive: true })
  }

  function teardown(): void {
    if (typeof window === 'undefined' || !initialized) {
      return
    }

    initialized = false
    window.removeEventListener('resize', scheduleUpdate)
    window.removeEventListener('orientationchange', scheduleUpdate)
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  const isMobile = computed(() => deviceType.value === 'mobile')
  const isTablet = computed(() => deviceType.value === 'tablet')
  const isDesktop = computed(() => deviceType.value === 'desktop')

  return {
    screenWidth,
    screenHeight,
    deviceType,
    isMobile,
    isTablet,
    isDesktop,
    initialize,
    teardown,
  }
})
