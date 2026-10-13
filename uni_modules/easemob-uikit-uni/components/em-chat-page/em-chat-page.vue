<template>
  <view :class="[ns.b(), themeClass]">
    <scroll-view
      :class="ns.e('scroll')"
      scroll-y
      :scroll-into-view="anchorId"
      :scroll-with-animation="false"
    >
      <view v-if="hasMore" :class="ns.e('history')" @click="onLoadMore">
        <text :class="ns.e('history-text')">{{ loadingMore ? t('conversation.loadingMore') : t('chat.loadMoreHistory') }}</text>
      </view>
      <view v-else-if="list.length > 0" :class="ns.e('history')">
        <text :class="ns.e('history-text')">{{ t('conversation.noMoreHistory') }}</text>
      </view>

      <view
        v-for="m in list"
        :key="m.localId"
        :class="[ns.e('msg'), m.self ? 'em-chat-page__msg--self' : '', m.status === MESSAGE_STATUS.RECALLED ? 'em-chat-page__msg--recalled' : '']"
      >
        <view v-if="m.status === MESSAGE_STATUS.RECALLED" :class="ns.e('recalled')">
          <text :class="ns.e('recalled-text')">{{ t('message.recalled') }}</text>
        </view>
        <template v-else>
          <em-avatar :name="m.self ? '' : m.from" :size="36" />
          <!-- 状态列（仅己方，对齐 vue 版 message-bubble-wrapper）：row-reverse 下落在气泡与头像之间 -->
          <view v-if="m.self && m.status === MESSAGE_STATUS.FAILED" :class="ns.e('state')" @click="onResend(m)">
            <EmIcon name="info-filled" :size="14" :class="ns.e('state-icon-failed')" />
          </view>
          <view v-else-if="m.self && m.status === MESSAGE_STATUS.SENDING" :class="ns.e('state')">
            <EmIcon name="spinner-cycle" :size="14" :class="ns.e('state-icon-sending')" />
          </view>
          <view :class="[ns.e('content'), m.self ? 'em-chat-page__content--self' : '']">
            <em-text-message
              v-if="m.type === MESSAGE_TYPE.TEXT"
              :message="m"
              @long-press="onLongPressMessage"
            />
            <em-image-message
              v-else-if="m.type === MESSAGE_TYPE.IMAGE"
              :message="m"
              @preview="onPreview"
              @long-press="onLongPressMessage"
            />
            <em-audio-message
              v-else-if="m.type === MESSAGE_TYPE.AUDIO"
              :message="m"
              @long-press="onLongPressMessage"
            />
            <em-video-message
              v-else-if="m.type === MESSAGE_TYPE.VIDEO"
              :message="m"
              @long-press="onLongPressMessage"
            />
            <em-file-message
              v-else-if="m.type === MESSAGE_TYPE.FILE"
              :message="m"
              @long-press="onLongPressMessage"
            />
            <view v-else :class="ns.e('bubble')">
              <text :class="ns.e('text')">{{ t('message.unsupported') }}</text>
            </view>
            <!-- 引用卡：气泡外、气泡下方（对齐 vue 版 quote-card）；己方 row-reverse 竖杠落到右侧 -->
            <view v-if="m.quote != null" :class="[ns.e('quote'), m.self ? 'em-chat-page__quote--self' : '']">
              <view :class="[ns.e('quote-line'), m.self ? 'em-chat-page__quote-line--self' : '']"></view>
              <EmIcon v-if="hasQuoteIcon(m)" :name="quoteIconName(m)" :size="13" :class="[ns.e('quote-icon'), m.self ? 'em-chat-page__quote-icon--self' : '']" />
              <text :class="[ns.e('quote-text'), m.self ? 'em-chat-page__quote-text--self' : '']"><text :class="ns.e('quote-sender')">{{ quoteSender(m) }}</text><text :class="ns.e('quote-preview')">{{ quoteSuffix(m.quote) }}</text></text>
            </view>
            <view :class="ns.e('meta')">
              <text :class="ns.e('time')">{{ formatTimeHM(m.time) }}</text>
            </view>
          </view>
        </template>
      </view>
      <view :id="bottomAnchor" :class="ns.e('anchor')"></view>
    </scroll-view>

    <view v-if="quoteInfo != null" :class="ns.e('quotebar')">
      <view :class="ns.e('quotebar-line')"></view>
      <EmIcon v-if="hasQuoteBarIcon" :name="quoteBarIcon" :size="13" :class="ns.e('quotebar-icon')" />
      <text :class="ns.e('quotebar-text')"><text :class="ns.e('quotebar-sender')">{{ quoteBarFrom }}</text><text :class="ns.e('quotebar-preview')">{{ quoteBarSuffix }}</text></text>
      <view :class="ns.e('quotebar-close')" @click="quoteInfo = null">
        <EmIcon name="close" :size="18" />
      </view>
    </view>

    <view :class="ns.e('inputbar')">
      <template v-if="voiceMode">
        <view :class="ns.e('plus')" @click="exitVoiceMode">
          <EmIcon name="compose" :size="20" />
        </view>
        <view :class="[ns.e('record'), recording ? 'em-chat-page__record--active' : '']" @click="onToggleRecord">
          <text :class="[ns.e('record-text'), recording ? 'em-chat-page__record-text--active' : '']">{{ recording ? t('chat.voice.tapStop') : t('chat.voice.tapStart') }}</text>
        </view>
      </template>
      <template v-else>
        <input
          :class="ns.e('input')"
          v-model="draft"
          :placeholder="t('chat.placeholder')"
          confirm-type="send"
          @confirm="onSend"
        />
        <view :class="ns.e('plus')" @click="onOpenMedia">
          <EmIcon name="plus" :size="20" />
        </view>
        <view :class="ns.e('send')" @click="onSend">
          <text :class="ns.e('send-text')">{{ t('chat.send') }}</text>
        </view>
      </template>
    </view>

    <em-action-sheet
      :visible="mediaSheetVisible"
      :actions="mediaActions"
      @select="onMediaAction"
      @update:visible="mediaSheetVisible = $event"
    />

    <em-action-sheet
      :visible="msgSheetVisible"
      :actions="messageActions"
      :title="messageSummary"
      @select="onMessageAction"
      @update:visible="msgSheetVisible = $event"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import EmAvatar from '../em-avatar/em-avatar.vue'
