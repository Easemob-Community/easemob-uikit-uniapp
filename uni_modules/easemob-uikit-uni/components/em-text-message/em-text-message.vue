<template>
  <view :class="[ns.b(), 'em-bubble', message.self ? 'em-bubble--self' : '']" @longpress="onLongpress">
    <!-- 无 @提及（ext.em_at_list 为空/无）走原纯文本渲染；有则按 parseMentions 分片，
         @ 片段套高亮类可点击（对齐 vue 版 text-message 的 msgSegments，链接识别不在一期） -->
    <text v-if="segments.length === 0" :class="[ns.e('text'), message.self ? 'em-text-message__text--self' : '']">{{ message.text }}<text v-if="isStreaming" :class="[ns.e('stream-cursor'), message.self && ns.m('stream-cursor-self')]">▍</text><text v-else-if="isStreamError" :class="[ns.e('stream-error'), message.self && ns.m('stream-error-self')]">{{ t('message.stream.error') }}</text></text>
    <text v-else :class="[ns.e('text'), message.self ? 'em-text-message__text--self' : '']">
      <template v-for="(seg, idx) in segments" :key="idx">
        <text
          v-if="seg.type === 'mention'"
          :class="[ns.e('mention'), message.self && ns.m('mention-self')]"
          @click="onMentionClick(seg)"
        >{{ seg.value }}</text>
        <text v-else>{{ seg.value }}</text>
      </template>
    </text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MESSAGE_EXT_KEY, STREAM_MESSAGE_STATUS } from '../../libs/constants'
import type { EmMessageItem, MentionContact } from '../../libs/types'
import { parseMentions } from '../../libs/utils/mention'
import { isPlainTextStream, isStreamActive } from '../../libs/utils/stream'
import { useNamespace } from '../../libs/use/useNamespace'
import { useLocale } from '../../libs/use/useLocale'

interface Props {
  message: EmMessageItem
  /** @名字 → userId 的解析表（父组件按群成员装配，同 em-mention-picker 的 contacts）；
   *  缺省/未命中时 mention-click 回落为 @ 后的原始名字（与 vue 版 seg.userId=name 行为一致） */
  mentionContacts?: MentionContact[]
}

const props = withDefaults(defineProps<Props>(), {
  mentionContacts: () => []
})

defineOptions({ styleIsolation: 'app-and-page', virtualHost: true })

const emit = defineEmits<{
  (e: 'long-press', message: EmMessageItem): void
  // @ 片段点击：载荷为解析后的 userId（未命中解析表时为原始名字）
  (e: 'mention-click', userId: string): void
}>()

const ns = useNamespace('text-message')
const { t } = useLocale()

/**
 * 流式消息展示态（M2.13）：分片合并由数据层完成，这里只负责展示。
 * 仅内核纯文本流（customType 缺省/'text'）显示打字机光标与异常提示；
 * markdown 等富格式由宿主经 em-chat-page 的 #stream-message 插槽接管，回调本组件时按普通文本兜底。
 */
const streamState = computed(() => props.message.stream)
const isPlainStream = computed(() => isPlainTextStream(streamState.value))
/** 传输中：气泡尾部打字机光标（蒸汽端 5.26 不支持 CSS 动画，静态光标降级） */
const isStreaming = computed(() => isPlainStream.value && isStreamActive(streamState.value?.status))
/** 异常结束：保留已生成内容，尾部追加「内容生成异常」提示 */
const isStreamError = computed(() => isPlainStream.value && streamState.value?.status === STREAM_MESSAGE_STATUS.ERROR)

interface TextSegment {
  type: 'text' | 'mention'
  value: string
  userId: string
}

// 高亮判定数据源：msg.ext[MESSAGE_EXT_KEY.MENTION]（em_at_list userId 数组）；仅展示层分片，不改消息体
const mentionEnabled = computed(() => {
  const raw = props.message.ext[MESSAGE_EXT_KEY.MENTION]
  return Array.isArray(raw) && raw.length > 0
})

function userIdOfMention(name: string): string {
  const hit = props.mentionContacts.find((c) => c.name === name)
  return hit != null ? hit.userId : name
}

const segments = computed<TextSegment[]>(() => {
  const text = props.message.text
  if (!mentionEnabled.value || text === '') {
    return []
  }
  const result: TextSegment[] = []
  let last = 0
  parseMentions(text).forEach((seg) => {
    if (seg.start > last) {
      result.push({ type: 'text', value: text.slice(last, seg.start), userId: '' })
    }
    result.push({ type: 'mention', value: text.slice(seg.start, seg.end), userId: userIdOfMention(seg.name) })
    last = seg.end
  })
  if (last < text.length) {
    result.push({ type: 'text', value: text.slice(last), userId: '' })
  }
  return result
})

function onMentionClick(seg: TextSegment): void {
  emit('mention-click', seg.userId)
}

function onLongpress(): void {
  emit('long-press', props.message)
}
</script>

<style>
@import './em-text-message.css';
</style>
