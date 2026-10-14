<template>
  <view :class="ns.b()" :style="rootStyle">
    <!-- 引用条（对齐 vue 版 quote-bar）：无边框无底色，2px 竖杠 + 摘要单行省略 + 18×18 纯图标关闭 -->
    <view v-if="quote != null" :class="ns.e('quotebar')">
      <view :class="ns.e('quotebar-line')"></view>
      <EmIcon v-if="hasQuoteIcon" :name="quoteIcon" :size="13" :class="ns.e('quotebar-icon')" />
      <em-text :text-class="ns.e('quotebar-text')" :text-style="quotebarTextStyle" :class="ns.e('quotebar-host')">
        <text :class="ns.e('quotebar-sender')">{{ quoteFrom }}</text><text :class="ns.e('quotebar-preview')">{{ quoteSuffix }}</text>
      </em-text>
      <view :class="ns.e('quotebar-close')" @click="emit('quote-close')">
        <EmIcon name="close" :size="18" />
      </view>
    </view>

    <!-- 录音提示（按住说话时显示，上滑越过阈值切换为取消文案） -->
    <view v-if="recording" :class="ns.e('record-hint')">
      <text :class="[ns.e('record-hint-text'), willCancel ? 'em-chat-inputbar__record-hint-text--cancel' : '']">{{ willCancel ? t('chat.voice.releaseToCancel') : t('chat.voice.slideUpCancel') }}</text>
    </view>

    <view :class="ns.e('bar')">
      <view :class="[ns.e('tool'), 'em-chat-inputbar__tool--first']" @click="onToggleVoiceMode">
        <EmIcon :name="voiceMode ? 'compose' : 'mic'" :size="20" />
      </view>
      <view
        v-if="voiceMode"
        :class="[ns.e('record'), recording ? 'em-chat-inputbar__record--active' : '', willCancel ? 'em-chat-inputbar__record--cancel' : '']"
        @touchstart="onRecordTouchStart"
        @touchmove="onRecordTouchMove"
        @touchend="onRecordTouchEnd"
        @touchcancel="onRecordTouchCancel"
      >
        <text :class="ns.e('record-text')">{{ recording ? t('chat.voice.releaseEnd') : t('chat.voice.holdTalk') }}</text>
      </view>
      <input
        v-else
        :class="ns.e('input')"
        v-model="text"
        :focus="inputFocus"
        :placeholder="t('chat.placeholder')"
        confirm-type="send"
        @confirm="onSend"
        @focus="onInputFocus"
      />
      <view :class="ns.e('tool')" @click="onToggleEmoji">
        <text :class="ns.e('emoji-btn')">😀</text>
      </view>
      <view :class="[ns.e('tool'), panel === 'media' ? 'em-chat-inputbar__tool--active' : '']" @click="onToggleMedia">
        <EmIcon name="plus" :size="20" />
      </view>
      <view :class="ns.e('send')" @click="onSend">
        <text :class="ns.e('send-text')">{{ t('chat.send') }}</text>
      </view>
    </view>

    <!-- 底部面板：emoji / 媒体二选一，同高（对齐 vue 版 h5-input 的 panel 互斥形态，占键盘位顶起输入栏） -->
    <view v-if="panel === 'emoji'" :class="ns.e('panel')" :style="panelStyle">
      <scroll-view scroll-y :class="ns.e('emoji-scroll')">
        <view :class="ns.e('emoji-grid')">
          <view v-for="emoji in emojis" :key="emoji" :class="ns.e('emoji-cell')" @click="onEmoji(emoji)">
            <text :class="ns.e('emoji-char')">{{ emoji }}</text>
          </view>
        </view>
      </scroll-view>
    </view>
    <view v-else-if="panel === 'media'" :class="ns.e('panel')" :style="panelStyle">
      <view :class="ns.e('media-grid')">
        <view v-for="item in mediaItems" :key="item.key" :class="ns.e('media-item')" @click="onMediaItem(item.key)">
          <view :class="ns.e('media-tile')">
            <EmIcon :name="item.icon" :size="26" :class="ns.e('media-tile-icon')" />
          </view>
          <text :class="ns.e('media-label')">{{ item.text }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import EmIcon from '../em-icon/em-icon.vue'
import EmText from '../em-text/em-text.vue'
import type { EmIconName } from '../em-icon/em-icons'
import { EMOJI_LIST } from './emojis'
import { MEDIA_PANEL_KEY, MESSAGE_TYPE } from '../../libs/constants'
import { cancelRecord, isRecording, startRecord, stopRecord } from '../../libs/platform'
import { getSafeAreaBottom } from '../../libs/use/usePopup'
import type { EmQuoteInfo } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'
import { useLocale } from '../../libs/use/useLocale'

interface Props {
  modelValue: string
  quote: EmQuoteInfo | null
}

const props = withDefaults(defineProps<Props>(), {
  quote: null
})

defineOptions({ styleIsolation: 'app-and-page' })

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'send'): void
  (e: 'quote-close'): void
  (e: 'media-select', key: string): void
  (e: 'voice-send', path: string, duration: number): void
}>()

