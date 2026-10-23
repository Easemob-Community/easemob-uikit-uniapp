<template>
  <view :class="[ns.b(), themeClass, customClass]" :style="customStyle">
    <!-- primaryColor 内联变量挂内层：蒸汽端同节点 class 变量会顶掉内联变量（坑集 §5k） -->
    <view :class="ns.e('brand-scope')" :style="primaryColorStyle()">
      <!-- 自绘导航栏（pages.json 配 navigationStyle:custom / App titleNView:false），胶囊避让内置于 em-nav-bar -->
      <em-nav-bar
        :title="title !== '' ? title : peerDisplayName"
        :subtitle="headerSubtitle"
        :action-icon="showAction ? 'vertical' : ''"
        @back="onBack"
        @action="onOpenInfo"
      />

      <!-- 连接状态条：重连中/断开/被踢（宿主可 showConnectionBanner=false 关闭） -->
      <em-connection-banner :show="showConnectionBanner" />

      <!-- 业务横幅（#banner）：nav-bar 与群公告条之间的固定区，不随消息滚动；
           医疗病情摘要条/招聘职位条/交易商品条等由宿主渲染（样式与间距宿主自管） -->
      <slot name="banner" />

      <!-- 群公告条（仅群聊 + showAnnouncement）：标题 + 单行省略正文，超一行给出展开按钮（全量走 em-popup 弹层） -->
      <view v-if="showAnnouncementBanner" :class="ns.e('announcement')">
        <EmIcon name="board" :size="14" :class="ns.e('announcement-icon')" />
        <view :class="ns.e('announcement-main')">
          <text :class="ns.e('announcement-title')">{{ t('chat.announcementBanner.title') }}</text>
          <em-text :text="announcement" :text-class="ns.e('announcement-text')" :text-style="announcementTextStyle" :class="ns.e('announcement-host')" />
        </view>
        <view v-if="announcementCanExpand" :class="ns.e('announcement-toggle')" @click="announcementVisible = true">
          <EmIcon name="chevron-down" :size="14" :class="ns.e('announcement-toggle-icon')" />
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
        @scroll="onChatScroll"
        @scrolltolower="onChatScrollToLower"
        @click="onChatAreaClick"
      >
        <view v-if="(historyFailed || loadMoreFailed) && list.length > 0" :class="ns.e('history')" @click="retryHistory">
          <text :class="ns.e('history-text')">{{ t('chat.historyFailedRetry') }}</text>
        </view>
        <view v-else-if="hasMore" :class="ns.e('history')" @click="onLoadMore">
          <text :class="ns.e('history-text')">{{ loadingMore ? t('conversation.loadingMore') : t('chat.loadMoreHistory') }}</text>
        </view>
        <view v-else-if="list.length > 0" :class="ns.e('history')">
          <text :class="ns.e('history-text')">{{ t('conversation.noMoreHistory') }}</text>
        </view>

        <!-- 首屏历史未回包：骨架占位；不显示空态，避免「先闪暂无消息再出消息」 -->
        <view v-if="showHistorySkeleton" :class="ns.e('skeleton')">
          <view v-for="index in 4" :key="index" :class="ns.e('skeleton-row')">
            <em-skeleton variant="avatar" shape="circle" width="36px" height="36px" :class="ns.e('skeleton-avatar')" />
            <view :class="ns.e('skeleton-body')">
              <em-skeleton width="62%" height="14px" :class="ns.e('skeleton-line')" />
              <em-skeleton width="44%" height="14px" />
            </view>
          </view>
        </view>

        <!-- 消息为空的宿主自定义出口（默认 em-empty 空态；必须等首次历史请求成功后才展示） -->
        <slot v-else-if="list.length === 0 && historySettled && !historyFailed && !loadMoreFailed" name="empty">
          <em-empty icon="bubble-rect-2" size="large" :description="t('chat.noMessages')" />
        </slot>

        <!-- 历史失败：toast + 点击重试（已缓存消息时改为顶部重试行，不遮消息） -->
        <view v-else-if="list.length === 0 && (historyFailed || loadMoreFailed)" :class="ns.e('history-error')">
          <em-empty icon="circle-bang" size="large" :description="t('chat.historyFailed')">
            <view :class="ns.e('history-retry')">
              <em-button
                type="outline"
                size="medium"
                pill
                :text="t('chat.retry')"
                :disabled="historyLoading"
                @click="retryHistory"
              />
            </view>
          </em-empty>
        </view>

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
            :class="[ns.e('msg'), m.self && ns.m('msg-self'), (m.status === MESSAGE_STATUS.RECALLED || m.type === MESSAGE_TYPE.NOTICE) && ns.m('msg-recalled'), highlightId !== '' && highlightId === m.localId && highlightPulseOn && ns.m('msg-highlight')]"
          >
          <view v-if="m.status === MESSAGE_STATUS.RECALLED" :class="ns.e('recalled')">
            <text :class="ns.e('recalled-text')">{{ t('message.recalled') }}</text>
          </view>
          <!-- 群系统通知（本地灰条，不落服务端）：居中 chip 形态同撤回提示条；无头像无气泡，长按菜单禁用 -->
          <view v-else-if="m.type === MESSAGE_TYPE.NOTICE" :class="ns.e('notice')">
            <em-text :text="m.text" :text-class="ns.e('notice-text')" :text-style="noticeTextStyle" :class="ns.e('notice-text-host')" />
          </view>
          <template v-else>
            <em-avatar :src="avatarOf(m.from)" :name="senderNameOf(m)" :size="36" :shape="avatarShape" />
            <view :class="[ns.e('content'), m.self && ns.m('content-self')]">
              <!-- 群聊发送者昵称行（己方不显示；senderNameMode 控制显隐，伪装模式预留 'on-change' 档） -->
              <em-text v-if="showSenderName(m)" :text="senderNameOf(m)" :text-class="ns.e('sender-name')" :text-style="senderNameTextStyle" :class="ns.e('sender-name-host')" />
              <!-- 气泡行：状态图标（仅己方）落在气泡末尾左侧、与气泡底边对齐（对齐 vue 版 inline 状态列） -->
              <view :class="ns.e('bubble-row')">
                <view v-if="m.self && m.status === MESSAGE_STATUS.FAILED" :class="ns.e('state')" @click="onResend(m)">
                  <EmIcon name="circle-bang" :size="14" :class="ns.e('state-icon-failed')" />
                </view>
                <view v-else-if="m.self && m.status === MESSAGE_STATUS.SENDING" :class="ns.e('state')">
                  <EmIcon name="loading-arc-normal" :size="14" :class="ns.e('state-icon-sending')" />
                </view>
                <!-- 单聊已读回执：仅最新一条己方已发送消息展示（对齐 vue 版 readIconDisplay 'latest'），未读空心圆/已读对勾 -->
                <view v-else-if="showReadState(m)" :class="ns.e('state')">
                  <EmIcon :name="readIconName(m)" :size="14" :class="[ns.e('state-icon'), ns.m(isPeerRead(m) ? 'state-icon-read' : 'state-icon-unread')]" />
                </view>
                <!-- 富格式流式气泡（customType='markdown' 等）由宿主经 #stream-message 插槽接管；
                     未提供插槽时回落内核纯文本气泡（内容仍随分片增长） -->
                <slot v-if="m.type === MESSAGE_TYPE.TEXT && isRichStream(m.stream)" name="stream-message" :message="m">
                  <em-text-message
                    :message="m"
                    :mention-contacts="mentionContacts"
                    @long-press="onLongPressMessage"
                    @mention-click="onMentionClick"
                  />
                </slot>
                <em-text-message
                  v-else-if="m.type === MESSAGE_TYPE.TEXT"
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
                <!-- 自定义消息（custom）：业务卡片统一出口，宿主经 #custom-message 按 customEvent 判别渲染；
                     外层 view 承接原生 longpress（事件冒泡），宿主卡片内容也能打开长按菜单（业务动作/引用/删除） -->
                <view v-else :class="ns.e('custom')" @longpress="onLongPressMessage(m)">
                  <slot name="custom-message" :message="m">
                    <view :class="[ns.e('bubble'), 'em-bubble']">
                      <text :class="ns.e('text')">{{ m.type === MESSAGE_TYPE.CUSTOM ? t('message.custom') : t('message.unsupported') }}</text>
                    </view>
                  </slot>
                </view>
              </view>
              <!-- 引用卡：气泡外、气泡下方（对齐 vue 版 quote-card）；己方 row-reverse 竖杠落到右侧；点击定位原消息 -->
              <view v-if="m.quote != null" :class="[ns.e('quote'), m.self && ns.m('quote-self')]" @click="onQuoteClick(m)">
                <view :class="[ns.e('quote-line'), m.self && ns.m('quote-line-self')]"></view>
                <EmIcon v-if="hasQuoteIcon(m)" :name="quoteIconName(m)" :size="20" :class="[ns.e('quote-icon'), m.self && ns.m('quote-icon-self')]" />
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

      <!-- 输入栏上方宿主工具条（#input-toolbar）：业务快捷入口固定位，宿主自绘胶囊/按钮
           （发订单、发病例、换手机号等），点击后自行 sendCustom/sendText；随键盘一起上移，不参与消息滚动 -->
      <slot name="input-toolbar" />

      <!-- 整栏自绘（#input-bar，M2.16）：宿主提供插槽时整栏替换默认输入栏，结构/样式任意自绘；
           行为核心（键盘避让/键盘↔面板互斥/录音手势/禁用守卫）由页面侧 composer 承担并经 scope
           （EmChatInputBarScope）透出，壳节点负责键盘顶起与安全区，自绘栏只需绑定 scope 契约 -->
      <view v-if="hasCustomInputBar" :class="ns.e('inputbar-shell')" :style="composerShellStyle">
        <slot
          name="input-bar"
          :draft="draft"
          :set-draft="setDraftValue"
          :quote="quoteInfo"
          :close-quote="closeQuoteInfo"
          :disabled="isMutedAll"
          :notify-disabled-tap="onMuteAllTap"
          :placeholder="isMutedAll ? t('group.muteAllPlaceholder') : ''"
          :features="config.inputFeatures"
          :emojis="config.emojiList"
          :quick-replies="quickReplies"
          :keyboard-lift="composerKeyboardLift"
          :panel="composerPanelState"
          :panel-style="composerPanelStyle"
          :toggle-panel="composerTogglePanel"
          :collapse-panel="composerCollapsePanel"
          :input-focus="composerInputFocus"
          :close-keyboard="composerCloseKeyboard"
          :notify-input-focus="composerNotifyInputFocus"
          :notify-input-blur="composerNotifyInputBlur"
          :voice-mode="composerVoiceMode"
          :recording="composerRecording"
          :will-cancel="composerWillCancel"
          :toggle-voice-mode="composerToggleVoiceMode"
          :on-voice-touch-start="composerVoiceTouchStart"
          :on-voice-touch-move="composerVoiceTouchMove"
          :on-voice-touch-end="composerVoiceTouchEnd"
          :on-voice-touch-cancel="composerVoiceTouchCancel"
          :send="onSend"
          :select-media="onMediaSelect"
          :select-quick-reply="onQuickReply"
        />
      </view>
      <em-chat-inputbar
        v-else
        v-model="draft"
        :quote="quoteInfo"
        :features="config.inputFeatures"
        :emojis="config.emojiList"
        :quick-replies="quickReplies"
        :collapse-signal="inputbarCollapseSignal"
        :disabled="isMutedAll"
        :submitting="sendingText"
        :placeholder="isMutedAll ? t('group.muteAllPlaceholder') : ''"
        @send="onSend"
        @quote-close="quoteInfo = null"
        @media-select="onMediaSelect"
        @voice-send="onVoiceSend"
        @mention-trigger="onMentionTrigger"
        @quick-reply="onQuickReply"
        @disabled-tap="onMuteAllTap"
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

      <!-- 视频全屏预览（App/小程序/H5 统一走原生 video）：打开时先停语音，
           关闭或组件卸载时 video 节点销毁，原生播放器随之释放，不会留后台声音 -->
      <em-video-preview
        :visible="videoPreviewVisible"
        :src="videoPreviewSrc"
        :poster="videoPreviewPoster"
        @update:visible="videoPreviewVisible = $event"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useSlots, watch } from 'vue'
