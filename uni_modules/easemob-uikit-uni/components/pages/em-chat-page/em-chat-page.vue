<template>
  <view :class="[ns.b(), themeClass]" :style="primaryColorStyle()">
    <!-- 自绘导航栏（pages.json 配 navigationStyle:custom / App titleNView:false），胶囊避让内置于 em-nav-bar -->
    <em-nav-bar
      :title="peerDisplayName"
      :subtitle="headerSubtitle"
      action-icon="more-filled"
      @back="onBack"
      @action="onOpenInfo"
    />

    <!-- 群公告条（仅群聊 + showAnnouncement）：标题 + 单行省略正文，超一行给出展开按钮（全量走 em-popup 弹层） -->
    <view v-if="showAnnouncementBanner" :class="ns.e('announcement')">
      <EmIcon name="notification" :size="14" :class="ns.e('announcement-icon')" />
      <view :class="ns.e('announcement-main')">
        <text :class="ns.e('announcement-title')">{{ t('chat.announcementBanner.title') }}</text>
        <em-text :text="announcement" :text-class="ns.e('announcement-text')" :text-style="announcementTextStyle" :class="ns.e('announcement-host')" />
      </view>
      <view v-if="announcementCanExpand" :class="ns.e('announcement-toggle')" @click="announcementVisible = true">
        <EmIcon name="arrow-down" :size="14" :class="ns.e('announcement-toggle-icon')" />
      </view>
    </view>
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

      <!-- 消息为空的宿主自定义出口（默认 em-empty 空态，宿主可整体覆盖） -->
      <slot v-if="list.length === 0" name="empty">
        <em-empty icon="chatbubble" size="large" :description="t('chat.noMessages')" />
      </slot>

      <view
        v-for="m in list"
        :key="m.localId"
      >
        <!-- 时间分隔条：首条必显，相邻消息间隔超过 uiConfig.timeDividerInterval（默认 5 分钟）插入（对齐 vue 版 message-list divider） -->
        <view v-if="dividerBefore[m.localId] === true" :class="ns.e('divider')">
          <text :class="ns.e('divider-text')">{{ formatDividerTime(m.time) }}</text>
        </view>
        <view
          :id="msgAnchorId(m)"
          :class="[ns.e('msg'), m.self && ns.m('msg-self'), m.status === MESSAGE_STATUS.RECALLED && ns.m('msg-recalled'), highlightId !== '' && highlightId === m.localId && highlightPulseOn && ns.m('msg-highlight')]"
        >
        <view v-if="m.status === MESSAGE_STATUS.RECALLED" :class="ns.e('recalled')">
          <text :class="ns.e('recalled-text')">{{ t('message.recalled') }}</text>
        </view>
        <template v-else>
          <em-avatar :src="avatarOf(m.from)" :name="senderNameOf(m)" :size="36" :shape="avatarShape" />
          <view :class="[ns.e('content'), m.self && ns.m('content-self')]">
            <!-- 群聊发送者昵称行（己方不显示；senderNameMode 控制显隐，伪装模式预留 'on-change' 档） -->
            <em-text v-if="showSenderName(m)" :text="senderNameOf(m)" :text-class="ns.e('sender-name')" :text-style="senderNameTextStyle" :class="ns.e('sender-name-host')" />
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
                :mention-contacts="mentionContacts"
                @long-press="onLongPressMessage"
                @mention-click="onMentionClick"
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
                @preview="onVideoPreview"
                @long-press="onLongPressMessage"
              />
              <em-file-message
                v-else-if="m.type === MESSAGE_TYPE.FILE"
                :message="m"
                @download="onFileDownload"
                @long-press="onLongPressMessage"
              />
              <!-- 未识别消息类型：默认不支持占位气泡，宿主可经 #custom-message 插槽自定义渲染（作用域传 message） -->
              <slot v-else name="custom-message" :message="m">
                <view :class="[ns.e('bubble'), 'em-bubble']">
                  <text :class="ns.e('text')">{{ t('message.unsupported') }}</text>
                </view>
              </slot>
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

      <!-- 滚底锚点：scroll-into-view 定位目标（Android 蒸汽端 scroll-top 超大值只在赋值瞬间钳位、
           内容未布局时钳到 0 且后续不重钳，大值技巧失效；锚点方案同机已被引用定位验证可用） -->
      <view :id="BOTTOM_ANCHOR_ID" :class="ns.e('bottom-anchor')"></view>
    </scroll-view>

    <em-chat-inputbar
      v-model="draft"
      :quote="quoteInfo"
      :features="config.inputFeatures"
      :emojis="config.emojiList"
      @send="onSend"
      @quote-close="quoteInfo = null"
      @media-select="onMediaSelect"
      @voice-send="onVoiceSend"
      @mention-trigger="onMentionTrigger"
    />

    <!-- @提及成员选择面板（仅群聊 + enableMention 时由 mention-trigger 打开；选人后尾部追加 @{name} 空格） -->
    <em-mention-picker
      v-model:show="mentionVisible"
      :contacts="mentionContacts"
      :keyword="mentionKeyword"
      @select="onMentionSelect"
    />

    <em-action-sheet
      :visible="msgSheetVisible"
      :actions="messageActions"
      :title="messageSummary"
      @select="onMessageAction"
      @update:visible="msgSheetVisible = $event"
    />

    <!-- 群公告全文弹层（单行省略态超一行时的展开出口） -->
    <em-popup :visible="announcementVisible" position="center" @update:visible="announcementVisible = $event">
      <view :class="ns.e('announcement-dialog')">
        <text :class="ns.e('announcement-dialog-title')">{{ t('chat.announcementBanner.title') }}</text>
        <scroll-view :class="ns.e('announcement-dialog-scroll')" scroll-y>
          <text :class="ns.e('announcement-dialog-text')">{{ announcement }}</text>
        </scroll-view>
        <view :class="ns.e('announcement-dialog-close')" @click="announcementVisible = false">
          <text :class="ns.e('announcement-dialog-close-text')">{{ t('button.close') }}</text>
        </view>
      </view>
    </em-popup>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import EmAvatar from '../../em-avatar/em-avatar.vue'
