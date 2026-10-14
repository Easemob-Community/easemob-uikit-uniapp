<template>
  <view :class="[ns.b(), themeClass]">
    <view v-if="peerTyping" :class="ns.e('typing')">
      <text :class="ns.e('typing-text')">{{ t('chat.typing') }}</text>
    </view>
    <scroll-view
      :class="ns.e('scroll')"
      scroll-y
      :scroll-into-view="anchorId"
      :scroll-with-animation="scrollWithAnimation"
      :show-scrollbar="false"
      :enhanced="true"
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
        :id="msgAnchorId(m)"
        :class="[ns.e('msg'), m.self ? 'em-chat-page__msg--self' : '', m.status === MESSAGE_STATUS.RECALLED ? 'em-chat-page__msg--recalled' : '', highlightId !== '' && highlightId === m.localId ? 'em-chat-page__msg--highlight' : '']"
      >
        <view v-if="m.status === MESSAGE_STATUS.RECALLED" :class="ns.e('recalled')">
          <text :class="ns.e('recalled-text')">{{ t('message.recalled') }}</text>
        </view>
        <template v-else>
          <em-avatar :name="m.self ? '' : m.from" :size="36" />
          <view :class="[ns.e('content'), m.self ? 'em-chat-page__content--self' : '']">
            <!-- 气泡行：状态图标（仅己方）落在气泡末尾左侧、与气泡底边对齐（对齐 vue 版 inline 状态列） -->
            <view :class="ns.e('bubble-row')">
              <view v-if="m.self && m.status === MESSAGE_STATUS.FAILED" :class="ns.e('state')" @click="onResend(m)">
                <EmIcon name="info-filled" :size="14" :class="ns.e('state-icon-failed')" />
              </view>
              <view v-else-if="m.self && m.status === MESSAGE_STATUS.SENDING" :class="ns.e('state')">
                <EmIcon name="spinner-cycle" :size="14" :class="ns.e('state-icon-sending')" />
              </view>
              <!-- 单聊已读回执：仅最新一条己方已发送消息展示（对齐 vue 版 readIconDisplay 'latest'），未读空心圆/已读对勾 -->
              <view v-else-if="showReadState(m)" :class="ns.e('state')">
                <EmIcon :name="readIconName(m)" :size="14" :class="[ns.e('state-icon'), isPeerRead(m) ? 'em-chat-page__state-icon--read' : 'em-chat-page__state-icon--unread']" />
              </view>
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
            </view>
            <!-- 引用卡：气泡外、气泡下方（对齐 vue 版 quote-card）；己方 row-reverse 竖杠落到右侧；点击定位原消息 -->
            <view v-if="m.quote != null" :class="[ns.e('quote'), m.self ? 'em-chat-page__quote--self' : '']" @click="onQuoteClick(m)">
              <view :class="[ns.e('quote-line'), m.self ? 'em-chat-page__quote-line--self' : '']"></view>
              <EmIcon v-if="hasQuoteIcon(m)" :name="quoteIconName(m)" :size="13" :class="[ns.e('quote-icon'), m.self ? 'em-chat-page__quote-icon--self' : '']" />
              <em-text :lines="2" :text-class="quoteTextClass(m)" :class="ns.e('quote-host')">
                <text :class="ns.e('quote-sender')">{{ quoteSender(m) }}</text><text :class="ns.e('quote-preview')">{{ quoteSuffix(m.quote) }}</text>
              </em-text>
            </view>
            <view :class="ns.e('meta')">
              <text :class="ns.e('time')">{{ formatTimeHM(m.time) }}</text>
            </view>
          </view>
        </template>
      </view>
      <view :id="bottomAnchor" :class="ns.e('anchor')"></view>
    </scroll-view>

    <em-chat-inputbar
      v-model="draft"
      :quote="quoteInfo"
      @send="onSend"
      @quote-close="quoteInfo = null"
      @media-select="onMediaSelect"
      @voice-send="onVoiceSend"
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
import EmChatInputbar from '../em-chat-inputbar/em-chat-inputbar.vue'
import EmText from '../em-text/em-text.vue'
import EmTextMessage from '../em-text-message/em-text-message.vue'
import EmImageMessage from '../em-image-message/em-image-message.vue'
import EmAudioMessage from '../em-audio-message/em-audio-message.vue'
import EmVideoMessage from '../em-video-message/em-video-message.vue'
import EmFileMessage from '../em-file-message/em-file-message.vue'
import type { EmIconName } from '../em-icon/em-icons'
import { MEDIA_PANEL_KEY, MESSAGE_MENU_KEY, MESSAGE_STATUS, MESSAGE_TYPE } from '../../libs/constants'
import { EmKit, chooseFile, chooseImage, chooseVideo, previewImage } from '../../libs'
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

