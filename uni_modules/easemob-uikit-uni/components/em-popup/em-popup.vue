<template>
  <view
    v-if="rendered"
    :class="[ns.b(), themeClass, position === 'center' ? 'em-popup--center' : '', customClass]"
    :style="`z-index: ${zIndex};` + customStyle"
  >
    <view :class="[ns.e('overlay'), shown ? 'em-popup__overlay--show' : '']" @click="onMaskClick"></view>
    <view
      :class="[ns.e('panel'), position === 'center' ? 'em-popup__panel--center' : '', fullscreen ? 'em-popup__panel--full' : '', shown ? 'em-popup__panel--show' : '']"
      :style="panelStyle"
    >
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { holdTabBar, nextZIndex, releaseTabBar } from '../../libs/use/usePopup'
import { getSafeAreaBottom } from '../../libs/use/useSafeArea'
import { useNamespace } from '../../libs/use/useNamespace'
import { useTheme } from '../../libs/use/useTheme'

interface Props {
  visible: boolean
  position?: 'bottom' | 'center'
  maskClosable?: boolean
  safeArea?: boolean
  /** 全屏形态（bottom 专用）：面板去顶部圆角，由内容方配 100% 高（对齐 vue mobileFullscreen） */
  fullscreen?: boolean
  customClass?: string   // 宿主自定义类，追加到根节点 class（H5 与小程序页面级样式生效；跨端覆盖优先 customStyle）
  customStyle?: string   // 宿主自定义内联样式，拼接到根节点 style 末尾（五端生效，var() 可用）
}

const props = withDefaults(defineProps<Props>(), {
  position: 'bottom',
  maskClosable: true,
  safeArea: true,
  fullscreen: false,
  customClass: '',
  customStyle: ''
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
let hideTimer: ReturnType<typeof setTimeout> | null = null
watch(() => props.visible, (v) => {
  if (v) {
    // 260ms 内快速重开：取消挂起的卸载，否则 stale 定时器会把已打开的弹层摘掉
    if (hideTimer != null) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
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
    hideTimer = setTimeout(() => {
      hideTimer = null
      if (!props.visible) {
        rendered.value = false
      }
    }, 260)
  }
}, { immediate: true })

onUnmounted(() => {
  if (props.visible) {
    releaseTabBar()
  }
})

const panelStyle = computed(() => {
  if (props.position !== 'bottom') return ''
  let style = ''
  if (props.safeArea) {
    const bottom = getSafeAreaBottom()
    if (bottom > 0) {
      style += `padding-bottom: ${bottom}px;`
    }
  }
  return style
})

function onMaskClick(): void {
  emit('mask-click')
  if (props.maskClosable) {
    emit('update:visible', false)
  }
}
</script>

<style>
@import './em-popup.css';
</style>
