<template>
  <view :class="[ns.b(), message.self ? 'em-file-message--self' : '']" @click="onClick" @longpress="onLongpress">
    <view :class="[ns.e('icon'), iconTypeClass]">
      <EmIcon :name="iconName" :size="20" :class="ns.e('icon-glyph')" />
    </view>
    <view :class="ns.e('info')">
      <text :class="[ns.e('name'), message.self ? 'em-file-message__name--self' : '']">{{ fileName }}</text>
      <text v-if="sizeText !== ''" :class="[ns.e('size'), message.self ? 'em-file-message__size--self' : '']">{{ sizeText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import EmIcon from '../em-icon/em-icon.vue'
import type { EmIconName } from '../em-icon/em-icons'
import type { EmMessageItem } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'
import { useLocale } from '../../libs/use/useLocale'

interface Props {
  message: EmMessageItem
}

const props = defineProps<Props>()

defineOptions({ styleIsolation: 'app-and-page' })

const emit = defineEmits<{
  (e: 'long-press', message: EmMessageItem): void
}>()

const ns = useNamespace('file-message')
const { t } = useLocale()

const fileName = computed(() => props.message.fileName !== '' ? props.message.fileName : t('message.file'))

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

// 文件下载/打开一期不做（需要分端落地），点击仅提示
function onClick(): void {
  uni.showToast({ title: t('error.unsupported'), icon: 'none' })
}

function onLongpress(): void {
  emit('long-press', props.message)
}
</script>

<style>
@import '../../libs/style/variables.css';

.em-file-message {
  display: flex;
  flex-direction: row;
  align-items: center;
  min-width: 166px;
  max-width: 240px;
  padding: 10px 12px;
  border-radius: var(--em-file-card-radius);
  background-color: var(--em-bubble-bg-other);
}

.em-file-message--self {
  background-color: var(--em-bubble-bg-self);
}

.em-file-message__icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--em-radius);
  background-color: var(--em-file-icon-file);
  margin-right: var(--em-spacing-3);
  flex-shrink: 0;
}

.em-file-message__icon--pdf {
  background-color: var(--em-file-icon-pdf);
}

.em-file-message__icon--xls {
  background-color: var(--em-file-icon-xls);
}

.em-file-message__icon--doc {
  background-color: var(--em-file-icon-doc);
}

.em-file-message__icon--ppt {
  background-color: var(--em-file-icon-ppt);
}

.em-file-message__icon--md {
  background-color: var(--em-file-icon-md);
}

.em-file-message__icon--img {
  background-color: var(--em-file-icon-img);
}

.em-file-message__icon--video {
  background-color: var(--em-file-icon-video);
}

.em-file-message__icon--audio {
  background-color: var(--em-file-icon-audio);
}

/* 图标本体固定白色（token 注释既定口径） */
.em-file-message__icon-glyph {
  color: #ffffff;
}

.em-file-message__info {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.em-file-message__name {
  font-size: var(--em-font-size-15);
  font-weight: var(--em-font-weight-medium);
  color: var(--em-bubble-text-other);
  lines: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.em-file-message__name--self {
  color: var(--em-bubble-text-self);
}

.em-file-message__size {
  font-size: var(--em-font-size-11);
  color: var(--em-text-tertiary);
  margin-top: 2px;
}

.em-file-message__size--self {
  color: var(--em-bubble-text-self-secondary);
}
</style>