import EmAvatar from '../../em-avatar/em-avatar.vue'
import EmEmpty from '../../em-empty/em-empty.vue'
import EmButton from '../../em-button/em-button.vue'
import EmSkeleton from '../../em-skeleton/em-skeleton.vue'
import EmIcon from '../../em-icon/em-icon.vue'
import EmActionSheet from '../../em-action-sheet/em-action-sheet.vue'
import EmChatInputbar from '../../em-chat-inputbar/em-chat-inputbar.vue'
import EmText from '../../em-text/em-text.vue'
import EmTextMessage from '../../em-text-message/em-text-message.vue'
import EmImageMessage from '../../em-image-message/em-image-message.vue'
import EmAudioMessage from '../../em-audio-message/em-audio-message.vue'
import EmVideoMessage from '../../em-video-message/em-video-message.vue'
import EmVideoPreview from '../../em-video-preview/em-video-preview.vue'
import EmFileMessage from '../../em-file-message/em-file-message.vue'
import EmNavBar from '../../em-nav-bar/em-nav-bar.vue'
import EmConnectionBanner from '../../em-connection-banner/em-connection-banner.vue'
import EmPopup from '../../em-popup/em-popup.vue'
import EmMentionPicker from '../../em-mention-picker/em-mention-picker.vue'
import type { EmIconName } from '../../em-icon/em-icons'
import { CONVERSATION_TYPE, GROUP_MEMBER_ROLE, MEDIA_PANEL_KEY, MESSAGE_MENU_KEY, MESSAGE_STATUS, MESSAGE_TYPE } from '../../../libs/constants'
import type { ConversationTypeValue } from '../../../libs/constants'
import { EmKit, PLATFORM_CAPABILITIES, canPickAttachment, chooseImage, chooseVideo, copyText, getCameraAuthorizeState, openAppAuthorizeSetting, pickAttachments, previewImage, stopAudio } from '../../../libs'
import type { EmCameraAuthorizeState, EmPickedFile } from '../../../libs'
import { filterActiveMentions } from '../../../libs/utils/mention'
import type { EmActionSheetAction, EmAvatarShape, EmChatComposerPanel, EmChatComposerPanelKind, EmChatComposerTouchEvent, EmMessageItem, EmMessageMenuExtra, EmQuickReply, EmQuickReplyMode, EmQuoteInfo, EmSenderNameMode, MentionContact } from '../../../libs/types'
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
import { useChatComposer } from '../../../libs/use/useChatComposer'
import { formatDividerTime } from '../../../libs/utils/time'
import { isRichStream } from '../../../libs/utils/stream'
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
// 流式跟随滚动合批间隔：分片 20 次/秒写 store，滚动再压到 ~8 次/秒，避免高频锚点重定位抖动
const STREAM_SCROLL_INTERVAL = 120

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
  /** 导航栏标题覆盖（空串回落默认昵称链：单聊昵称 > userId；群聊群名 > groupId），如「在线客服」 */
  title?: string
  /** 右上角详情入口显隐（默认 true）；false 时宿主完全接管业务信息页（伪装模式/客服场景） */
  showAction?: boolean
  /** 点击返回时是否由组件执行 `uni.navigateBack`（默认 true）。
   *  false 时只 emit `back`，由宿主决定退场/拦截（表单未保存、业务路由栈等） */
  autoBack?: boolean
  /** 顶部连接状态条显隐，默认 true */
  showConnectionBanner?: boolean
  /** 快捷回复常用语（M2.12）：输入栏上方胶囊条，点击按 quickReplyMode 填草稿或直接发送 */
  quickReplies?: EmQuickReply[]
  /** 快捷回复点击行为，默认 'fill'（替换草稿，用户可编辑后再发）；'send' 直接发送 */
  quickReplyMode?: EmQuickReplyMode
  /** 消息长按菜单追加的业务动作（M2.12）：追加在内置项之后，命中时 emit message-menu 由宿主处理 */
  extraMessageMenus?: EmMessageMenuExtra[]
  customClass?: string   // 宿主自定义类，追加到根节点 class（H5 与小程序页面级样式生效；跨端覆盖优先 customStyle）
  customStyle?: string   // 宿主自定义内联样式，拼接到根节点 style 末尾（五端生效，var() 可用）
}

