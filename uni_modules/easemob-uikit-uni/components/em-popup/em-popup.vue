<template>
  <view
    v-if="rendered"
    :class="[ns.b(), themeClass, position === 'center' ? 'em-popup--center' : '']"
    :style="`z-index: ${zIndex};`"
  >
    <view :class="[ns.e('overlay'), shown ? 'em-popup__overlay--show' : '']" @click="onMaskClick"></view>
    <view
      :class="[ns.e('panel'), position === 'center' ? 'em-popup__panel--center' : '', shown ? 'em-popup__panel--show' : '']"
      :style="panelStyle"
    >
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { getSafeAreaBottom, holdTabBar, nextZIndex, releaseTabBar } from '../../libs/use/usePopup'
import { useNamespace } from '../../libs/use/useNamespace'
import { useTheme } from '../../libs/use/useTheme'

interface Props {
  visible: boolean
  position?: 'bottom' | 'center'
  maskClosable?: boolean
  safeArea?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  position: 'bottom',
  maskClosable: true,
  safeArea: true
})

defineOptions({ styleIsolation: 'app-and-page' })

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'mask-click'): void
}>()

const ns = useNamespace('popup')
const { themeClass } = useTheme()

const rendered = ref(props.visible)
const shown = ref(false)
const zIndex = ref(2000)

// 打开时先挂载隐藏态，下一帧再切 --show，让 transform/opacity transition 有起点；
// 若某端 transition 不生效，退化为无动画显隐，交互不受影响
watch(() => props.visible, (v) => {
  if (v) {
    zIndex.value = nextZIndex()
    holdTabBar()
    rendered.value = true
    nextTick(() => {
      setTimeout(() => {
        shown.value = true
      }, 30)
    })
  } else {
    shown.value = false
    releaseTabBar()
    setTimeout(() => {
      rendered.value = false
    }, 260)
  }
}, { immediate: true })

onUnmounted(() => {
  if (props.visible) {
    releaseTabBar()
  }
})

const panelStyle = computed(() => {
  if (props.position === 'bottom' && props.safeArea) {
    const bottom = getSafeAreaBottom()
    if (bottom > 0) {
      return `padding-bottom: ${bottom}px;`
    }
  }
  return ''
})

function onMaskClick(): void {
  emit('mask-click')
  if (props.maskClosable) {
    emit('update:visible', false)
  }
}
</script>

<style>
@import '../../libs/style/variables.css';

.em-popup {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.em-popup--center {
  justify-content: center;
  align-items: center;
}

.em-popup__overlay {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.25s ease;
}

.em-popup__overlay--show {
  opacity: 1;
}

.em-popup__panel {
  position: relative;
  width: 100%;
  background-color: var(--em-bg-elevated);
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  transform: translateY(100%);
  transition: transform 0.25s ease;
}

.em-popup__panel--center {
  width: auto;
  border-radius: 12px;
  transform: none;
}

.em-popup__panel--show {
  transform: translateY(0);
}
</style>