import EmIcon from '../em-icon/em-icon.vue'
import EmActionSheet from '../em-action-sheet/em-action-sheet.vue'
import EmTextMessage from '../em-text-message/em-text-message.vue'
import EmImageMessage from '../em-image-message/em-image-message.vue'
import EmAudioMessage from '../em-audio-message/em-audio-message.vue'
import EmVideoMessage from '../em-video-message/em-video-message.vue'
import EmFileMessage from '../em-file-message/em-file-message.vue'
import type { EmIconName } from '../em-icon/em-icons'
import { MEDIA_PANEL_KEY, MESSAGE_MENU_KEY, MESSAGE_STATUS, MESSAGE_TYPE } from '../../libs/constants'
import { EmKit, chooseFile, chooseImage, chooseVideo, isRecording, previewImage, startRecord, stopRecord } from '../../libs'
import type { EmActionSheetAction, EmMessageItem, EmQuoteInfo } from '../../libs/types'
import { messageStore } from '../../libs/store/message'
import { clearDraft, getDraft, setDraft } from '../../libs/store/draft'
import { useNamespace } from '../../libs/use/useNamespace'
import { useTheme } from '../../libs/use/useTheme'
import { useLocale } from '../../libs/use/useLocale'
import { formatTimeHM } from '../../libs/utils/time'

defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  conversationId: string
}

const props = defineProps<Props>()

const ns = useNamespace('chat-page')
const { themeClass } = useTheme()
const { t } = useLocale()

const draft = ref('')
const anchorId = ref('')
const bottomAnchor = 'em-chat-bottom'
const loadingMore = ref(false)

const list = computed<EmMessageItem[]>(() => messageStore.byConversation[props.conversationId] ?? [])
const hasMore = computed(() => messageStore.hasMore[props.conversationId] === true)

function scrollToBottom(): void {
  anchorId.value = ''
  setTimeout(() => {
    anchorId.value = bottomAnchor
  }, 50)
}

