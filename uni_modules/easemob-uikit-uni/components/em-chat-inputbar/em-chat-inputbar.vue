<template>
  <view :class="[ns.b(), customClass]" :style="rootStyle + customStyle">
    <!-- 快捷回复条（M2.12）：常用语胶囊，点选事件交给父组件（填草稿/直接发送）；禁言态自动隐藏 -->
    <em-quick-reply-bar
      v-if="quickReplies.length > 0 && !disabled"
      :items="quickReplies"
      :disabled="submitting"
      @select="onQuickReply"
    />

    <!-- 引用条（对齐 vue 版 quote-bar）：无边框无底色，2px 竖杠 + 摘要单行省略 + 18×18 纯图标关闭 -->
    <view v-if="quote != null" :class="ns.e('quotebar')">
      <view :class="ns.e('quotebar-line')"></view>
      <!-- 引用条类型图标：逐项对齐 vue quote-bar（文本类型也带 circle/quote） -->
      <EmIcon :name="quoteIcon" :size="14" :class="ns.e('quotebar-icon')" />
      <em-text :text-class="ns.e('quotebar-text')" :text-style="quotebarTextStyle" :class="ns.e('quotebar-host')">
        <text :class="ns.e('quotebar-sender')">{{ quoteFrom }}</text><text :class="ns.e('quotebar-preview')">{{ quoteSuffix }}</text>
      </em-text>
      <!-- 关闭键对齐 vue quote-bar：circle/xmark 18，不是弹层通用的 xmark/bold -->
      <view :class="ns.e('quotebar-close')" @click="emit('quote-close')">
        <EmIcon name="circle-xmark" :size="18" />
      </view>
    </view>

    <!-- 录音提示（按住说话时显示，上滑越过阈值切换为取消文案） -->
    <view v-if="recording" :class="ns.e('record-hint')">
      <text :class="[ns.e('record-hint-text'), willCancel && ns.m('record-hint-text-cancel')]">{{ willCancel ? t('chat.voice.releaseToCancel') : t('chat.voice.slideUpCancel') }}</text>
    </view>

    <view :class="ns.e('bar')">
      <view v-if="showVoice" :class="[ns.e('tool'), ns.m('tool-first'), voiceMode && ns.m('tool-active')]" @click="onToggleVoiceMode">
        <EmIcon name="mic" :size="24" />
      </view>
      <view
        v-if="voiceMode"
        :class="[ns.e('record'), recording && ns.m('record-active'), willCancel && ns.m('record-cancel')]"
        @touchstart="onRecordTouchStart"
        @touchmove="onRecordTouchMove"
        @touchend="onRecordTouchEnd"
        @touchcancel="onRecordTouchCancel"
      >
        <text :class="ns.e('record-text')">{{ recording ? t('chat.voice.releaseEnd') : t('chat.voice.holdTalk') }}</text>
      </view>
      <!-- 输入区三态（微信「回车键发送」语义）：
           ① 换行输入模式（sendOnReturn=false，全端）：生长 textarea，回车=换行，发送走栏上纸飞机；
           ② iOS 回车发送：生长 textarea + confirm-type=send——UITextView 粘贴保留换行（单行 input 会剥掉），键盘仍是发送键；
           ③ 单行 input（sendOnReturn=true 的其余端）：零回归，回车发送 -->
      <view v-else-if="growingInput" :class="ns.e('multiline-wrap')" :style="growWrapStyle">
        <textarea
          :class="[ns.e('multiline-input'), disabled && ns.m('input-disabled')]"
          :style="growTextareaStyle"
          v-model="text"
          :focus="inputFocus"
          :placeholder="placeholder !== '' ? placeholder : t('chat.placeholder')"
          :disabled="disabled"
          :auto-height="!growCapped"
          :confirm-type="features.sendOnReturn ? 'send' : 'return'"
          :adjust-position="false"
          :show-confirm-bar="false"
          :disable-default-padding="true"
          @confirm="onComposerConfirm"
          @linechange="onGrowLineChange"
          @focus="onInputFocus"
          @blur="onInputBlur"
        />
      </view>
      <input
        v-else
        :class="[ns.e('input'), disabled && ns.m('input-disabled')]"
        v-model="text"
        :focus="inputFocus"
        :placeholder="placeholder !== '' ? placeholder : t('chat.placeholder')"
        :disabled="disabled"
        confirm-type="send"
        :adjust-position="false"
        @confirm="onSend"
        @focus="onInputFocus"
        @blur="onInputBlur"
      />
      <view v-if="features.emoji" :class="[ns.e('tool'), !showVoice && ns.m('tool-first'), panel === 'emoji' && ns.m('tool-active')]" @click="onToggleEmoji">
        <EmIcon name="circle-face" :size="24" />
      </view>
      <!-- 发送位与「+」互斥同槽（对齐微信手机版：不常驻文字发送按钮，把宽度留给输入区）：
           有可发送草稿 = 纸飞机（品牌色）；草稿为空 =「+」媒体面板入口 -->
      <view
        v-if="hasSendableDraft"
        :class="[ns.e('tool'), !showVoice && !features.emoji && ns.m('tool-first')]"
        @click="onSend"
      >
        <EmIcon name="plane" :size="24" color="var(--em-primary-color)" />
      </view>
      <view
        v-else-if="hasMediaFeatures"
        :class="[ns.e('tool'), !showVoice && !features.emoji && ns.m('tool-first'), panel === 'media' && ns.m('tool-active')]"
        @click="onToggleMedia"
      >
        <EmIcon name="circle-plus" :size="24" />
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
import { computed, ref, toRef, watch } from 'vue'
import EmIcon from '../em-icon/em-icon.vue'
import EmQuickReplyBar from '../em-quick-reply-bar/em-quick-reply-bar.vue'
import EmText from '../em-text/em-text.vue'
import type { EmIconName } from '../em-icon/em-icons'
import { DEFAULT_EMOJI_LIST, MEDIA_PANEL_KEY } from '../../libs/constants'
import { canPickAttachment } from '../../libs/attachment'
import { useChatComposer } from '../../libs/use/useChatComposer'
import type { EmInputFeatures, EmQuickReply, EmQuoteInfo, EmTextareaLineChangeEvent } from '../../libs/types'
import { quoteIconNameOf, quoteSuffixOf } from '../../libs/utils/quote'
import { useNamespace } from '../../libs/use/useNamespace'
import { useLocale } from '../../libs/use/useLocale'