const ns = useNamespace('chat-inputbar')

// 引用条文字内联兜底（小程序样式隔离，见 em-text 注释）
const quotebarTextStyle = 'font-size: var(--em-font-size-13); color: var(--em-text-secondary);'
const { t } = useLocale()

const text = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v)
})

// ========== 引用条显示 ==========

const quoteFrom = computed(() => props.quote?.from ?? '')
const quoteSuffix = computed(() => {
  const q = props.quote
  if (q == null) return ''
  return t('message.quote.summary', { from: '', text: q.text })
})

const hasQuoteIcon = computed(() => {
  const type = props.quote?.type
  return type === MESSAGE_TYPE.IMAGE || type === MESSAGE_TYPE.VIDEO || type === MESSAGE_TYPE.AUDIO || type === MESSAGE_TYPE.FILE
})

const quoteIcon = computed<EmIconName>(() => {
  const type = props.quote?.type
  if (type === MESSAGE_TYPE.IMAGE) return 'image'
  if (type === MESSAGE_TYPE.VIDEO) return 'videocam'
  if (type === MESSAGE_TYPE.AUDIO) return 'sound'
  if (type === MESSAGE_TYPE.FILE) return 'paperclip'
  return 'more'
})

// ========== 键盘/面板互斥（对齐 vue 版 h5-input：none/emoji/media 三态，开面板收键盘，聚焦收面板） ==========

const inputFocus = ref(false)
const panel = ref<'none' | 'emoji' | 'media'>('none')

function onToggleEmoji(): void {
  panel.value = panel.value === 'emoji' ? 'none' : 'emoji'
  if (panel.value !== 'none') {
    inputFocus.value = false
  }
}

function onInputFocus(): void {
  panel.value = 'none'
}

// 面板底部安全区（对齐 vue 版 panel 的 safe-bottom padding）
const panelStyle = computed(() => {
  const bottom = getSafeAreaBottom()
  return bottom > 0 ? `padding-bottom: ${bottom}px;` : ''
})

// 无面板时输入栏自身贴底，需让出 Home 指示条安全区；面板打开时安全区由面板承担，避免双重间距
const rootStyle = computed(() => {
  if (panel.value !== 'none') return ''
  const bottom = getSafeAreaBottom()
  return bottom > 0 ? `padding-bottom: ${bottom}px;` : ''
})

// ========== 发送 ==========

function onSend(): void {
  if (props.modelValue.trim() === '') return
  panel.value = 'none'
  emit('send')
}

// ========== emoji 面板 ==========

const emojis = EMOJI_LIST

// uni 的 input 跨端拿不到光标位置（selectionStart 是 DOM 概念），一期追加到末尾
function onEmoji(emoji: string): void {
  emit('update:modelValue', props.modelValue + emoji)
}

