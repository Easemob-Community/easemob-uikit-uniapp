<template>
  <view :class="[ns.b(), 'em-bubble', message.self ? 'em-bubble--self' : '']" @longpress="onLongpress">
    <!-- 无 @提及（ext.em_at_list 为空/无）走原纯文本渲染；有则按 parseMentions 分片，
         @ 片段套高亮类可点击（对齐 vue 版 text-message 的 msgSegments，链接识别不在一期） -->
    <text v-if="segments.length === 0" :class="[ns.e('text'), message.self ? 'em-text-message__text--self' : '']">{{ message.text }}</text>
    <text v-else :class="[ns.e('text'), message.self ? 'em-text-message__text--self' : '']">
      <text
        v-for="(seg, idx) in segments"
        :key="idx"
        :class="seg.type === 'mention' ? [ns.e('mention'), message.self && ns.m('mention-self')] : ''"
        @click="seg.type === 'mention' && onMentionClick(seg)"
      >{{ seg.value }}</text>
    </text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MESSAGE_EXT_KEY } from '../../libs/constants'
import type { EmMessageItem, MentionContact } from '../../libs/types'
import { parseMentions } from '../../libs/utils/mention'
import { useNamespace } from '../../libs/use/useNamespace'

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