import EmEmpty from '../../em-empty/em-empty.vue'
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
import EmPopup from '../../em-popup/em-popup.vue'
import EmMentionPicker from '../../em-mention-picker/em-mention-picker.vue'
import type { EmIconName } from '../../em-icon/em-icons'
import { CONVERSATION_TYPE, MEDIA_PANEL_KEY, MESSAGE_MENU_KEY, MESSAGE_STATUS, MESSAGE_TYPE } from '../../../libs/constants'
import type { ConversationTypeValue } from '../../../libs/constants'
import { EmKit, chooseFile, chooseImage, chooseVideo, previewImage } from '../../../libs'
import { filterActiveMentions } from '../../../libs/utils/mention'
import type { EmActionSheetAction, EmAvatarShape, EmMessageItem, EmQuoteInfo, EmSenderNameMode, MentionContact } from '../../../libs/types'
import { messageStore } from '../../../libs/store/message'
import { primaryColorStyle, useConfig } from '../../../libs/store/config'
import { clearDraft, getDraft, setDraft } from '../../../libs/store/draft'
import { avatarOf, displayNameOf } from '../../../libs/store/user'
import { connectionStore } from '../../../libs/store/connection'
import { groupDisplayNameOf, groupMemberDisplayNameOf, groupStore } from '../../../libs/store/group'
import { useNamespace } from '../../../libs/use/useNamespace'
import { useTheme } from '../../../libs/use/useTheme'
import { useLocale } from '../../../libs/use/useLocale'
import { useKeyboardHeight } from '../../../libs/use/useKeyboardHeight'
import { formatDividerTime } from '../../../libs/utils/time'
import { quoteHasIcon, quoteIconNameOf, quoteSenderOf, quoteSuffixOf, quoteTextClassOf, quoteTextStyleOf } from '../../../libs/utils/quote'
import { createLogger } from '../../../libs/utils/logger'

const logger = createLogger('chat-page')

