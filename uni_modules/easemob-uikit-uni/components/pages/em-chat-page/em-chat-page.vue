<template>
  <view :class="[ns.b(), themeClass]">
    <!-- 自绘导航栏（pages.json 配 navigationStyle:custom / App titleNView:false），胶囊避让内置于 em-nav-bar -->
    <em-nav-bar
      :title="peerDisplayName"
      :subtitle="peerTyping ? t('chat.typing') : ''"
      action-icon="more-filled"
      @back="onBack"
      @action="onOpenInfo"
    />
    <scroll-view
      :class="ns.e('scroll')"
      scroll-y
      :scroll-top="scrollTopVal"
      :scroll-into-view="anchorId"
      :scroll-with-animation="scrollWithAnimation"
      :show-scrollbar="false"
      :enhanced="true"
      :style="ready ? '' : 'opacity: 0;'"
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
      >
        <!-- 时间分隔条：首条必显，相邻消息间隔超过 TIME_DIVIDER_INTERVAL（5 分钟）插入（对齐 vue 版 message-list divider） -->
        <view v-if="dividerBefore[m.localId] === true" :class="ns.e('divider')">
          <text :class="ns.e('divider-text')">{{ formatDividerTime(m.time) }}</text>
        </view>
        <view
          :id="msgAnchorId(m)"
          :class="[ns.e('msg'), m.self && ns.m('msg-self'), m.status === MESSAGE_STATUS.RECALLED && ns.m('msg-recalled'), highlightId !== '' && highlightId === m.localId && ns.m('msg-highlight')]"
        >
        <view v-if="m.status === MESSAGE_STATUS.RECALLED" :class="ns.e('recalled')">
          <text :class="ns.e('recalled-text')">{{ t('message.recalled') }}</text>
        </view>
        <template v-else>
          <em-avatar :src="avatarOf(m.from)" :name="displayNameOf(m.from)" :size="36" />
          <view :class="[ns.e('content'), m.self && ns.m('content-self')]">
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
                <EmIcon :name="readIconName(m)" :size="14" :class="[ns.e('state-icon'), ns.m(isPeerRead(m) ? 'state-icon-read' : 'state-icon-unread')]" />
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
              <view v-else :class="[ns.e('bubble'), 'em-bubble']">
                <text :class="ns.e('text')">{{ t('message.unsupported') }}</text>
              </view>
            </view>
            <!-- 引用卡：气泡外、气泡下方（对齐 vue 版 quote-card）；己方 row-reverse 竖杠落到右侧；点击定位原消息 -->
            <view v-if="m.quote != null" :class="[ns.e('quote'), m.self && ns.m('quote-self')]" @click="onQuoteClick(m)">
              <view :class="[ns.e('quote-line'), m.self && ns.m('quote-line-self')]"></view>
              <EmIcon v-if="hasQuoteIcon(m)" :name="quoteIconName(m)" :size="13" :class="[ns.e('quote-icon'), m.self && ns.m('quote-icon-self')]" />
              <em-text :lines="2" :text-class="quoteTextClass(m)" :text-style="quoteTextStyle(m)" :class="ns.e('quote-host')">
                <text :class="ns.e('quote-sender')">{{ quoteSender(m) }}</text><text :class="ns.e('quote-preview')">{{ quoteSuffix(m.quote) }}</text>
              </em-text>
            </view>
          </view>
        </template>
        </view>
      </view>
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
import EmAvatar from '../../em-avatar/em-avatar.vue'
import EmIcon from '../../em-icon/em-icon.vue'
import EmActionSheet from '../../em-action-sheet/em-action-sheet.vue'
import EmChatInputbar from '../../em-chat-inputbar/em-chat-inputbar.vue'
import EmText from '../../em-text/em-text.vue'
import EmTextMessage from '../../em-text-message/em-text-message.vue'
import EmImageMessage from '../../em-image-message/em-image-message.vue'
import EmAudioMessage from '../../em-audio-message/em-audio-message.vue'
import EmVideoMessage from '../../em-video-message/em-video-message.vue'
import EmFileMessage from '../../em-file-message/em-file-message.vue'
import EmNavBar from '../../em-nav-bar/em-nav-bar.vue'
import type { EmIconName } from '../../em-icon/em-icons'
import { MEDIA_PANEL_KEY, MESSAGE_MENU_KEY, MESSAGE_STATUS, MESSAGE_TYPE, RECALL_TIME_LIMIT, TIME_DIVIDER_INTERVAL } from '../../../libs/constants'
import { EmKit, chooseFile, chooseImage, chooseVideo, previewImage } from '../../../libs'
import type { EmActionSheetAction, EmMessageItem, EmQuoteInfo } from '../../../libs/types'
import { messageStore } from '../../../libs/store/message'
import { clearDraft, getDraft, setDraft } from '../../../libs/store/draft'
import { avatarOf, displayNameOf } from '../../../libs/store/user'
import { useNamespace } from '../../../libs/use/useNamespace'
import { useTheme } from '../../../libs/use/useTheme'
import { useLocale } from '../../../libs/use/useLocale'
import { formatDividerTime } from '../../../libs/utils/time'
import { quoteHasIcon, quoteIconNameOf, quoteSenderOf, quoteSuffixOf, quoteTextClassOf, quoteTextStyleOf } from '../../../libs/utils/quote'
import { createLogger } from '../../../libs/utils/logger'