interface Props {
  modelValue: string
  quote: EmQuoteInfo | null
  /** 输入栏功能集（chat-page 从 uiConfig 读出传入；原子组件不连 store），默认全开 */
  features?: EmInputFeatures
  /** emoji 面板字符集，默认内置 96（constants DEFAULT_EMOJI_LIST） */
  emojis?: string[]
  /** 禁用态（全员禁言等）：输入/发送/语音/面板全断，交互尝试统一 emit disabled-tap 由父组件提示 */
  disabled?: boolean
  /** 文本/直发快捷回复提交中：拦截重复 send 与快捷回复点选，默认 false */
  submitting?: boolean
  /** placeholder 覆盖（空串回落内置 chat.placeholder 文案；禁用态父组件传入「全员禁言中」等） */
  placeholder?: string
  /** 快捷回复常用语（M2.12；空数组不渲染，禁用态隐藏）；点击仅 emit，填草稿/发送由父组件决定 */
  quickReplies?: EmQuickReply[]
  /** 外部收起信号：数值变化即收起 emoji/媒体面板并隐藏软键盘（聊天页点击消息区时递增）。
   *  面板状态归组件内部，父级不持有，故用递增信号而非 $refs 调组件实例方法——蒸汽端/小程序/H5 行为一致 */
  collapseSignal?: number
  customClass?: string   // 宿主自定义类，追加到根节点 class（H5 与小程序页面级样式生效；跨端覆盖优先 customStyle）
  customStyle?: string   // 宿主自定义内联样式，拼接到根节点 style 末尾（五端生效，var() 可用）
}

const props = withDefaults(defineProps<Props>(), {
  quote: null,
  features: () => ({ voice: true, emoji: true, image: true, camera: true, video: true, file: true, sendOnReturn: true }),
  emojis: () => DEFAULT_EMOJI_LIST,
  disabled: false,
  submitting: false,
  placeholder: '',
  quickReplies: () => [],
  collapseSignal: 0,
  customClass: '',
  customStyle: ''
})

defineOptions({ styleIsolation: 'app-and-page' })

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'send'): void
  (e: 'quote-close'): void
  (e: 'media-select', key: string): void
  (e: 'voice-send', path: string, duration: number): void
  // 草稿尾部新增 @ 字符时触发（uni input 无光标 API，只支持尾部追加触发，与 emoji 同款限制）；
  // 纯增量事件，是否响应（群聊 @ 提及）由父组件门控
  (e: 'mention-trigger'): void
  // 禁用态下的任何操作尝试（点工具/发送/按住说话），父组件据此 toast 提示
  (e: 'disabled-tap'): void
  // 快捷回复点选：父组件按 quickReplyMode 决定填草稿还是直接发送（M2.12）
  (e: 'quick-reply', item: EmQuickReply): void
}>()