// scroll-top 初始预置大值：仅作首帧底部方向语义（滚底本体已改走 scroll-into-view 锚点，见 scrollToBottom）
const SCROLL_BOTTOM_TOP = 999999
// 引用定位高亮清除计时（与 CSS 动画 2.8s 对齐，留 200ms 尾量）
const HIGHLIGHT_CLEAR_MS = 3000
// 首帧隐藏兜底：定位指令异常未回时强制显示，防白屏
const READY_FALLBACK_MS = 500
// 历史 prepend 保位锚点清除延时（scroll-into-view 回位后清空，避免残留 id 影响后续定位）
const ANCHOR_CLEAR_MS = 500

defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  conversationId: string
  /** 会话类型（M2.9 起必传，breaking）：单聊/群聊行为分流（typing/已读回执单聊专属，群聊走群数据层） */
  chatType: ConversationTypeValue
  /** 头像形状（透传 em-avatar 的 shape），默认 'circle' */
  avatarShape?: EmAvatarShape
  /** 群聊标题区成员数副标题显隐（仅群聊生效；typing 单聊专属，两态互斥），默认 true */
  showMemberCount?: boolean
  /** 群聊气泡上方发送者昵称行模式（仅群聊生效），默认 'always'；伪装模式二期加 'on-change' 档 */
  senderNameMode?: EmSenderNameMode
  /** 群公告条显隐（仅群聊生效），默认 true */
  showAnnouncement?: boolean
  /** @提及链路开关（仅群聊生效；伪装模式预留位），默认 true */
  enableMention?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  avatarShape: 'circle',
  showMemberCount: true,
  senderNameMode: 'always',
  showAnnouncement: true,
  enableMention: true
})

const emit = defineEmits<{
  // 聊天详情入口（路由跳转由宿主页面接线）
  (e: 'open-info', conversationId: string): void
  // 业务事件透出：行为仍内部调 EmKit 完成，事件仅通知宿主（payload 为发送/操作后的消息项）
  (e: 'send', message: EmMessageItem): void
  (e: 'recall', message: EmMessageItem): void
  (e: 'delete', message: EmMessageItem): void
  // 气泡 @ 片段点击原样透传（宿主可接管跳转成员资料等，默认无行为）
  (e: 'mention-click', userId: string): void
}>()

const ns = useNamespace('chat-page')
const { themeClass } = useTheme()
const { t } = useLocale()
const { config } = useConfig()

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

// 滚底走 scroll-into-view 锚点（底部空 view），不再用 scroll-top 大值交替技巧：
// Android 蒸汽端 scroll-top 只在赋值瞬间按当时内容高度钳位——onMounted 赋值时列表未布局被钳到 0，
// 内容渲染后不会重钳，冷进入永远停顶部（H5/mp 端会重钳所以旧方案在两端有效）。
// scroll-into-view 同值不重触发，先清再设保证连续滚底/重复进入必生效；同机已被引用定位验证可用。
// scroll-top 初始预置值保留（首帧底部方向语义，对锚点无干扰）。
const scrollTopVal = ref(SCROLL_BOTTOM_TOP)
const BOTTOM_ANCHOR_ID = 'em-chat-bottom-anchor'
// 首帧隐藏：消息区先透明，首次滚底定位后下一帧再显示，遮蔽「顶部首帧 → 跳底」视觉残留；500ms 兜底防白屏
const ready = ref(false)

const list = computed<EmMessageItem[]>(() => messageStore.messagesByConversationId[props.conversationId] ?? [])
const hasMore = computed(() => messageStore.hasMoreByConversationId[props.conversationId] === true)

// 时间分隔条：首条必显，之后相邻消息间隔超过 uiConfig.timeDividerInterval（默认 5 分钟）在其前插入
// （对齐 vue 版 shouldShowTimeDivider；间隔可经 EmKitConfig.timeDividerInterval / setConfig 覆盖）
const dividerBefore = computed<Record<string, boolean>>(() => {
  const flags: Record<string, boolean> = {}
  let prev = 0
  list.value.forEach((m) => {
    if (m.time > 0) {
      if (prev === 0 || m.time - prev > config.timeDividerInterval) {
        flags[m.localId] = true
      }
      prev = m.time
    }
  })
  return flags
})

