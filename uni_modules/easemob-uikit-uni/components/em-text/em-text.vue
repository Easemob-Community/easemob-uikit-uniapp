<template>
  <view :class="ns.b()">
    <text :class="[ns.e('value'), clampClass, textClass]">{{ text }}<slot /></text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../libs/use/useNamespace'

// 文本溢出/折叠/断词收口组件：所有可能溢出的用户内容文本一律走这里。
// 布局 class（flex/min-width/margin 等）落在组件标签上（宿主 = 根 view）；
// 字号/颜色/字重等文字样式经 textClass 透传到内部 <text>（ucss 无继承，放组件标签上不生效）。
interface Props {
  text?: string
  lines?: number      // 默认 1 行折叠省略；0 = 不折叠、只做长文断词
  textClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  text: '',
  lines: 1,
  textClass: ''
})

defineOptions({ styleIsolation: 'app-and-page' })

const ns = useNamespace('text')

// 折叠行数走 class（lines 属性经 wxss 管线已验证可落产物）；目前只用 1/2 两档
const clampClass = computed(() => {
  if (props.lines <= 0) return 'em-text__value--wrap'
  if (props.lines === 2) return 'em-text__value--line2'
  return 'em-text__value--line1'
})
</script>

<style>
@import '../../libs/style/variables.css';

/* 宿主节点：小程序里组件宿主参与父级 flex 布局，max-width/overflow 收在这一层 */
.em-text {
  max-width: 100%;
  overflow: hidden;
}

.em-text__value {
  word-break: break-all;
}

.em-text__value--wrap {
  overflow: hidden;
}

.em-text__value--line1 {
  lines: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.em-text__value--line2 {
  lines: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