const ns = useNamespace('chat-inputbar')

// H5 端录音尚未接 MediaRecorder（platform.startRecord 在 H5 直接抛错），
// 展示麦克风只会得到「按住→不支持→退出语音模式」的坏体验，故 H5 隐藏语音入口；
// 其余端（App/小程序）保持 features.voice 开关语义。
// #ifdef WEB
const VOICE_SUPPORTED = false
// #endif
// #ifndef WEB
const VOICE_SUPPORTED = true
// #endif

// 引用条文字内联兜底（小程序样式隔离，见 em-text 注释）
const quotebarTextStyle = 'font-size: var(--em-font-size-13); color: var(--em-text-secondary);'
const { t } = useLocale()

const showVoice = computed(() => props.features.voice && VOICE_SUPPORTED)

// 发送位显隐：草稿 trim 后非空才显示纸飞机发送键，空草稿仍显示「+」媒体入口。
// 两者同槽互斥，收起态不再常驻文字「发送」按钮——省出的宽度全部给输入框，
// 也避免空草稿时挂一个点了没反应的蓝色发送键（发送语义与 onSend 的空值拦截保持一致）
const hasSendableDraft = computed(() => props.modelValue.trim() !== '')

const text = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v)
})

// @ 触发检测：草稿变长且新值以 @ 结尾（尾部追加形态，含粘贴结尾为 @ 的情况；删除到 @ 结尾不触发）
// 注：em-chat-page 的 #input-bar 整栏自绘时该检测由页面侧承担（watch draft 同款逻辑），
// 本 emit 服务默认输入栏与 inputbar 独立使用场景
watch(() => props.modelValue, (v, old) => {
  if (v.length > (old ?? '').length && v.endsWith('@')) {
    emit('mention-trigger')
  }
})

// ========== 行为核心：键盘避让 / 键盘↔面板互斥 / 录音手势状态机 / 禁用守卫 ==========
// 单一实现在 libs/use/useChatComposer（em-chat-page 的 #input-bar 整栏自绘插槽复用同一 composable）；
// 本组件只保留渲染与草稿/引用条/媒体项展示逻辑，对外 props/emits 契约不变
const {
  panel,
  inputFocus,
  voiceMode,
  recording,
  willCancel,
  rootStyle,
  panelStyle,
  guardDisabled,
  togglePanel,
  collapse,
  onInputFocus,
  onInputBlur,
  toggleVoiceMode: onToggleVoiceMode,
  onRecordTouchStart,
  onRecordTouchMove,
  onRecordTouchEnd,
  onRecordTouchCancel
} = useChatComposer({
  disabled: toRef(props, 'disabled'),
  onDisabledTap: () => emit('disabled-tap'),
  onVoiceSend: (path, duration) => emit('voice-send', path, duration)
})

function onToggleEmoji(): void {
  togglePanel('emoji')
}

function onToggleMedia(): void {
  togglePanel('media')
}

// 生长输入（textarea 替代单行 input）生效条件：
// - sendOnReturn=false（换行输入模式）：全端生长 textarea，回车=换行，发送走栏上纸飞机；
// - sendOnReturn=true 且 iOS：textarea + confirm-type=send（UITextView 粘贴保留换行、键盘仍是发送键；
//   Android 系统限制 textarea 键盘恒为换行无法发送，故其余端保持单行 input 零回归）
// #ifdef APP-IOS
const GROWING_INPUT_ON_SEND_RETURN = true
// #endif
// #ifndef APP-IOS
const GROWING_INPUT_ON_SEND_RETURN = false
// #endif
const growingInput = computed(() => !props.features.sendOnReturn || GROWING_INPUT_ON_SEND_RETURN)

// 生长输入封装：蒸汽端原生 textarea 布局/事件值不可靠（文字绘制高度 ≠ 布局高度、v-model 可能不回传 \n），
// 全部改 JS 驱动——包裹层高度跟 linechange 上报值走，行数用来封顶 5 行（不信草稿 \n）
const GROW_MAX_LINES = 5
const growLineCount = ref(1)
const growWrapHeight = ref(0) // 最近一次 ≤ 封顶行数的文本高度（px），包裹层高度 = 它 + 包裹层竖直 padding
const growCappedHeight = ref(0) // 封顶后冻结的文本高度（超过 5 行时取最近 ≤5 行的值）

function onGrowLineChange(e: EmTextareaLineChangeEvent): void {
  const lineCount = e.detail?.lineCount ?? 0
  const height = e.detail?.height ?? 0
  if (lineCount > 0) growLineCount.value = lineCount
  if (height > 0 && lineCount <= GROW_MAX_LINES) {
    growWrapHeight.value = height
    growCappedHeight.value = height
  }
}