// header 标题：单聊——昵称 > conversationId（资料拉到后自动更新，对齐 vue 版 chat header 标题回落链）；
// 群聊——群数据层 groupDisplayNameOf（拉到即回填，name > groupId）
const isGroupChat = computed(() => props.chatType === CONVERSATION_TYPE.GROUP_CHAT)
const peerDisplayName = computed(() =>
  isGroupChat.value ? groupDisplayNameOf(props.conversationId) : displayNameOf(props.conversationId)
)

// header 副标题（两态互斥）：单聊——对端 typing（chat 层 5s 超时自动消失）；
// 群聊——成员数（showMemberCount 开关，群详情拉到后回填；typing 信令单聊专属不发不收）
const peerTyping = computed(() =>
  !isGroupChat.value && messageStore.peerTypingByConversationId[props.conversationId] === true
)
const memberCount = computed(() => groupStore.infoByGroupId[props.conversationId]?.memberCount ?? 0)
const headerSubtitle = computed(() => {
  if (peerTyping.value) return t('chat.typing')
  if (isGroupChat.value && props.showMemberCount && memberCount.value > 0) {
    return t('chat.memberCount', { count: memberCount.value })
  }
  return ''
})

// 群聊发送者昵称行：群成员名片 > userStore 昵称 > userId（己方消息不显示；单聊不显示）
function senderNameOf(m: EmMessageItem): string {
  return isGroupChat.value ? groupMemberDisplayNameOf(props.conversationId, m.from) : displayNameOf(m.from)
}

const senderNameTextStyle =
  'font-family: var(--em-font-family); font-size: var(--em-font-size-12); line-height: 18px; font-weight: var(--em-font-weight-medium); color: var(--em-text-primary); white-space: nowrap;'

function showSenderName(m: EmMessageItem): boolean {
  return isGroupChat.value && props.senderNameMode === 'always' && !m.self && m.status !== MESSAGE_STATUS.RECALLED
}

// 群公告条：数据读 announcementByGroupId（undefined=未拉取不渲染，进会话时拉取；空串=无公告不渲染）
const announcement = computed(() => groupStore.announcementByGroupId[props.conversationId] ?? '')
const showAnnouncementBanner = computed(() => isGroupChat.value && props.showAnnouncement && announcement.value !== '')
const announcementVisible = ref(false)
const announcementTextStyle =
  'font-family: var(--em-font-family); font-size: var(--em-font-size-12); line-height: 18px; color: var(--em-text-primary); white-space: nowrap;'

// 展开按钮显隐：ucss 无 DOM 测量能力，按窗口宽与字号估算是否超一行
// （CJK 按 1 字宽、其余按 0.55 字宽近似；横幅可用宽 = 屏宽 - 页边距 - 图标/开关占位）
const announcementCanExpand = computed(() => {
  const text = announcement.value
  if (text === '') return false
  if (text.includes('\n')) return true
  const windowWidth = uni.getWindowInfo().windowWidth
  const available = windowWidth - 32 - 14 - 8 - 24 - 12
  let units = 0
  for (const ch of text) {
    units += (ch.charCodeAt(0) > 0xff ? 1 : 0.55)
  }
  return units * 12 > available
})

// ========== @提及链路（仅群聊 + enableMention；单聊全门控，isGroupChat 为唯一分流点） ==========

const mentionVisible = ref(false)
// 本轮草稿中经面板选中的被 @ 成员（与草稿文本解耦维护：用户删掉某个 @名字 不会同步清理，
// 发送前用 filterActiveMentions 精确过滤，防失效 @ 进入 ext.em_at_list）
const mentionedContacts = ref<MentionContact[]>([])

// 面板候选：群成员排除自己，展示名走 groupMemberDisplayNameOf 同链（群名片 > userStore 昵称 > userId）；
// 同时供 em-text-message 的 @名字→userId 点击解析（props 透传，原子组件不连 store）
const mentionContacts = computed<MentionContact[]>(() => {
  if (!isGroupChat.value) return []
  const members = groupStore.memberMapByGroupId[props.conversationId] ?? []
  return members
    .filter((m) => m.userId !== connectionStore.userId)
    .map((m) => ({ userId: m.userId, name: groupMemberDisplayNameOf(props.conversationId, m.userId), avatar: m.avatar }))
})