// 对端 typing 提示（chat 层 5s 超时自动消失）
const peerTyping = computed(() => messageStore.peerTyping[props.conversationId] === true)

// 已读回执展示目标：最新一条己方已发送消息（其余己方消息不显示已读态）
const latestSelfLocalId = computed(() => {
  const arr = list.value
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i]
    if (m.self && m.status === MESSAGE_STATUS.SENT) return m.localId
  }
  return ''
})

function showReadState(m: EmMessageItem): boolean {
  return EmKit.isReadReceiptEnabled() && m.self && m.status === MESSAGE_STATUS.SENT && m.localId === latestSelfLocalId.value
}

function isPeerRead(m: EmMessageItem): boolean {
  const readAt = messageStore.peerReadTime[props.conversationId] ?? 0
  return m.time > 0 && readAt >= m.time
}

function readIconName(m: EmMessageItem): EmIconName {
  return isPeerRead(m) ? 'checkmarkempty' : 'circle'
}

function scrollToBottom(): void {
  scrollWithAnimation.value = false
  anchorId.value = ''
  setTimeout(() => {
    anchorId.value = bottomAnchor
  }, 50)
}

// 引用定位：消息行锚点 id + 点击引用卡滚动到原消息并整行闪烁高亮（对齐 vue 版 message-row-flash）；
// 原消息未加载（历史未拉到）或已删除时提示
const highlightId = ref('')
const scrollWithAnimation = ref(false)
// 单个共享计时器，避免连续定位多次堆积；与 CSS 动画 2.8s 对齐（3000ms 清除）
let highlightTimer: ReturnType<typeof setTimeout> | null = null

function msgAnchorId(m: EmMessageItem): string {
  return `em-msg-${m.localId}`
}