onMounted(async () => {
  draft.value = getDraft(props.conversationId)?.text ?? ''
  await EmKit.enterConversation(props.conversationId)
  try {
    await EmKit.loadHistory(props.conversationId)
  } catch (e) {
    console.error('[emkit] loadHistory fail:', e)
  }
  scrollToBottom()
  EmKit.onMessage((msg) => {
    if (msg.conversationId === props.conversationId) {
      scrollToBottom()
    }
  })
})

onUnmounted(() => {
  EmKit.leaveConversation()
  quoteInfo.value = null
  // 离开页面时若仍在录音，静默停掉不发送
  if (isRecording()) {
    stopRecord().then(() => {}).catch(() => {})
  }
})

// 草稿默认开：输入即存，清空/发送即清
watch(draft, (v) => {
  setDraft(props.conversationId, v)
})

// 切换会话清掉引用条
watch(() => props.conversationId, () => {
  quoteInfo.value = null
})

async function onLoadMore(): Promise<void> {
  if (loadingMore.value) return
  loadingMore.value = true
  try {
    await EmKit.loadHistory(props.conversationId)
  } catch (e) {
    console.error('[emkit] loadHistory fail:', e)
  } finally {
    loadingMore.value = false
  }
}

async function onSend(): Promise<void> {
  const text = draft.value.trim()
  if (text === '') return
  const quote = quoteInfo.value != null ? quoteInfo.value : undefined
  try {
    await EmKit.sendText(props.conversationId, text, quote)
    draft.value = ''
    // 发送成功才清引用条，失败保留供重发
    quoteInfo.value = null
    scrollToBottom()
  } catch (e) {
    console.error('[emkit] sendText fail:', e)
  }
}

async function onPickImage(): Promise<void> {
  try {
    const paths = await chooseImage(1)
    if (paths.length === 0) return
    await EmKit.sendImage(props.conversationId, paths[0])
    scrollToBottom()
  } catch (e) {
    console.error('[emkit] sendImage fail:', e)
  }
}

// 输入栏「+」媒体面板：相册/视频/文件/语音
const mediaSheetVisible = ref(false)
const voiceMode = ref(false)
const recording = ref(false)

const mediaActions = computed<EmActionSheetAction[]>(() => [
  { key: MEDIA_PANEL_KEY.ALBUM, text: t('chat.media.album'), icon: 'image' },
  { key: MEDIA_PANEL_KEY.VIDEO, text: t('chat.media.video'), icon: 'videocam' },
  { key: MEDIA_PANEL_KEY.FILE, text: t('chat.media.file'), icon: 'paperclip' },
  { key: MEDIA_PANEL_KEY.VOICE, text: t('chat.media.voice'), icon: 'mic' }
])

function onOpenMedia(): void {
  mediaSheetVisible.value = true
}

async function onMediaAction(action: EmActionSheetAction): Promise<void> {
  if (action.key === MEDIA_PANEL_KEY.ALBUM) {
    await onPickImage()
  } else if (action.key === MEDIA_PANEL_KEY.VIDEO) {
    await onPickVideo()
  } else if (action.key === MEDIA_PANEL_KEY.FILE) {
    await onPickFile()
  } else if (action.key === MEDIA_PANEL_KEY.VOICE) {
    voiceMode.value = true
  }
}

async function onPickVideo(): Promise<void> {
  const video = await chooseVideo()
  if (video == null) return
  try {
    await EmKit.sendVideo(props.conversationId, video.path, video.duration, video.width, video.height)
    scrollToBottom()
  } catch (e) {
    console.error('[emkit] sendVideo fail:', e)
  }
}

async function onPickFile(): Promise<void> {
  const file = await chooseFile()
  if (file == null) return
  try {
    await EmKit.sendFile(props.conversationId, file)
    scrollToBottom()
  } catch (e) {
    console.error('[emkit] sendFile fail:', e)
  }
}

// 语音录音：最简「点击开始/点击结束」（按住说话手势一期不做）；H5 不支持时 toast 降级
async function onToggleRecord(): Promise<void> {
  if (recording.value) {
    recording.value = false
    try {
      const res = await stopRecord()
      if (res.path === '' || res.duration < 1) {
        uni.showToast({ title: t('chat.voice.tooShort'), icon: 'none' })
        return
      }
      await EmKit.sendAudio(props.conversationId, res.path, res.duration)
      scrollToBottom()
    } catch (e) {
      console.error('[emkit] sendAudio fail:', e)
    }
  } else {
    try {
      startRecord()
      recording.value = true
    } catch (e) {
      uni.showToast({ title: t('chat.voice.unsupported'), icon: 'none' })
    }
  }
}

