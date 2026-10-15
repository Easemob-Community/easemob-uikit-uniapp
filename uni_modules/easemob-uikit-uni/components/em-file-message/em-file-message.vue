<template>
  <view :class="[ns.b(), 'em-bubble', message.self ? 'em-bubble--self' : '']" @click="onClick" @longpress="onLongpress">
    <view :class="[ns.e('icon'), iconTypeClass]">
      <EmIcon :name="iconName" :size="20" :class="ns.e('icon-glyph')" />
    </view>
    <view :class="ns.e('info')">
      <em-text :text="fileName" :text-class="nameClass" :text-style="nameStyle" />
      <text v-if="sizeText !== ''" :class="[ns.e('size'), message.self ? 'em-file-message__size--self' : '']">{{ sizeText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import EmIcon from '../em-icon/em-icon.vue'
import EmText from '../em-text/em-text.vue'
import type { EmIconName } from '../em-icon/em-icons'
import type { EmMessageItem } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'
import { useLocale } from '../../libs/use/useLocale'

interface Props {
  message: EmMessageItem
}

const props = defineProps<Props>()

defineOptions({ styleIsolation: 'app-and-page', virtualHost: true })

const emit = defineEmits<{
  (e: 'download', message: EmMessageItem): void
  (e: 'long-press', message: EmMessageItem): void
}>()

const ns = useNamespace('file-message')
const { t } = useLocale()

const fileName = computed(() => props.message.fileName !== '' ? props.message.fileName : t('message.file'))

// 文字样式经 textClass 透传（宿主只参与布局；info 列已有 flex:1 + overflow:hidden 约束链）
const nameClass = computed(() => props.message.self
  ? 'em-file-message__name em-file-message__name--self'
  : 'em-file-message__name')

// 内联兜底（小程序样式隔离下父组件 wxss 够不到 em-text 内部 text，见 em-text 注释）
const nameStyle = computed(() => props.message.self
  ? 'font-size: var(--em-font-size-15); font-weight: var(--em-font-weight-medium); color: var(--em-bubble-text-self);'
  : 'font-size: var(--em-font-size-15); font-weight: var(--em-font-weight-medium); color: var(--em-bubble-text-other);')

const sizeText = computed(() => {
  const size = props.message.fileSize
  if (size <= 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
})

// 扩展名归类：与 --em-file-icon-{key} token 一一对应（对齐 vue 版 FILE_TYPE_RULES，一期裁剪类目）
type FileTypeKey = 'pdf' | 'xls' | 'doc' | 'ppt' | 'md' | 'img' | 'video' | 'audio' | 'file'

const fileType = computed<FileTypeKey>(() => {
  const name = fileName.value.toLowerCase()
  if (/\.pdf$/.test(name)) return 'pdf'
  if (/\.(xls|xlsx|csv|et)$/.test(name)) return 'xls'
  if (/\.(doc|docx|txt|rtf|wps)$/.test(name)) return 'doc'
  if (/\.(ppt|pptx|dps)$/.test(name)) return 'ppt'
  if (/\.(md|markdown)$/.test(name)) return 'md'
  if (/\.(jpe?g|png|gif|webp|svg|bmp|ico|heic)$/.test(name)) return 'img'
  if (/\.(mp4|mov|avi|mkv|webm|flv|wmv)$/.test(name)) return 'video'
  if (/\.(mp3|wav|aac|flac|ogg|m4a|wma)$/.test(name)) return 'audio'
  return 'file'
})

// 底色走 class 修饰符（避开内联 var() 在蒸汽端的风险）；字形用 em-icons 现有映射里语义最近的
const iconTypeClass = computed(() => `em-file-message__icon--${fileType.value}`)

const iconName = computed<EmIconName>(() => {
  const type = fileType.value
  if (type === 'img') return 'image'
  if (type === 'video') return 'videocam'
  if (type === 'audio') return 'sound'
  return 'paperclip'
})

// 点击行为纯 emit 透传：默认下载/打开逻辑由宿主（em-chat-page 的 download 监听）实现；
// 一期下载不做，宿主默认 toast 提示
function onClick(): void {
  emit('download', props.message)
}

function onLongpress(): void {
  emit('long-press', props.message)
}
</script>

<style>
@import './em-file-message.css';
</style>