// @ 触发（inputbar 检测草稿尾部新增 @）：确保群成员已拉（memberMapByGroupId 无则拉首屏）再开面板
function onMentionTrigger(): void {
  if (!isGroupChat.value || !props.enableMention) return
  if (groupStore.memberMapByGroupId[props.conversationId] == null) {
    EmKit.getGroupMemberList(props.conversationId).catch(() => {})
  }
  mentionVisible.value = true
}

// 面板搜索词：面板打开期间取草稿最后一个 @ 之后的尾部（尾部追加模型，uni input 无光标 API）
const mentionKeyword = computed(() => {
  if (!mentionVisible.value) return ''
  const atIdx = draft.value.lastIndexOf('@')
  if (atIdx < 0) return ''
  return draft.value.slice(atIdx + 1)
})

// 草稿里的触发 @ 被删掉、或 @ 后已输入空格（提及输入结束）时自动收面板
watch(draft, (v) => {
  if (!mentionVisible.value) return
  const atIdx = v.lastIndexOf('@')
  if (atIdx < 0 || v.slice(atIdx + 1).includes(' ')) {
    mentionVisible.value = false
  }
})

// 选人：截断到草稿最后一个 @（剥离面板打开期间已输入的 @keyword，对齐 vue 版 insertMention 的
// 「替换已有 @keyword」语义——否则 ...@ab 选人会残留成 ...@ab张三，@ 不紧跟名字，
// filterActiveMentions 精确匹配不到，ext.em_at_list 静默丢失）；
// 草稿中无 @（兜底路径，理论上 trigger 已保证有）退化为尾部追加。
// 尾部追加是 uni input 无光标 API 的物理上限，不做光标定位 hack
function onMentionSelect(contact: MentionContact): void {
  const atIdx = draft.value.lastIndexOf('@')
  draft.value = `${atIdx >= 0 ? draft.value.slice(0, atIdx + 1) : draft.value}${contact.name} `
  if (!mentionedContacts.value.some((c) => c.userId === contact.userId)) {
    mentionedContacts.value = [...mentionedContacts.value, contact]
  }
}

// 气泡 @ 片段点击原样透传（宿主可接管，默认无行为）
function onMentionClick(userId: string): void {
  emit('mention-click', userId)
}

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
  // 单聊已读回执专属：群聊不显示已读态图标（groupAck 不在一期）
  return !isGroupChat.value && EmKit.isReadReceiptEnabled() && m.self && m.status === MESSAGE_STATUS.SENT && m.localId === latestSelfLocalId.value
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
  anchorId.value = ''
  nextTick(() => {
    anchorId.value = BOTTOM_ANCHOR_ID
  })
}

// 软键盘弹起滚底（对齐 vue 版 watch(keyboardHeight) → nextTick 滚动）：adjustResize 下视口被键盘压缩，
// 不滚底用户看到的是上方旧消息；连续双调 + nextTick 兜底蒸汽端键盘重排布局的异步时序
const { keyboardHeight } = useKeyboardHeight()
watch(keyboardHeight, (h, prev) => {
  if (h > 0 && (prev ?? 0) === 0) {
    scrollToBottom()
    nextTick(() => scrollToBottom())
  }
})

// 引用定位：消息行锚点 id + 点击引用卡滚动到原消息并整行闪烁高亮（对齐 vue 版 message-row-flash）；
// 原消息未加载（历史未拉到）或已删除时提示
const highlightId = ref('')
const scrollWithAnimation = ref(false)
// 单个共享计时器，避免连续定位多次堆积；与脉冲序列总时长 2.8s 对齐（3000ms 清除）
let highlightTimer: ReturnType<typeof setTimeout> | null = null
// 脉冲由 JS 定时器驱动：蒸汽端（Android）不跑 CSS @keyframes，动画类退化失效（实测），
// 复刻 vue 版 2.8s 双脉冲时间线（on 0→500、off 500→840、on 840→1960，单位 ms）
const HIGHLIGHT_PULSE_SEQ: ReadonlyArray<readonly [number, boolean]> = [[0, true], [500, false], [840, true], [1960, false]]
const highlightPulseOn = ref(false)
let pulseTimers: Array<ReturnType<typeof setTimeout>> = []

function clearPulseTimers(): void {
  pulseTimers.forEach((timer) => clearTimeout(timer))
  pulseTimers = []
}