const logger = createLogger('chat-page')

// 滚底双大值（scrollTop 数值方案）：两值交替赋值保证必触发（同值不重触发 + 超出 clamp 到底）
const SCROLL_BOTTOM_TOP = 999999
const SCROLL_BOTTOM_ALT = 1000000
// 引用定位高亮清除计时（与 CSS 动画 2.8s 对齐，留 200ms 尾量）
const HIGHLIGHT_CLEAR_MS = 3000
// 首帧隐藏兜底：定位指令异常未回时强制显示，防白屏
const READY_FALLBACK_MS = 500
// 历史 prepend 保位锚点清除延时（scroll-into-view 回位后清空，避免残留 id 影响后续定位）
const ANCHOR_CLEAR_MS = 500

defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  conversationId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  // 聊天详情入口（路由跳转由宿主页面接线）
  (e: 'open-info', conversationId: string): void
}>()

const ns = useNamespace('chat-page')
const { themeClass } = useTheme()
const { t } = useLocale()

function onBack(): void {
  uni.navigateBack({ delta: 1 })
}

function onOpenInfo(): void {
  emit('open-info', props.conversationId)
}

const draft = ref('')
const anchorId = ref('')
const loadingMore = ref(false)

// EmKit.onMessage 注册的滚动回调取消函数：onUnmounted 必须反注册，
// 否则反复进出聊天页 handlers 只增不减，每条消息触发 N 次回调
let unsubscribeMessages: (() => void) | null = null

// 滚底用 scrollTop 数值方案（对齐 TUIKit uniapp 版）：初始预置大值首帧即底部方向；
// 两个大值交替赋值保证必触发（scroll-into-view 同值不重触发 + 超出 clamp 到底），
// 免 SelectorQuery 测 scrollHeight 的跨端时序风险。scroll-into-view 只留给精确锚点（引用定位/历史保位）
const scrollTopVal = ref(SCROLL_BOTTOM_TOP)
// 首帧隐藏：消息区先透明，首次滚底定位后下一帧再显示，遮蔽「顶部首帧 → 跳底」视觉残留；500ms 兜底防白屏
const ready = ref(false)

const list = computed<EmMessageItem[]>(() => messageStore.messagesByConversationId[props.conversationId] ?? [])
const hasMore = computed(() => messageStore.hasMoreByConversationId[props.conversationId] === true)

// 时间分隔条：首条必显，之后相邻消息间隔超过阈值（5 分钟）在其前插入（对齐 vue 版 shouldShowTimeDivider）
const dividerBefore = computed<Record<string, boolean>>(() => {
  const flags: Record<string, boolean> = {}
  let prev = 0
  list.value.forEach((m) => {
    if (m.time > 0) {
      if (prev === 0 || m.time - prev > TIME_DIVIDER_INTERVAL) {
        flags[m.localId] = true
      }
      prev = m.time
    }
  })
  return flags
})

// header 标题：昵称 > conversationId（资料拉到后自动更新，对齐 vue 版 chat header 标题回落链）
const peerDisplayName = computed(() => displayNameOf(props.conversationId))

// 对端 typing 提示（chat 层 5s 超时自动消失）
const peerTyping = computed(() => messageStore.peerTypingByConversationId[props.conversationId] === true)

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
  const readAt = messageStore.peerReadTimeByConversationId[props.conversationId] ?? 0
  return m.time > 0 && readAt >= m.time
}

function readIconName(m: EmMessageItem): EmIconName {
  return isPeerRead(m) ? 'checkmarkempty' : 'circle'
}