function exitVoiceMode(): void {
  if (recording.value) {
    stopRecord().then(() => {}).catch(() => {})
    recording.value = false
  }
  voiceMode.value = false
}

function onPreview(m: EmMessageItem): void {
  const url = m.url !== '' ? m.url : m.thumbUrl
  if (url !== '') {
    previewImage([url], url)
  }
}

// 消息长按菜单：复制（仅文本）/ 引用 / 撤回（己方已发送且 2 分钟内）/ 删除（本地）
const msgSheetVisible = ref(false)
const activeMessage = ref<EmMessageItem | null>(null)
// 引用目标快照（选择引用时生成，发送成功/手动关闭/切会话时清除）
const quoteInfo = ref<EmQuoteInfo | null>(null)

// 引用卡/引用条共用：摘要后缀（冒号按 locale 的 summary 模板拼，发送人单列以便套 medium 字重）
function quoteSuffix(q: EmQuoteInfo | null): string {
  if (q == null) return ''
  return t('message.quote.summary', { from: '', text: q.text })
}

function quoteSender(m: EmMessageItem): string {
  return m.quote?.from ?? ''
}

const quoteBarSuffix = computed(() => {
  const q = quoteInfo.value
  if (q == null) return ''
  return quoteSuffix(q)
})

// 模板里直接读 quoteInfo.value.xxx 会触发空值告警，拍平成 computed 基元
const hasQuoteBarIcon = computed(() => {
  const type = quoteInfo.value?.type
  return type === MESSAGE_TYPE.IMAGE || type === MESSAGE_TYPE.VIDEO || type === MESSAGE_TYPE.AUDIO || type === MESSAGE_TYPE.FILE
})
const quoteBarIcon = computed<EmIconName>(() => {
  const type = quoteInfo.value?.type
  if (type === MESSAGE_TYPE.IMAGE) return 'image'
  if (type === MESSAGE_TYPE.VIDEO) return 'videocam'
  if (type === MESSAGE_TYPE.AUDIO) return 'sound'
  if (type === MESSAGE_TYPE.FILE) return 'paperclip'
  return 'more'
})
const quoteBarFrom = computed(() => quoteInfo.value?.from ?? '')

// 非文本引用在文本流开头带类型图标（em-icons 现有映射里语义最近的；文本不带）
function hasQuoteIcon(m: EmMessageItem): boolean {
  const type = m.quote?.type
  return type === MESSAGE_TYPE.IMAGE || type === MESSAGE_TYPE.VIDEO || type === MESSAGE_TYPE.AUDIO || type === MESSAGE_TYPE.FILE
}

function quoteIconName(m: EmMessageItem): EmIconName {
  const type = m.quote?.type
  if (type === MESSAGE_TYPE.IMAGE) return 'image'
  if (type === MESSAGE_TYPE.VIDEO) return 'videocam'
  if (type === MESSAGE_TYPE.AUDIO) return 'sound'
  if (type === MESSAGE_TYPE.FILE) return 'paperclip'
  return 'more'
}

const messageSummary = computed(() => {
  const m = activeMessage.value
  if (m == null) return ''
  if (m.type === MESSAGE_TYPE.TEXT) return m.text.slice(0, 20)
  if (m.type === MESSAGE_TYPE.IMAGE) return t('message.image')
  return t('message.unsupported')
})

const messageActions = computed<EmActionSheetAction[]>(() => {
  const m = activeMessage.value
  if (m == null) return []
  const actions: EmActionSheetAction[] = []
  if (m.type === MESSAGE_TYPE.TEXT) {
    actions.push({ key: MESSAGE_MENU_KEY.COPY, text: t('message.action.copy'), icon: 'checkbox' })
  }
  actions.push({ key: MESSAGE_MENU_KEY.QUOTE, text: t('message.action.quote'), icon: 'chatbubble' })
  if (m.self && m.status === MESSAGE_STATUS.SENT && Date.now() - m.time <= 120000) {
    actions.push({ key: MESSAGE_MENU_KEY.RECALL, text: t('message.action.recall'), icon: 'undo' })
  }
  actions.push({ key: MESSAGE_MENU_KEY.DELETE, text: t('message.action.delete'), icon: 'trash', danger: true })
  return actions
})