function startHighlightPulse(): void {
  clearPulseTimers()
  pulseTimers = HIGHLIGHT_PULSE_SEQ.map(([delay, on]) =>
    setTimeout(() => {
      highlightPulseOn.value = on
    }, delay)
  )
}

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
  // 先清再下一帧重设：重复定位同一消息时强制移除/重加高亮类，让脉冲序列重新触发
  highlightId.value = ''
  if (highlightTimer != null) {
    clearTimeout(highlightTimer)
    highlightTimer = null
  }
  nextTick(() => {
    highlightId.value = target.localId
    startHighlightPulse()
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
  // enableDraft 关时不读入历史草稿（写入口同样在 watch 里 gated）
  if (config.enableDraft) {
    draft.value = getDraft(props.conversationId)?.text ?? ''
  }
  // 进入会话与拉历史并行、不阻塞渲染（对齐 TUIKit：会话页点击时已预热拉取，store 有缓存立即渲染）；
  // 串行 await 是进入停顿的主因，这里只做 fire-and-forget + 完成后滚底
  EmKit.enterConversation(props.conversationId, props.chatType).catch(() => {})
  // 群聊额外预热：群详情 + 成员首屏（昵称行/标题/成员数用），公告未拉则进会话时拉取
  if (isGroupChat.value) {
    EmKit.enterGroup(props.conversationId).catch(() => {})
    if (groupStore.announcementByGroupId[props.conversationId] === undefined) {
      EmKit.getGroupAnnouncement(props.conversationId).catch(() => {})
    }
  }
  // 热启动（预热/二次进入命中缓存）：已有消息立即滚底并显示，不等历史请求回包
  if (list.value.length > 0) {
    scrollToBottom()
    nextTick(() => {
      ready.value = true
    })
  }
  EmKit.loadHistory(props.conversationId, props.chatType)
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
  mentionVisible.value = false
  mentionedContacts.value = []
  clearPulseTimers()
  if (highlightTimer != null) {
    clearTimeout(highlightTimer)
    highlightTimer = null
  }
})

// 草稿默认开（uiConfig.enableDraft，可经 EmKitConfig/setConfig 关闭）：输入即存，清空/发送即清；
// 非空输入动作向对方发 typing 信号（单聊专属，群聊不发 typing；chat 层按 uiConfig.typingThrottle 节流，enableTyping 关闭时全断）
watch(draft, (v) => {
  if (config.enableDraft) {
    setDraft(props.conversationId, v)
  }
  if (config.enableTyping && !isGroupChat.value && v.trim() !== '') {
    EmKit.sendTyping(props.conversationId, props.chatType).catch(() => {})
  }
})

// 切换会话清掉引用条与 mention state
watch(() => props.conversationId, () => {
  quoteInfo.value = null
  mentionVisible.value = false
  mentionedContacts.value = []
})