const props = withDefaults(defineProps<Props>(), {
  avatarShape: 'circle',
  showMemberCount: true,
  senderNameMode: 'always',
  showAnnouncement: true,
  enableMention: true,
  title: '',
  showAction: true,
  autoBack: true,
  showConnectionBanner: true,
  quickReplies: () => [],
  quickReplyMode: 'fill',
  extraMessageMenus: () => [],
  customClass: '',
  customStyle: ''
})

const emit = defineEmits<{
  // 返回上一页：默认组件自行 navigateBack；autoBack=false 时由宿主接管
  (e: 'back'): void
  // 聊天详情入口（路由跳转由宿主页面接线）
  (e: 'open-info', conversationId: string): void
  // 业务事件透出：行为仍内部调 EmKit 完成，事件仅通知宿主（payload 为发送/操作后的消息项）
  (e: 'send', message: EmMessageItem): void
  (e: 'recall', message: EmMessageItem): void
  (e: 'delete', message: EmMessageItem): void
  // 气泡 @ 片段点击原样透传（宿主可接管跳转成员资料等，默认无行为）
  (e: 'mention-click', userId: string): void
  // 自定义长按菜单动作（extraMessageMenus 命中）：业务动作由宿主接管（查看订单/查看处方等）
  (e: 'message-menu', key: string, message: EmMessageItem): void
}>()

const ns = useNamespace('chat-page')
const { themeClass } = useTheme()
const { t } = useLocale()
const { config } = useConfig()

function onBack(): void {
  emit('back')
  if (props.autoBack) {
    uni.navigateBack({ delta: 1 })
  }
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
// 首帧隐藏：消息区先透明，首次滚底定位后下一帧再显示，遮蔽「顶部首帧 → 跳底」视觉残留；
// 500ms 兜底只解 opacity，不把「历史未回包」误判成空态（空态必须等首次历史请求结束）
const ready = ref(false)
const historySettled = ref(false)
const historyFailed = ref(false)
const loadMoreFailed = ref(false)
const historyLoading = ref(false)

const list = computed<EmMessageItem[]>(() => messageStore.messagesByConversationId[props.conversationId] ?? [])
const hasMore = computed(() => messageStore.hasMoreByConversationId[props.conversationId] === true)
// 首次历史未回包且无缓存时用骨架，不用「暂无消息」占位（避免先闪空态再出消息）
const showHistorySkeleton = computed(() => !historySettled.value && list.value.length === 0)

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

// 系统通知灰条文字内联兜底（小程序样式隔离双通道，同 quotebar 口径）
const noticeTextStyle =
  'font-family: var(--em-font-family); font-size: var(--em-font-size-12); line-height: 18px; color: var(--em-text-tertiary); white-space: nowrap;'

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
  // 按码点近似：CJK 1 字宽、其余 0.55；代理对（emoji 等）跳过低位、只计一次。
  // 不用 for-of：App/鸿蒙编译会生成 __values 辅助函数并提升到共享 chunk，
  // 与 store 反向引用形成 ESM 循环（鸿蒙首屏白屏 P0，见 skill em-crossend-pitfalls）
  let units = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) i++
    units += (code > 0xff ? 1 : 0.55)
  }
  return units * 12 > available
})