function onQuoteClick(m: EmMessageItem): void {
  const q = m.quote
  if (q == null) return
  // quote.msgId 是发送时刻的快照 id：己方消息可能是 localId（发送前），故两个字段都比对
  const target = list.value.find((x) => x.id === q.msgId || x.localId === q.msgId)
  if (target == null) {
    uni.showToast({ title: t('message.quote.notFound'), icon: 'none' })
    return
  }
  const anchor = msgAnchorId(target)
  // 先清再下一帧重设：重复定位同一消息时强制移除/重加高亮类，让 CSS 动画重新触发
  highlightId.value = ''
  if (highlightTimer != null) {
    clearTimeout(highlightTimer)
    highlightTimer = null
  }
  nextTick(() => {
    highlightId.value = target.localId
    highlightTimer = setTimeout(() => {
      highlightId.value = ''
      highlightTimer = null
    }, 3000)
  })
  scrollWithAnimation.value = true
  anchorId.value = ''
  setTimeout(() => {
    anchorId.value = anchor
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
})

// 草稿默认开：输入即存，清空/发送即清；非空输入动作向对方发 typing 信号（chat 层 5s 节流）
watch(draft, (v) => {
  setDraft(props.conversationId, v)
  if (v.trim() !== '') {
    EmKit.sendTyping(props.conversationId).catch(() => {})
  }
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

async function onPickImage(sourceType: 'album' | 'camera' = 'album'): Promise<void> {
  try {
    const images = await chooseImage(1, sourceType)
    if (images.length === 0) return
    await EmKit.sendImage(props.conversationId, images[0])
    scrollToBottom()
  } catch (e) {
    console.error('[emkit] sendImage fail:', e)
  }
}

// 输入栏「+」面板选择（语音由 inputbar 内部消化，这里只有 album/camera/video/file）
async function onMediaSelect(key: string): Promise<void> {
  if (key === MEDIA_PANEL_KEY.ALBUM) {
    await onPickImage()
  } else if (key === MEDIA_PANEL_KEY.CAMERA) {
    await onPickImage('camera')
  } else if (key === MEDIA_PANEL_KEY.VIDEO) {
    await onPickVideo()
  } else if (key === MEDIA_PANEL_KEY.FILE) {
    await onPickFile()
  }
}

async function onPickVideo(): Promise<void> {
  const video = await chooseVideo()
  if (video == null) return
  try {
    await EmKit.sendVideo(props.conversationId, video)
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

async function onVoiceSend(path: string, duration: number): Promise<void> {
  try {
    await EmKit.sendAudio(props.conversationId, path, duration)
    scrollToBottom()
  } catch (e) {
    console.error('[emkit] sendAudio fail:', e)
  }
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

function quoteTextClass(m: EmMessageItem): string {
  return m.self
    ? 'em-chat-page__quote-text em-chat-page__quote-text--self'
    : 'em-chat-page__quote-text'
}

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
  /* 聊天列表隐藏滚动条（对齐微信/vue 版形态）：小程序端由 show-scrollbar 属性控制，
     H5 走 scrollbar-width，不支持的端静默忽略 */
  scrollbar-width: none;
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

/* 引用定位高亮：整行中性灰横带满铺（对齐 vue 版 message-row-flash），
   padding+负 margin 抵消避免布局抖动；脉冲两次→保持→淡出共 2.8s，
   与脚本侧 3000ms 清除计时器对齐。蒸汽端若不支持 @keyframes 则退化为无高亮 */
.em-chat-page__msg--highlight {
  padding: 4px 8px;
  /* 负 margin 抵消 padding 防布局抖动；注意不能用 margin 简写——会覆盖基类的
     margin-bottom: var(--em-message-gap)，行间距塌掉产生跳动（实测踩过） */
  margin-top: -4px;
  margin-bottom: 12px;
  margin-left: -8px;
  margin-right: -8px;
  border-radius: var(--em-radius);
  animation: em-chat-page-row-flash 2.8s ease-in-out forwards;
}

@keyframes em-chat-page-row-flash {
  0% {
    background-color: transparent;
  }
  8%,
  30% {
    background-color: var(--em-bg-hover);
  }
  18% {
    background-color: transparent;
  }
  45%,
  70% {
    background-color: var(--em-bg-hover);
  }
  100% {
    background-color: transparent;
  }
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

/* 引用卡的折叠由 em-text 收口；宿主节点补 flex 约束链（小程序宿主参与 flex 布局，缺了会横向溢出） */
.em-chat-page__quote-host {
  flex: 1;
  min-width: 0;
}

.em-chat-page__quote-text {
  font-size: var(--em-font-size-13);
  line-height: 18px;
  color: var(--em-text-secondary);
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

.em-chat-page__content {
  display: flex;
  flex-direction: column;
  max-width: 70%;
  min-width: 0;
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

/* 气泡行：气泡与状态图标的水平容器，底边对齐——状态图标永远贴着气泡末尾，
   不被引用卡/meta 撑高（vue 版用 ResizeObserver 对齐气泡本体，ucss 下用 flex-end 等价实现）。
   注意：状态图标用绝对定位移出布局流——小程序里组件宿主节点参与 flex 布局且约束链解析不可靠，
   在流内占位会把气泡顶超宽（实测超出正好一个图标位被头像裁切） */
.em-chat-page__bubble-row {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  max-width: 100%;
  position: relative;
}

/* 状态图标（仅己方消息）：绝对定位在气泡左外侧、与气泡底边对齐；不占布局宽度 */
.em-chat-page__state {
  position: absolute;
  right: 100%;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: var(--em-spacing-1);
}

/* 失败红叹号（em-icons 无 circle-bang，info-filled 实心圆点是语义最近的警示形），点击触发重发 */
.em-chat-page__state-icon-failed {
  color: var(--em-danger-color);
}

/* sending 转圈：蒸汽端若不支持 @keyframes 则退化为静态图标，不影响语义 */
.em-chat-page__state-icon-sending {
  animation: em-chat-page-spin 1s linear infinite;
}

/* 已读对勾：弱化灰；未读空心圆：主题色（对齐 vue 版 status-icon--unread 口径） */
.em-chat-page__state-icon--read {
  color: var(--em-text-tertiary);
}

.em-chat-page__state-icon--unread {
  color: var(--em-primary-color);
}

/* typing 提示条：列表顶部居中弱文案（vue 版在 header 副标题区，uni 一期无自绘 header，放页面顶部） */
.em-chat-page__typing {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--em-spacing-1) 0;
}

.em-chat-page__typing-text {
  font-size: var(--em-font-size-12);
  color: var(--em-text-tertiary);
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
</style>