// ========== 「+」媒体面板（格子布局，对齐 vue 版 more-grid；语音不进格子，走左侧 mic 切换） ==========

interface MediaItem {
  key: string
  text: string
  icon: EmIconName
}

const mediaItems = computed<MediaItem[]>(() => [
  { key: MEDIA_PANEL_KEY.ALBUM, text: t('chat.media.album'), icon: 'image' },
  { key: MEDIA_PANEL_KEY.CAMERA, text: t('chat.media.camera'), icon: 'camera' },
  { key: MEDIA_PANEL_KEY.VIDEO, text: t('chat.media.video'), icon: 'videocam' },
  { key: MEDIA_PANEL_KEY.FILE, text: t('chat.media.file'), icon: 'paperclip' }
])

function onToggleMedia(): void {
  panel.value = panel.value === 'media' ? 'none' : 'media'
  if (panel.value !== 'none') {
    inputFocus.value = false
  }
}

function onMediaItem(key: string): void {
  panel.value = 'none'
  emit('media-select', key)
}

// ========== 语音：按住说话 + 上滑取消（微信手势） ==========

const voiceMode = ref(false)
const recording = ref(false)
const willCancel = ref(false)
const CANCEL_THRESHOLD = 60
let recordStartY = 0

function onToggleVoiceMode(): void {
  if (voiceMode.value) {
    exitVoiceMode()
  } else {
    voiceMode.value = true
    inputFocus.value = false
    panel.value = 'none'
  }
}

function exitVoiceMode(): void {
  if (recording.value) {
    cancelRecord()
    recording.value = false
    willCancel.value = false
  }
  voiceMode.value = false
}

function onRecordTouchStart(e: TouchEvent): void {
  if (recording.value) return
  try {
    startRecord()
  } catch (err) {
    uni.showToast({ title: t('chat.voice.unsupported'), icon: 'none' })
    voiceMode.value = false
    return
  }
  recordStartY = e.touches[0].clientY
  willCancel.value = false
  recording.value = true
}

function onRecordTouchMove(e: TouchEvent): void {
  if (!recording.value) return
  willCancel.value = recordStartY - e.touches[0].clientY > CANCEL_THRESHOLD
}

function onRecordTouchEnd(): void {
  if (!recording.value) return
  recording.value = false
  if (willCancel.value) {
    willCancel.value = false
    cancelRecord()
    return
  }
  stopRecord().then((res) => {
    if (res.path === '' || res.duration < 1) {
      uni.showToast({ title: t('chat.voice.tooShort'), icon: 'none' })
      return
    }
    emit('voice-send', res.path, res.duration)
  }).catch(() => {})
}

function onRecordTouchCancel(): void {
  if (!recording.value) return
  recording.value = false
  willCancel.value = false
  cancelRecord()
}

onUnmounted(() => {
  if (isRecording()) {
    cancelRecord()
  }
})
</script>

<style>
@import '../../libs/style/variables.css';

.em-chat-inputbar {
  display: flex;
  flex-direction: column;
  background-color: var(--em-input-bg);
  border-top-width: 1px;
  border-top-style: solid;
  border-top-color: var(--em-divider-color);
}

.em-chat-inputbar__quotebar {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: var(--em-spacing-2) var(--em-spacing-4);
}

.em-chat-inputbar__quotebar-line {
  width: 2px;
  align-self: stretch;
  border-radius: 2px;
  background-color: var(--em-quote-line-color);
  margin-right: var(--em-spacing-2);
  flex-shrink: 0;
}

.em-chat-inputbar__quotebar-icon {
  margin-right: var(--em-spacing-2);
  flex-shrink: 0;
}

/* 宿主节点补 flex 约束链（小程序宿主参与 flex 布局，flex:1/min-width:0 必须落在宿主上） */
.em-chat-inputbar__quotebar-host {
  flex: 1;
  min-width: 0;
}

.em-chat-inputbar__quotebar-text {
  font-size: var(--em-font-size-13);
  color: var(--em-text-secondary);
}