function scrollToBottom(): void {
  scrollWithAnimation.value = false
  scrollTopVal.value = scrollTopVal.value >= SCROLL_BOTTOM_ALT ? SCROLL_BOTTOM_TOP : SCROLL_BOTTOM_ALT
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
    }, HIGHLIGHT_CLEAR_MS)
  })
  scrollWithAnimation.value = true
  anchorId.value = ''
  setTimeout(() => {
    anchorId.value = anchor
  }, 50)
}

onMounted(() => {
  draft.value = getDraft(props.conversationId)?.text ?? ''
  // 进入会话与拉历史并行、不阻塞渲染（对齐 TUIKit：会话页点击时已预热拉取，store 有缓存立即渲染）；
  // 串行 await 是进入停顿的主因，这里只做 fire-and-forget + 完成后滚底
  EmKit.enterConversation(props.conversationId).catch(() => {})
  // 热启动（预热/二次进入命中缓存）：已有消息立即滚底并显示，不等历史请求回包
  if (list.value.length > 0) {
    scrollToBottom()
    nextTick(() => {
      ready.value = true
    })
  }
  EmKit.loadHistory(props.conversationId)
    .catch((e) => {
      logger.error('loadHistory fail:', e)
    })
    .finally(() => {
      scrollToBottom()
      // 定位指令发出后的下一帧解除首帧隐藏
      nextTick(() => {
        ready.value = true
      })
    })
  // 异常路径兜底：强制显示，防白屏
  setTimeout(() => {
    ready.value = true
  }, READY_FALLBACK_MS)
  unsubscribeMessages = EmKit.onMessage((msg) => {
    if (msg.conversationId === props.conversationId) {
      scrollToBottom()
    }
  })
})

onUnmounted(() => {
  unsubscribeMessages?.()
  unsubscribeMessages = null
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
  // 锚点保位（对齐 TUIKit uniapp 版）：prepend 前记录当前首条消息，加载后 scroll-into-view 回位，
  // 延时清空锚点——消除加载历史时视口被顶动的跳动
  const first = list.value.length > 0 ? list.value[0] : null
  try {
    await EmKit.loadHistory(props.conversationId)
    if (first != null) {
      const anchor = msgAnchorId(first)
      scrollWithAnimation.value = false
      anchorId.value = ''
      nextTick(() => {
        anchorId.value = anchor
        setTimeout(() => {
          anchorId.value = ''
        }, ANCHOR_CLEAR_MS)
      })
    }
  } catch (e) {
    logger.error('loadHistory fail:', e)
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
    logger.error('sendText fail:', e)
  }
}

async function onPickImage(sourceType: 'album' | 'camera' = 'album'): Promise<void> {
  try {
    const images = await chooseImage(1, sourceType)
    if (images.length === 0) return
    await EmKit.sendImage(props.conversationId, images[0])
    scrollToBottom()
  } catch (e) {
    logger.error('sendImage fail:', e)
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
    logger.error('sendVideo fail:', e)
  }
}

async function onPickFile(): Promise<void> {
  const file = await chooseFile()
  if (file == null) return
  try {
    await EmKit.sendFile(props.conversationId, file)
    scrollToBottom()
  } catch (e) {
    logger.error('sendFile fail:', e)
  }
}

async function onVoiceSend(path: string, duration: number): Promise<void> {
  try {
    await EmKit.sendAudio(props.conversationId, path, duration)
    scrollToBottom()
  } catch (e) {
    logger.error('sendAudio fail:', e)
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

// 引用卡展示映射收口 libs/utils/quote.ts（与输入栏引用条共用纯函数；locale/用户信息/类名注入）
const quoteSuffix = (q: EmQuoteInfo | null): string => quoteSuffixOf(q, t)
const quoteSender = (m: EmMessageItem): string => quoteSenderOf(m.quote?.from ?? '', displayNameOf)
const quoteTextClass = (m: EmMessageItem): string => quoteTextClassOf(m.self, ns.e('quote-text'), ns.m('quote-text-self'))
const quoteTextStyle = (m: EmMessageItem): string => quoteTextStyleOf(m.self)
const hasQuoteIcon = (m: EmMessageItem): boolean => quoteHasIcon(m.quote?.type)
const quoteIconName = (m: EmMessageItem): EmIconName => quoteIconNameOf(m.quote?.type)

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
  if (m.self && m.status === MESSAGE_STATUS.SENT && Date.now() - m.time <= RECALL_TIME_LIMIT) {
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
    logger.error('resendMessage fail:', e)
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
@import './em-chat-page.css';
</style>