async function onLoadMore(): Promise<void> {
  if (loadingMore.value) return
  loadingMore.value = true
  // 锚点保位（对齐 TUIKit uniapp 版）：prepend 前记录当前首条消息，加载后 scroll-into-view 回位，
  // 延时清空锚点——消除加载历史时视口被顶动的跳动
  const first = list.value.length > 0 ? list.value[0] : null
  try {
    await EmKit.loadHistory(props.conversationId, props.chatType)
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
  // 发送前过滤已失效的 @（用户删掉了某个 @名字 则不挂）；非空才挂 ext.em_at_list（单聊恒空）
  const mentionIds = isGroupChat.value
    ? filterActiveMentions(text, mentionedContacts.value).map((c) => c.userId)
    : []
  try {
    const item = await EmKit.sendText(props.conversationId, props.chatType, text, quote, mentionIds.length > 0 ? mentionIds : undefined)
    draft.value = ''
    // 发送成功才清引用条与 mention state，失败保留供重发
    quoteInfo.value = null
    mentionedContacts.value = []
    mentionVisible.value = false
    scrollToBottom()
    emit('send', item)
  } catch (e) {
    logger.error('sendText fail:', e)
  }
}

async function onPickImage(sourceType: 'album' | 'camera' = 'album'): Promise<void> {
  try {
    const images = await chooseImage(1, sourceType)
    if (images.length === 0) return
    const item = await EmKit.sendImage(props.conversationId, props.chatType, images[0])
    scrollToBottom()
    emit('send', item)
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
    const item = await EmKit.sendVideo(props.conversationId, props.chatType, video)
    scrollToBottom()
    emit('send', item)
  } catch (e) {
    logger.error('sendVideo fail:', e)
  }
}

async function onPickFile(): Promise<void> {
  const file = await chooseFile()
  if (file == null) return
  try {
    const item = await EmKit.sendFile(props.conversationId, props.chatType, file)
    scrollToBottom()
    emit('send', item)
  } catch (e) {
    logger.error('sendFile fail:', e)
  }
}

async function onVoiceSend(path: string, duration: number): Promise<void> {
  try {
    const item = await EmKit.sendAudio(props.conversationId, props.chatType, path, duration)
    scrollToBottom()
    emit('send', item)
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

// 视频消息点击默认行为（从 em-video-message 上移，组件本身纯 emit 透传，与 em-image-message 对齐）：
// H5 直接新窗口打开流地址；小程序/App 暂无全屏视频预览收口，toast 降级
function onVideoPreview(m: EmMessageItem): void {
  const url = m.url
  if (url === '') return
  // #ifdef WEB
  window.open(url, '_blank')
  // #endif
  // #ifndef WEB
  uni.showToast({ title: t('message.preview.unsupported'), icon: 'none' })
  // #endif
}

// 文件消息点击默认行为（从 em-file-message 上移，组件本身纯 emit 透传）：
// 文件下载/打开一期不做（需要分端落地），点击仅提示
function onFileDownload(m: EmMessageItem): void {
  uni.showToast({ title: t('error.unsupported'), icon: 'none' })
}

// 消息长按菜单（项与顺序经 uiConfig.messageMenuKeys 配置）：复制（仅文本）/ 引用 / 撤回（窗口内）/ 删除（本地）
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

// 消息长按菜单：按 uiConfig.messageMenuKeys 过滤排序（默认 copy/quote/recall/delete 全量）。
// 候选集保留各可用性条件：copy 仅文本；recall 己方已发送且在撤回窗口（uiConfig.recallTimeLimit）内
const messageActions = computed<EmActionSheetAction[]>(() => {
  const m = activeMessage.value
  if (m == null) return []
  const candidates: EmActionSheetAction[] = []
  if (m.type === MESSAGE_TYPE.TEXT) {
    candidates.push({ key: MESSAGE_MENU_KEY.COPY, text: t('message.action.copy'), icon: 'checkbox' })
  }
  candidates.push({ key: MESSAGE_MENU_KEY.QUOTE, text: t('message.action.quote'), icon: 'chatbubble' })
  if (m.self && m.status === MESSAGE_STATUS.SENT && Date.now() - m.time <= config.recallTimeLimit) {
    candidates.push({ key: MESSAGE_MENU_KEY.RECALL, text: t('message.action.recall'), icon: 'undo' })
  }
  candidates.push({ key: MESSAGE_MENU_KEY.DELETE, text: t('message.action.delete'), icon: 'trash', danger: true })
  return config.messageMenuKeys
    .map((key) => candidates.find((a) => a.key === key))
    .filter((a): a is EmActionSheetAction => a != null)
})

function onLongPressMessage(m: EmMessageItem): void {
  activeMessage.value = m
  msgSheetVisible.value = true
}

// 失败重发：点状态列红叹号触发，原地回到 sending，失败再落 failed
async function onResend(m: EmMessageItem): Promise<void> {
  if (m.status !== MESSAGE_STATUS.FAILED) return
  try {
    await EmKit.resendMessage(m.conversationId, m.chatType, m.localId)
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
      await EmKit.recallMessage(m.conversationId, m.chatType, m.id)
      emit('recall', m)
    } catch (e) {
      uni.showToast({ title: t('message.recall.failed'), icon: 'none' })
    }
  } else if (action.key === MESSAGE_MENU_KEY.DELETE) {
    EmKit.deleteLocalMessage(m.conversationId, m.localId)
    emit('delete', m)
  }
}

</script>

<style>
@import './em-chat-page.css';
</style>