// ========== 全员禁言禁输入（仅群聊）：group.mute === true 且当前用户非 owner/admin 时输入栏禁用 ==========

// 当前用户群角色：memberMap 为准，owner 字段兜底（成员首屏未回时 owner 不受限）
const selfGroupRole = computed(() => {
  if (!isGroupChat.value) return null
  const members = groupStore.memberMapByGroupId[props.conversationId] ?? []
  return members.find((m) => m.userId === connectionStore.userId)?.role ?? null
})

const isMutedAll = computed(() => {
  if (!isGroupChat.value || connectionStore.userId === '') return false
  const info = groupStore.infoByGroupId[props.conversationId]
  if (info?.mute !== true) return false
  if (info.owner === connectionStore.userId) return false
  return selfGroupRole.value !== GROUP_MEMBER_ROLE.OWNER && selfGroupRole.value !== GROUP_MEMBER_ROLE.ADMIN
})

// 禁用态下的操作尝试（点工具/发送/按住说话）：toast 提示
function onMuteAllTap(): void {
  uni.showToast({ title: t('group.muteAllToast'), icon: 'none' })
}

// ========== #input-bar 整栏自绘（M2.16）==========
// 宿主提供 #input-bar 插槽时整栏替换默认 em-chat-inputbar：结构/样式任意自绘，但行为核心
// （键盘避让/键盘↔面板互斥/录音手势状态机/禁用守卫）由页面侧 composer 承担，状态与动作经
// 插槽 scope（EmChatInputBarScope）透出；壳节点 :style=composerShellStyle 负责键盘顶起与安全区。
// 默认路径（无插槽）渲染 em-chat-inputbar，collapseSignal 模式与此前完全一致（零回归）。
const slots = useSlots()
const hasCustomInputBar = slots['input-bar'] != null
const composer = hasCustomInputBar
  ? useChatComposer({
      disabled: isMutedAll,
      onDisabledTap: onMuteAllTap,
      onVoiceSend: (path, duration) => {
        onVoiceSend(path, duration).catch(() => {})
      }
    })
  : null

// scope 动作：草稿写入（走 draft ref，草稿持久化/typing/@ 检测的 watch 自动生效）
function setDraftValue(v: string): void {
  draft.value = v
}

function closeQuoteInfo(): void {
  quoteInfo.value = null
}

// scope 只读状态（composer 为 null 时给空值，模板 v-if 已保证不渲染，此处仅为类型收窄）
const composerShellStyle = computed(() => composer?.rootStyle.value ?? '')
const composerPanelStyle = computed(() => composer?.panelStyle.value ?? '')
const composerPanelState = computed<EmChatComposerPanel>(() => composer?.panel.value ?? 'none')
const composerKeyboardLift = computed(() => composer?.keyboardLift.value ?? 0)
const composerInputFocus = computed(() => composer?.inputFocus.value ?? false)
const composerVoiceMode = computed(() => composer?.voiceMode.value ?? false)
const composerRecording = computed(() => composer?.recording.value ?? false)
const composerWillCancel = computed(() => composer?.willCancel.value ?? false)

// scope 动作转发（composer 仅整栏自绘时存在）
function composerTogglePanel(kind: EmChatComposerPanelKind): void {
  composer?.togglePanel(kind)
}

function composerCollapsePanel(): void {
  composer?.collapse()
}

function composerCloseKeyboard(): void {
  composer?.closeKeyboard()
}

function composerNotifyInputFocus(): void {
  composer?.onInputFocus()
}

function composerNotifyInputBlur(): void {
  composer?.onInputBlur()
}

function composerToggleVoiceMode(): void {
  composer?.toggleVoiceMode()
}

function composerVoiceTouchStart(e: EmChatComposerTouchEvent): void {
  composer?.onRecordTouchStart(e)
}

function composerVoiceTouchMove(e: EmChatComposerTouchEvent): void {
  composer?.onRecordTouchMove(e)
}

function composerVoiceTouchEnd(): void {
  composer?.onRecordTouchEnd()
}

function composerVoiceTouchCancel(): void {
  composer?.onRecordTouchCancel()
}

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
  if (!isGroupChat.value || !props.enableMention || isMutedAll.value) return
  if (groupStore.memberMapByGroupId[props.conversationId] == null) {
    EmKit.getGroupMemberList(props.conversationId).catch(() => {})
  }
  mentionVisible.value = true
}