.em-chat-inputbar__quotebar-sender {
  font-size: var(--em-font-size-13);
  color: var(--em-text-secondary);
  font-weight: var(--em-font-weight-medium);
}

.em-chat-inputbar__quotebar-preview {
  font-size: var(--em-font-size-13);
  color: var(--em-text-secondary);
}

.em-chat-inputbar__quotebar-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: var(--em-spacing-2);
  flex-shrink: 0;
}

.em-chat-inputbar__record-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--em-spacing-1) 0;
}

.em-chat-inputbar__record-hint-text {
  font-size: var(--em-font-size-12);
  color: var(--em-text-tertiary);
}

.em-chat-inputbar__record-hint-text--cancel {
  color: var(--em-danger-color);
}

.em-chat-inputbar__bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: var(--em-spacing-2) var(--em-spacing-4);
}

.em-chat-inputbar__tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-left: var(--em-spacing-2);
  flex-shrink: 0;
}

.em-chat-inputbar__tool--first {
  margin-left: 0;
}

/* 面板打开时入口按钮高亮（对齐 vue 版 icon-btn--active） */
.em-chat-inputbar__tool--active {
  background-color: var(--em-bg-active);
  border-radius: 999px;
}

.em-chat-inputbar__emoji-btn {
  font-size: 22px;
  line-height: 1;
}

.em-chat-inputbar__input {
  flex: 1;
  height: 36px;
  padding: 0 var(--em-spacing-3);
  font-size: var(--em-font-size-14);
  color: var(--em-text-primary);
  background-color: var(--em-control-bg);
  border-radius: var(--em-input-radius);
}

.em-chat-inputbar__record {
  flex: 1;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: var(--em-spacing-2);
  border-radius: var(--em-input-radius);
  background-color: var(--em-control-bg);
  border-width: 1px;
  border-style: solid;
  border-color: var(--em-input-border-color);
}

.em-chat-inputbar__record--active {
  background-color: var(--em-bg-active);
  border-color: var(--em-primary-color);
}

.em-chat-inputbar__record--cancel {
  background-color: var(--em-bg-active);
  border-color: var(--em-danger-color);
}

.em-chat-inputbar__record-text {
  font-size: var(--em-font-size-14);
  color: var(--em-text-primary);
}

.em-chat-inputbar__send {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 var(--em-spacing-4);
  margin-left: var(--em-spacing-2);
  border-radius: var(--em-input-radius);
  background-color: var(--em-primary-color);
  flex-shrink: 0;
}

.em-chat-inputbar__send-text {
  font-size: var(--em-font-size-14);
  color: var(--em-text-inverse);
}

/* 底部面板：emoji / 媒体同高（240px，与常见键盘高度接近；不插虚拟键盘占位） */
.em-chat-inputbar__panel {
  height: 240px;
  display: flex;
  flex-direction: column;
  border-top-width: 1px;
  border-top-style: solid;
  border-top-color: var(--em-divider-color);
}

.em-chat-inputbar__emoji-scroll {
  flex: 1;
  height: 0;
  padding: 0 var(--em-spacing-2);
}

.em-chat-inputbar__emoji-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.em-chat-inputbar__emoji-cell {
  width: 12.5%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.em-chat-inputbar__emoji-char {
  font-size: 24px;
  line-height: 1;
}

/* 媒体格子（对齐 vue 版 more-grid：4 列、56×56 圆角瓷贴 + 11px 小字） */
.em-chat-inputbar__media-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  padding: var(--em-spacing-5) var(--em-spacing-4);
}

.em-chat-inputbar__media-item {
  width: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.em-chat-inputbar__media-tile {
  width: 56px;
  height: 56px;
  border-radius: var(--em-radius);
  background-color: var(--em-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.em-chat-inputbar__media-tile-icon {
  color: var(--em-text-primary);
}

.em-chat-inputbar__media-label {
  margin-top: 6px;
  font-size: var(--em-font-size-11);
  color: var(--em-text-secondary);
}
</style>