// 草稿清空时复位生长态（linechange 在删空时可能不回调）
watch(() => props.modelValue, (v) => {
  if (v === '') {
    growLineCount.value = 1
    growWrapHeight.value = 0
    growCappedHeight.value = 0
  }
})

const growCapped = computed(() => growLineCount.value > GROW_MAX_LINES)
// 包裹层高度：未封顶跟内容；封顶冻结在 5 行高度（超出部分 textarea 内部滚动）
const growWrapStyle = computed(() => {
  const h = growCapped.value ? growCappedHeight.value : growWrapHeight.value
  return h > 0 ? `height: ${h}px;` : ''
})
// 封顶后关 auto-height（auto-height 下 style.height 不生效，反过来固定高度才生效）并写死文本高度
const growTextareaStyle = computed(() => {
  if (!growCapped.value || growCappedHeight.value <= 0) return ''
  return `height: ${growCappedHeight.value}px;`
})

// 生长输入的键盘右下角键：回车发送档（iOS）发送；换行输入档不处理（换行键只插换行，发送走栏上纸飞机）
function onComposerConfirm(): void {
  if (!props.features.sendOnReturn) return
  onSend()
}

// 外部收起（聊天页点击消息区递增 collapseSignal）：面板 + 键盘一起收
watch(() => props.collapseSignal, () => {
  collapse()
})

// ========== 引用条显示 ==========

// 引用条展示昵称快照；老数据（无 fromName）回落 userId
const quoteFrom = computed(() => {
  const name = props.quote?.fromName ?? ''
  return name !== '' ? name : (props.quote?.from ?? '')
})
// 引用条展示映射收口 libs/utils/quote.ts（与聊天页引用卡共用纯函数）
const quoteSuffix = computed(() => quoteSuffixOf(props.quote, t))
const quoteIcon = computed<EmIconName>(() => quoteIconNameOf(props.quote?.type))

// ========== 发送 ==========

function onSend(): void {
  if (props.submitting) return
  if (guardDisabled()) return
  if (props.modelValue.trim() === '') return
  panel.value = 'none'
  emit('send')
}

// ========== emoji 面板 ==========

// uni 的 input 跨端拿不到光标位置（selectionStart 是 DOM 概念），一期追加到末尾
function onEmoji(emoji: string): void {
  if (guardDisabled()) return
  emit('update:modelValue', props.modelValue + emoji)
}

// ========== 「+」媒体面板（格子布局，对齐 vue 版 more-grid；语音不进格子，走左侧 mic 切换） ==========

interface MediaItem {
  key: string
  text: string
  icon: EmIconName
  feature: keyof EmInputFeatures
}

// 全部候选按 features 过滤（image/camera/video/file 逐项可关；全开时与现状一致）。
// 候选在 computed 内显式标注 MediaItem[]：经 .filter 后字面量失去 contextual typing，icon 会被放宽成 string
const mediaItems = computed<MediaItem[]>(() => {
  const candidates: MediaItem[] = [
    { key: MEDIA_PANEL_KEY.ALBUM, text: t('chat.media.album'), icon: 'rect-img', feature: 'image' },
    { key: MEDIA_PANEL_KEY.CAMERA, text: t('chat.media.camera'), icon: 'camera', feature: 'camera' },
    { key: MEDIA_PANEL_KEY.VIDEO, text: t('chat.media.video'), icon: 'video', feature: 'video' },
    { key: MEDIA_PANEL_KEY.FILE, text: t('chat.media.file'), icon: 'folder', feature: 'file' }
  ]
  return candidates.filter((item) => {
    if (!props.features[item.feature]) return false
    // 平台能力显隐：内置选择器（H5/小程序）或宿主注入的 App 附件能力二选一；
    // canPickAttachment() 读 reactive provider 状态，注册/注销后「文件」格自动出现/隐藏
    if (item.key === MEDIA_PANEL_KEY.FILE && !canPickAttachment()) return false
    return true
  })
})

// 四个媒体项全关时「+」入口整体隐藏
const hasMediaFeatures = computed(() => mediaItems.value.length > 0)

function onMediaItem(key: string): void {
  panel.value = 'none'
  emit('media-select', key)
}

// 快捷回复点选：提交中/禁用态兜底拦截，其余情况原样上抛（是否发送由父组件 quickReplyMode 决定）
function onQuickReply(item: EmQuickReply): void {
  if (props.submitting) return
  if (guardDisabled()) return
  emit('quick-reply', item)
}
</script>

<style>
@import './em-chat-inputbar.css';
</style>