function onLongPressMessage(m: EmMessageItem): void {
  activeMessage.value = m
  msgSheetVisible.value = true
}

// 失败重发：点状态列红叹号触发，原地回到 sending，失败再落 failed
async function onResend(m: EmMessageItem): Promise<void> {
  if (m.status !== MESSAGE_STATUS.FAILED) return
  try {
    await EmKit.resendMessage(m.conversationId, m.localId)
    scrollToBottom()
  } catch (e) {
    console.error('[emkit] resendMessage fail:', e)
  }
}

async function onMessageAction(action: EmActionSheetAction): Promise<void> {
  const m = activeMessage.value
  if (m == null) return
  if (action.key === MESSAGE_MENU_KEY.COPY) {
    uni.setClipboardData({ data: m.text })
  } else if (action.key === MESSAGE_MENU_KEY.QUOTE) {
    quoteInfo.value = EmKit.makeQuote(m)
  } else if (action.key === MESSAGE_MENU_KEY.RECALL) {
    try {
      await EmKit.recallMessage(m.conversationId, m.id)
    } catch (e) {
      uni.showToast({ title: t('message.recall.failed'), icon: 'none' })
    }
  } else if (action.key === MESSAGE_MENU_KEY.DELETE) {
    EmKit.deleteLocalMessage(m.conversationId, m.localId)
  }
}

</script>

<style>
@import '../../libs/style/variables.css';

.em-chat-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  background-color: var(--em-chat-bg);
}

.em-chat-page__scroll {
  flex: 1;
  height: 0;
  padding: var(--em-message-padding) var(--em-spacing-4);
}

.em-chat-page__history {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--em-spacing-2) 0;
}

.em-chat-page__history-text {
  font-size: var(--em-font-size-12);
  color: var(--em-text-tertiary);
}

.em-chat-page__msg {
  display: flex;
  flex-direction: row;
  margin-bottom: var(--em-message-gap);
}

.em-chat-page__msg--self {
  flex-direction: row-reverse;
}

.em-chat-page__msg--recalled {
  justify-content: center;
}

.em-chat-page__recalled {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 2px var(--em-spacing-2);
  background-color: var(--em-message-chip-bg);
  border-radius: 999px;
}

.em-chat-page__recalled-text {
  font-size: var(--em-font-size-12);
  color: var(--em-text-tertiary);
}

/* 引用卡（对齐 vue 版 quote-card）：气泡外下方，无背景无边框，2px 竖杠 + 「发送人：摘要」，最多两行折叠 */
.em-chat-page__quote {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-top: 4px;
  max-width: 100%;
}

.em-chat-page__quote--self {
  flex-direction: row-reverse;
}

.em-chat-page__quote-line {
  width: 2px;
  border-radius: 2px;
  background-color: var(--em-quote-line-color);
  margin-right: var(--em-spacing-2);
  flex-shrink: 0;
}

.em-chat-page__quote-line--self {
  margin-right: 0;
  margin-left: var(--em-spacing-2);
}

.em-chat-page__quote-icon {
  margin-right: var(--em-spacing-1);
  margin-top: 2px;
  flex-shrink: 0;
}

.em-chat-page__quote-icon--self {
  margin-right: 0;
  margin-left: var(--em-spacing-1);
}