// @ 触发检测（仅 #input-bar 整栏自绘路径；默认输入栏路径由 em-chat-inputbar 的 mention-trigger
// emit 驱动，逻辑相同）：草稿变长且新值以 @ 结尾。自绘栏只要经 setDraft 写草稿即自动获得整条 @ 链
if (hasCustomInputBar) {
  watch(draft, (v, old) => {
    if (v.length > (old ?? '').length && v.endsWith('@')) {
      onMentionTrigger()
    }
  })
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

// 已读回执图标逐项对齐 vue message-bubble-wrapper 的 classicStatusIconMap：
// 未读 = circle/empty-1，已读 = circle/checked（原 checkmarkempty / circle 代偿与 vue 字形不一致）
function readIconName(m: EmMessageItem): EmIconName {
  return isPeerRead(m) ? 'circle-checked' : 'circle-empty-1'
}

// ===== 流式消息跟随滚动（M2.13）=====
// 用户上翻阅读时暂停跟随（不把用户拽回底部），回到底部或主动发送时恢复；
// 分片高频更新不直接滚底，统一走 STREAM_SCROLL_INTERVAL 合批，避免锚点重定位抖动。
let streamFollow = true
let streamScrollTimer: ReturnType<typeof setTimeout> | null = null
let lastScrollTop = -1

function onChatScroll(event: { detail: { scrollTop?: number, deltaY?: number } }): void {
  const detail = event.detail
  if (detail == null) return
  if (typeof detail.scrollTop === 'number') {
    // 上翻（scrollTop 减小）即暂停跟随；程序化滚底只会让 scrollTop 增大，不会误停
    if (lastScrollTop >= 0 && detail.scrollTop < lastScrollTop - 2) {
      streamFollow = false
    }
    lastScrollTop = detail.scrollTop
    return
  }
  if (typeof detail.deltaY === 'number' && detail.deltaY < -2) {
    streamFollow = false
  }
}

function onChatScrollToLower(): void {
  streamFollow = true
}

function scheduleStreamScroll(): void {
  if (!streamFollow || streamScrollTimer != null) return
  streamScrollTimer = setTimeout(() => {
    streamScrollTimer = null
    if (streamFollow) {
      scrollToBottom()
    }
  }, STREAM_SCROLL_INTERVAL)
}

function scrollToBottom(): void {
  // 主动贴底（发送/进会话/键盘弹起/普通新消息）恢复跟随；流式 tick 只在 follow=true 时调度
  streamFollow = true
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

// ========== 点击聊天区收起输入栏（emoji/媒体面板 + 软键盘） ==========
// 默认输入栏：面板状态归 em-chat-inputbar 内部，父级不持有，故用递增信号 props 传达一次性「收起」
// 命令（不用 $refs 调子组件方法：蒸汽端/小程序/H5 行为一致）。#input-bar 整栏自绘：状态在页面侧
// composer，直接 collapse。点消息区任意位置即收，对齐 vue 版 chat__content 的 onChatContentClick →
// messageInput.blur()；无展开态时为空操作。
const inputbarCollapseSignal = ref(0)

function onChatAreaClick(): void {
  if (composer != null) {
    composer.collapse()
    return
  }
  inputbarCollapseSignal.value += 1
}

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

// 首次历史加载 / 失败重试共用：historySettled 是空态的唯一开关；
// 失败保留已缓存消息并给 toast + 顶部「点击重试」，不再静默只写 logger
async function loadInitialHistory(): Promise<void> {
  if (historyLoading.value || loadingMore.value) return
  historyLoading.value = true
  historyFailed.value = false
  historySettled.value = false
  try {
    await EmKit.loadHistory(props.conversationId, props.chatType)
  } catch (e) {
    historyFailed.value = true
    logger.error('loadHistory fail:', e)
    uni.showToast({ title: t('chat.historyFailed'), icon: 'none' })
  } finally {
    historySettled.value = true
    historyLoading.value = false
    scrollToBottom()
    // 请求结束后下一帧解除首帧隐藏
    nextTick(() => {
      ready.value = true
    })
  }
}

function retryHistory(): void {
  if (loadMoreFailed.value) {
    onLoadMore().catch(() => {})
    return
  }
  loadInitialHistory().catch(() => {})
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
  loadInitialHistory()
  // 异常路径兜底：只解除首帧透明度，空态/骨架仍以历史请求结果为准，避免「先闪空态再出消息」
  setTimeout(() => {
    ready.value = true
  }, READY_FALLBACK_MS)
  unsubscribeMessages = EmKit.onMessage((msg) => {
    if (msg.conversationId !== props.conversationId) return
    // 流式进度不直接滚底（分片可达 20 次/秒）：交给下方 last.stream.fullText watch 合批跟随
    if (msg.stream != null) return
    // 新消息统一由下方「尾部 localId 变化」watch 滚底（单一路径，避免双 nextTick 抖动）；
    // 这里只兜底「已通知但没进当前列表尾部」的异常场景
    const last = list.value.length > 0 ? list.value[list.value.length - 1] : null
    if (last == null || last.localId !== msg.localId) {
      scrollToBottom()
    }
  })
})

// 消息追加（含宿主向 store 本地注入的演示消息）：只有「列表尾部」变化才滚底；
// 历史 prepend 不改尾部 id，避免加载更多时被误判成新消息而跳到底部
let lastAnchorLocalId = ''
watch(() => {
  const last = list.value.length > 0 ? list.value[list.value.length - 1] : null
  return last != null ? last.localId : ''
}, (id) => {
  if (id === '' || id === lastAnchorLocalId) return
  lastAnchorLocalId = id
  // 流式首气泡到达时若用户正在上翻阅读，不强行拽回底部（普通新消息保持原吸底行为）
  const last = list.value.length > 0 ? list.value[list.value.length - 1] : null
  if (last != null && last.stream != null && !streamFollow) return
  scrollToBottom()
})

// 流式气泡内容增长：分片只改最后一条的内容、不改消息数量，需单独监听（对齐 vue message-list 同款处理）。
// 仅用户位于底部附近时跟随（streamFollow 由滚动事件维护），上翻阅读不被打断
watch(() => {
  const last = list.value.length > 0 ? list.value[list.value.length - 1] : null
  return last != null && last.stream != null ? last.stream.fullText : ''
}, () => {
  if (streamFollow) scheduleStreamScroll()
})

onUnmounted(() => {
  pageGeneration += 1
  unsubscribeMessages?.()
  unsubscribeMessages = null
  // 离页兜底清未读：会话内收到的消息服务端未读可能已累加，不清会随下一次 refreshSessionList 复活
  EmKit.clearConversationUnread(props.conversationId, props.chatType, true)
  EmKit.leaveConversation()
  quoteInfo.value = null
  mentionVisible.value = false
  mentionedContacts.value = []
  clearPulseTimers()
  if (highlightTimer != null) {
    clearTimeout(highlightTimer)
    highlightTimer = null
  }
  if (streamScrollTimer != null) {
    clearTimeout(streamScrollTimer)
    streamScrollTimer = null
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

// 切换会话使旧发送/选择完成回调失效，并允许新会话独立提交。
watch(() => [props.conversationId, props.chatType], () => {
  pageGeneration += 1
  sendingText.value = false
  pickingFile.value = false
  quoteInfo.value = null
  mentionVisible.value = false
  mentionedContacts.value = []
  // 宿主复用同一聊天页切换会话时，不把上一个会话的视频播放器留在屏幕上
  videoPreviewVisible.value = false
  // 会话切换：跟随态与滚动基线复位（新会话首屏必须贴底）
  streamFollow = true
  lastScrollTop = -1
  lastAnchorLocalId = ''
})

async function onLoadMore(): Promise<void> {
  if (loadingMore.value || historyLoading.value) return
  loadingMore.value = true
  loadMoreFailed.value = false
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
    loadMoreFailed.value = true
    logger.error('loadHistory fail:', e)
    uni.showToast({ title: t('chat.historyFailed'), icon: 'none' })
  } finally {
    loadingMore.value = false
  }
}

const sendingText = ref(false)
let pageGeneration = 0

interface ChatPageRequest {
  conversationId: string
  chatType: ConversationTypeValue
  generation: number
}

function capturePageRequest(): ChatPageRequest {
  return { conversationId: props.conversationId, chatType: props.chatType, generation: pageGeneration }
}

function isPageRequestCurrent(request: ChatPageRequest): boolean {
  return request.generation === pageGeneration
    && request.conversationId === props.conversationId
    && request.chatType === props.chatType
}

function releaseUnsentFiles(files: EmPickedFile[], start = 0): void {
  for (let i = start; i < files.length; i++) {
    const file = files[i]
    if (file.temporary !== true || file.release == null) continue
    try {
      file.release(file.path)
    } catch (e) {
      logger.warn('release unsent attachment failed:', file.path, e)
    }
  }
}

async function onSend(): Promise<void> {
  if (sendingText.value) return
  // 全员禁言防御门控（inputbar 禁用态已拦发送动作，此处兜底草稿 confirm 等旁路）
  if (isMutedAll.value) {
    onMuteAllTap()
    return
  }
  const sourceDraft = draft.value
  const text = sourceDraft.trim()
  if (text === '') return
  const sourceQuote = quoteInfo.value
  const sourceMentions = mentionedContacts.value
  const request = capturePageRequest()
  // 发送前过滤已失效的 @（用户删掉了某个 @名字 则不挂）；非空才挂 ext.em_at_list（单聊恒空）
  const mentionIds = request.chatType === CONVERSATION_TYPE.GROUP_CHAT
    ? filterActiveMentions(text, sourceMentions).map((c) => c.userId)
    : []
  sendingText.value = true
  try {
    const item = await EmKit.sendText(request.conversationId, request.chatType, text, sourceQuote ?? undefined, mentionIds.length > 0 ? mentionIds : undefined)
    if (isPageRequestCurrent(request)) {
      // 仅原始输入未被编辑时整体清理；发送期间的新草稿/引用/@选择必须保留。
      if (draft.value === sourceDraft && quoteInfo.value === sourceQuote && mentionedContacts.value === sourceMentions) {
        draft.value = ''
        quoteInfo.value = null
        mentionedContacts.value = []
        mentionVisible.value = false
      }
      scrollToBottom()
    }
    emit('send', item)
  } catch (e) {
    logger.error('sendText fail:', e)
    // 未连上/超时等失败可能根本没进消息列表（没有 FAILED 气泡），必须给用户一个提示
    uni.showToast({ title: t('message.send.failed'), icon: 'none' })
  } finally {
    if (isPageRequestCurrent(request)) sendingText.value = false
  }
}

// ===== 快捷回复（M2.12）：fill=替换草稿（默认，用户可编辑）；send=直接发送（不挂引用/@链路） =====
function quickReplyTextOf(item: EmQuickReply): string {
  return item.text != null && item.text !== '' ? item.text : item.label
}

function onQuickReply(item: EmQuickReply): void {
  if (sendingText.value) return
  if (isMutedAll.value) {
    onMuteAllTap()
    return
  }
  const text = quickReplyTextOf(item)
  if (text.trim() === '') return
  if (props.quickReplyMode === 'send') {
    sendQuickReplyText(text)
  } else {
    // 整句替换而非追加：常用语是完整话术，与已有半句拼接容易出怪文案
    draft.value = text
  }
}

async function sendQuickReplyText(text: string): Promise<void> {
  if (sendingText.value) return
  const request = capturePageRequest()
  sendingText.value = true
  try {
    const item = await EmKit.sendText(request.conversationId, request.chatType, text)
    if (isPageRequestCurrent(request)) scrollToBottom()
    emit('send', item)
  } catch (e) {
    logger.error('sendQuickReply fail:', e)
    uni.showToast({ title: t('message.send.failed'), icon: 'none' })
  } finally {
    if (isPageRequestCurrent(request)) sendingText.value = false
  }
}

async function onPickImage(sourceType: 'album' | 'camera' = 'album'): Promise<void> {
  const request = capturePageRequest()
  // iOS 相机权限被拒后，uni.chooseImage 仍会拉起拍摄页并停在纯黑画面（系统不再弹窗）；
  // 拍摄前先查授权，denied/config error 直接引导去系统设置，不进入黑屏拍摄页。
  // H5/小程序/基座缺模块时 getCameraAuthorizeState() 返回 unknown，行为与原来一致。
  if (sourceType === 'camera') {
    const cameraAuth = getCameraAuthorizeState()
    // 真机黑屏排查：authorized 仍黑说明不是权限层，先看这条日志再查 base/硬件/模拟器
    logger.info('camera authorize state:', cameraAuth)
    if (cameraAuth === 'denied' || cameraAuth === 'config error') {
      showCameraPermissionGuide(cameraAuth)
      return
    }
  }
  // 平台层将用户取消归一为空数组；只有真实选择/读取失败进入 catch。
  const images = await chooseImage(1, sourceType).catch((e) => {
    logger.error('chooseImage fail:', e)
    uni.showToast({ title: t('error.imagePickFailed'), icon: 'none' })
    return null
  })
  if (images == null || images.length === 0 || !isPageRequestCurrent(request)) return
  try {
    const item = await EmKit.sendImage(request.conversationId, request.chatType, images[0])
    if (isPageRequestCurrent(request)) scrollToBottom()
    emit('send', item)
  } catch (e) {
    logger.error('sendImage fail:', e)
    uni.showToast({ title: t('message.send.failed'), icon: 'none' })
  }
}

// 相机授权被拒/安装包缺权限描述：不再拉起系统拍摄页（iOS 会停在黑屏），改为明确引导
function showCameraPermissionGuide(state: EmCameraAuthorizeState): void {
  const configError = state === 'config error'
  const content = configError ? t('chat.cameraPermission.config') : t('chat.cameraPermission.denied')
  uni.showModal({
    title: t('chat.cameraPermission.title'),
    content,
    showCancel: !configError,
    confirmText: configError ? t('button.confirm') : t('chat.cameraPermission.openSetting'),
    success: (res) => {
      if (!res.confirm || configError) return
      openAppAuthorizeSetting()
    }
  })
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
  const request = capturePageRequest()
  const video = await chooseVideo().catch((e) => {
    logger.error('chooseVideo fail:', e)
    uni.showToast({ title: t('error.videoPickFailed'), icon: 'none' })
    return null
  })
  if (video == null || !isPageRequestCurrent(request)) return
  try {
    const item = await EmKit.sendVideo(request.conversationId, request.chatType, video)
    if (isPageRequestCurrent(request)) scrollToBottom()
    emit('send', item)
  } catch (e) {
    logger.error('sendVideo fail:', e)
    uni.showToast({ title: t('message.send.failed'), icon: 'none' })
  }
}

const pickingFile = ref(false)

async function onPickFile(): Promise<void> {
  // 能力门控：内置 H5/小程序选择器或宿主注入的 App 附件 provider；pickingFile 防连点并发
  if (!canPickAttachment() || pickingFile.value) return
  const request = capturePageRequest()
  pickingFile.value = true
  try {
    // 通知宿主选择附件（带会话上下文）；用户取消统一返回 []，不提示
    const files = await pickAttachments({
      conversationId: request.conversationId,
      chatType: request.chatType,
      multiple: true
    })
    if (files.length === 0) return
    if (!isPageRequestCurrent(request)) {
      releaseUnsentFiles(files)
      return
    }
    let failed = false
    // 多选按顺序逐条发送；切会话后未开始发送的临时文件立即释放。
    for (let i = 0; i < files.length; i++) {
      if (!isPageRequestCurrent(request)) {
        releaseUnsentFiles(files, i)
        return
      }
      try {
        const item = await EmKit.sendFile(request.conversationId, request.chatType, files[i])
        if (isPageRequestCurrent(request)) scrollToBottom()
        emit('send', item)
      } catch (e) {
        failed = true
        logger.error('sendFile fail:', e)
      }
    }
    if (failed) uni.showToast({ title: t('message.send.failed'), icon: 'none' })
  } catch (e) {
    // provider 选择/读取失败（用户取消不会走这里）
    logger.error('pick file fail:', e)
    uni.showToast({ title: t('error.filePickFailed'), icon: 'none' })
  } finally {
    if (isPageRequestCurrent(request)) pickingFile.value = false
  }
}

async function onVoiceSend(path: string, duration: number): Promise<void> {
  const request = capturePageRequest()
  try {
    const item = await EmKit.sendAudio(request.conversationId, request.chatType, path, duration)
    if (isPageRequestCurrent(request)) scrollToBottom()
    emit('send', item)
  } catch (e) {
    logger.error('sendAudio fail:', e)
    uni.showToast({ title: t('message.send.failed'), icon: 'none' })
  }
}

function onPreview(m: EmMessageItem): void {
  const url = m.url !== '' ? m.url : m.thumbUrl
  if (url !== '') {
    previewImage([url], url)
  }
}

// 视频全屏预览状态（App/小程序/H5 统一）：url/poster 为空时不上屏
const videoPreviewVisible = ref(false)
const videoPreviewSrc = ref('')
const videoPreviewPoster = ref('')

// 视频消息点击默认行为（从 em-video-message 上移，组件本身纯 emit 透传，与 em-image-message 对齐）：
// 全端打开内置全屏播放器；URL 缺失时不打开空播放器。打开前停掉正在播放的语音，避免两路声音叠加。
function onVideoPreview(m: EmMessageItem): void {
  if (!PLATFORM_CAPABILITIES.videoPreview) return
  if (m.url === '') return
  stopAudio()
  videoPreviewSrc.value = m.url
  videoPreviewPoster.value = m.thumbUrl
  videoPreviewVisible.value = true
}

// 文件消息点击默认行为（从 em-file-message 上移，组件本身纯 emit 透传）：
// 文件打开/下载一期全端未接（platform.fileOpen=false），气泡侧不发事件；接入后在此实现下载/打开。
function onFileDownload(m: EmMessageItem): void {
  if (!PLATFORM_CAPABILITIES.fileOpen) return
}

// 消息长按菜单（项与顺序经 uiConfig.messageMenuKeys 配置）：复制（仅文本）/ 引用 / 撤回（窗口内）/ 删除（漫游 + 本地）
const msgSheetVisible = ref(false)
const activeMessage = ref<EmMessageItem | null>(null)
// 引用目标快照（选择引用时生成，发送成功/手动关闭/切会话时清除）
const quoteInfo = ref<EmQuoteInfo | null>(null)

// 引用卡展示映射收口 libs/utils/quote.ts（与输入栏引用条共用纯函数；locale/用户信息/类名注入）
const quoteSuffix = (q: EmQuoteInfo | null): string => quoteSuffixOf(q, t)
const quoteSender = (m: EmMessageItem): string => quoteSenderOf(m.quote, displayNameOf)
const quoteTextClass = (m: EmMessageItem): string => quoteTextClassOf(m.self, ns.e('quote-text'), ns.m('quote-text-self'))
const quoteTextStyle = (m: EmMessageItem): string => quoteTextStyleOf(m.self)
const hasQuoteIcon = (m: EmMessageItem): boolean => quoteHasIcon(m.quote?.type)
const quoteIconName = (m: EmMessageItem): EmIconName => quoteIconNameOf(m.quote?.type)

const messageSummary = computed(() => {
  const m = activeMessage.value
  if (m == null) return ''
  if (m.type === MESSAGE_TYPE.TEXT) return m.text.slice(0, 20)
  if (m.type === MESSAGE_TYPE.IMAGE) return t('message.image')
  if (m.type === MESSAGE_TYPE.AUDIO) return t('message.audio')
  if (m.type === MESSAGE_TYPE.VIDEO) return t('message.video')
  if (m.type === MESSAGE_TYPE.FILE) return m.fileName !== '' ? m.fileName : t('message.file')
  if (m.type === MESSAGE_TYPE.CUSTOM) return t('message.custom')
  return t('message.unsupported')
})

// 消息长按菜单：按 uiConfig.messageMenuKeys 过滤排序（默认 copy/quote/recall/delete 全量）。
// 候选集保留各可用性条件：copy 仅文本；recall 己方已发送且在撤回窗口（uiConfig.recallTimeLimit）内。
// 业务追加动作（extraMessageMenus）排在配置项之后：内置 key 保留不可覆盖，types 可限定消息类型。
const messageActions = computed<EmActionSheetAction[]>(() => {
  const m = activeMessage.value
  if (m == null) return []
  // 系统通知灰条：撤回/引用等菜单整体禁用（本地条目，无服务端语义），业务动作同样不出现
  if (m.type === MESSAGE_TYPE.NOTICE) return []
  const candidates: EmActionSheetAction[] = []
  if (m.type === MESSAGE_TYPE.TEXT) {
    candidates.push({ key: MESSAGE_MENU_KEY.COPY, text: t('message.action.copy'), icon: 'rects' })
  }
  candidates.push({ key: MESSAGE_MENU_KEY.QUOTE, text: t('message.action.quote'), icon: 'arrow-turn-left' })
  if (m.self && m.status === MESSAGE_STATUS.SENT && Date.now() - m.time <= config.recallTimeLimit) {
    candidates.push({ key: MESSAGE_MENU_KEY.RECALL, text: t('message.action.recall'), icon: 'arrow-lft-uturn' })
  }
  candidates.push({ key: MESSAGE_MENU_KEY.DELETE, text: t('message.action.delete'), icon: 'trash', danger: true })
  const builtin = config.messageMenuKeys
    .map((key) => candidates.find((a) => a.key === key))
    .filter((a): a is EmActionSheetAction => a != null)
  const extras = extraMessageActionsOf(m)
  if (extras.length === 0) return builtin
  // 删除项保持末位（危险操作不被业务项挤到中间）；其余业务项排在内置项之后
  const last = builtin.length > 0 ? builtin[builtin.length - 1] : null
  if (last != null && last.key === MESSAGE_MENU_KEY.DELETE) {
    return [...builtin.slice(0, builtin.length - 1), ...extras, last]
  }
  return [...builtin, ...extras]
})

// 内置菜单 key 保留（业务追加项同名会被忽略，防宿主误覆盖复制/撤回等语义）
function isBuiltinMenuKey(key: string): boolean {
  return key === MESSAGE_MENU_KEY.COPY || key === MESSAGE_MENU_KEY.QUOTE || key === MESSAGE_MENU_KEY.RECALL || key === MESSAGE_MENU_KEY.DELETE
}

function extraMessageActionsOf(m: EmMessageItem): EmActionSheetAction[] {
  return props.extraMessageMenus
    .filter((item) => !isBuiltinMenuKey(item.key))
    .filter((item) => item.types == null || item.types.length === 0 || item.types.includes(m.type))
    .map((item) => ({ key: item.key, text: item.text, icon: item.icon, danger: item.danger, disabled: item.disabled }))
}

function onLongPressMessage(m: EmMessageItem): void {
  activeMessage.value = m
  msgSheetVisible.value = true
}

const resendingByLocalId: Record<string, boolean> = {}
const recallingByLocalId: Record<string, boolean> = {}
const deletingByLocalId: Record<string, boolean> = {}

// 失败重发：点状态列红叹号触发，等待 SDK 就绪前即按 localId 占锁，失败再落 failed 并允许重试
async function onResend(m: EmMessageItem): Promise<void> {
  if (m.status !== MESSAGE_STATUS.FAILED || resendingByLocalId[m.localId] === true) return
  resendingByLocalId[m.localId] = true
  try {
    await EmKit.resendMessage(m.conversationId, m.chatType, m.localId)
    scrollToBottom()
  } catch (e) {
    logger.error('resendMessage fail:', e)
    uni.showToast({ title: t('message.send.failed'), icon: 'none' })
  } finally {
    delete resendingByLocalId[m.localId]
  }
}

async function recallMessage(m: EmMessageItem): Promise<void> {
  if (recallingByLocalId[m.localId] === true) return
  // 菜单打开后也可能跨过撤回窗口，执行时重查而不是只依赖菜单生成时的条件
  if (Date.now() - m.time > config.recallTimeLimit) {
    uni.showToast({ title: t('message.recall.timeLimit'), icon: 'none' })
    return
  }
  recallingByLocalId[m.localId] = true
  try {
    await EmKit.recallMessage(m.conversationId, m.chatType, m.id)
    emit('recall', m)
  } catch (e) {
    uni.showToast({ title: t('message.recall.failed'), icon: 'none' })
  } finally {
    delete recallingByLocalId[m.localId]
  }
}

function confirmDeleteMessage(m: EmMessageItem): void {
  uni.showModal({
    title: t('message.action.delete'),
    content: t('message.delete.confirm'),
    success: (res) => {
      if (!res.confirm) return
      void deleteMessage(m)
    }
  })
}

async function deleteMessage(m: EmMessageItem): Promise<void> {
  if (deletingByLocalId[m.localId] === true) return
  deletingByLocalId[m.localId] = true
  try {
    await EmKit.deleteMessage(m)
    // 成功反馈就是气泡消失；失败保留气泡且不向宿主派发完成事件
    emit('delete', m)
  } catch (e) {
    logger.error('deleteMessage fail:', e)
    uni.showToast({ title: t('message.delete.failed'), icon: 'none' })
  } finally {
    delete deletingByLocalId[m.localId]
  }
}

async function onMessageAction(action: EmActionSheetAction): Promise<void> {
  const m = activeMessage.value
  if (m == null) return
  // 业务追加动作（非内置 key）：菜单已由 em-action-sheet 关闭，动作原样交宿主（查看订单/查看处方等）
  if (!isBuiltinMenuKey(action.key)) {
    emit('message-menu', action.key, m)
    return
  }
  if (action.key === MESSAGE_MENU_KEY.COPY) {
    try {
      await copyText(m.text)
      uni.showToast({ title: t('message.copySuccess'), icon: 'none' })
    } catch (e) {
      uni.showToast({ title: t('message.copyFailed'), icon: 'none' })
    }
  } else if (action.key === MESSAGE_MENU_KEY.QUOTE) {
    quoteInfo.value = EmKit.makeQuote(m)
  } else if (action.key === MESSAGE_MENU_KEY.RECALL) {
    await recallMessage(m)
  } else if (action.key === MESSAGE_MENU_KEY.DELETE) {
    confirmDeleteMessage(m)
  }
}

</script>

<style>
@import './em-chat-page.css';
</style>