.em-chat-page__quote-text {
  flex: 1;
  font-size: var(--em-font-size-13);
  line-height: 18px;
  color: var(--em-text-secondary);
  lines: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.em-chat-page__quote-text--self {
  text-align: right;
}

.em-chat-page__quote-sender {
  font-size: var(--em-font-size-13);
  line-height: 18px;
  color: var(--em-text-secondary);
  font-weight: var(--em-font-weight-medium);
}

.em-chat-page__quote-preview {
  font-size: var(--em-font-size-13);
  line-height: 18px;
  color: var(--em-text-secondary);
}

/* 引用条（对齐 vue 版 quote-bar）：无边框无底色，2px 竖杠 + 摘要单行省略 + 18×18 纯图标关闭 */
.em-chat-page__quotebar {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: var(--em-spacing-2) var(--em-spacing-4);
}

.em-chat-page__quotebar-line {
  width: 2px;
  align-self: stretch;
  border-radius: 2px;
  background-color: var(--em-quote-line-color);
  margin-right: var(--em-spacing-2);
  flex-shrink: 0;
}

.em-chat-page__quotebar-icon {
  margin-right: var(--em-spacing-2);
  flex-shrink: 0;
}

.em-chat-page__quotebar-text {
  flex: 1;
  font-size: var(--em-font-size-13);
  color: var(--em-text-secondary);
  lines: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.em-chat-page__quotebar-sender {
  font-size: var(--em-font-size-13);
  color: var(--em-text-secondary);
  font-weight: var(--em-font-weight-medium);
}

.em-chat-page__quotebar-preview {
  font-size: var(--em-font-size-13);
  color: var(--em-text-secondary);
}

.em-chat-page__quotebar-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: var(--em-spacing-2);
  flex-shrink: 0;
}

.em-chat-page__content {
  display: flex;
  flex-direction: column;
  max-width: 70%;
  margin-left: var(--em-spacing-2);
  margin-right: var(--em-spacing-2);
}

.em-chat-page__content--self {
  align-items: flex-end;
}

.em-chat-page__bubble {
  background-color: var(--em-bubble-bg-other);
  border-radius: var(--em-bubble-radius);
  padding: 12px 14px;
}

.em-chat-page__text {
  font-size: var(--em-font-size-15);
  line-height: var(--em-lineheight-normal);
  color: var(--em-bubble-text-other);
}

.em-chat-page__meta {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: var(--em-spacing-1);
}

/* 状态列（仅己方消息）：落在气泡与头像之间，垂直居中与气泡对齐 */
.em-chat-page__state {
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  width: 20px;
  height: 20px;
  margin: 0 var(--em-spacing-1);
  flex-shrink: 0;
}

/* 失败红叹号（em-icons 无 circle-bang，info-filled 实心圆点是语义最近的警示形），点击触发重发 */
.em-chat-page__state-icon-failed {
  color: var(--em-danger-color);
}

/* sending 转圈：蒸汽端若不支持 @keyframes 则退化为静态图标，不影响语义 */
.em-chat-page__state-icon-sending {
  animation: em-chat-page-spin 1s linear infinite;
}

@keyframes em-chat-page-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.em-chat-page__time {
  font-size: var(--em-font-size-10);
  color: var(--em-text-tertiary);
}

.em-chat-page__anchor {
  height: 1px;
}

.em-chat-page__inputbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: var(--em-spacing-2) var(--em-spacing-4);
  background-color: var(--em-input-bg);
  border-top-width: 1px;
  border-top-style: solid;
  border-top-color: var(--em-divider-color);
}

.em-chat-page__input {
  flex: 1;
  height: 36px;
  padding: 0 var(--em-spacing-3);
  font-size: var(--em-font-size-14);
  color: var(--em-text-primary);
  background-color: var(--em-control-bg);
  border-radius: var(--em-input-radius);
}

.em-chat-page__plus {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-left: var(--em-spacing-2);
  border-radius: var(--em-input-radius);
  border-width: 1px;
  border-style: solid;
  border-color: var(--em-input-border-color);
}

/* 语音态：点击开始/结束录音按钮（按住说话手势一期不做） */
.em-chat-page__record {
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

.em-chat-page__record--active {
  background-color: var(--em-bg-active);
  border-color: var(--em-primary-color);
}

.em-chat-page__record-text {
  font-size: var(--em-font-size-14);
  color: var(--em-text-primary);
}

.em-chat-page__record-text--active {
  color: var(--em-primary-color);
}

.em-chat-page__send {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 var(--em-spacing-4);
  margin-left: var(--em-spacing-2);
  border-radius: var(--em-input-radius);
  background-color: var(--em-primary-color);
}

.em-chat-page__send-text {
  font-size: var(--em-font-size-14);
  color: var(--em-text-inverse);
}
</style>
