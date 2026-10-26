<template>
  <view :class="[ns.b(), customClass]" :style="rootStyle + customStyle">
    <!-- 快捷回复条（M2.12）：常用语胶囊，点选事件交给父组件（填草稿/直接发送）；禁言态自动隐藏 -->
    <em-quick-reply-bar
      v-if="quickReplies.length > 0 && !disabled"
      :items="quickReplies"
      :disabled="submitting"
      @select="onQuickReply"
    />

    <!-- 编辑条（M2.20）：编辑态优先于引用条展示（对齐 vue 版 editing-bar）；
         铅笔图标 + 「编辑消息」+ 原文单行截断 + 关闭（取消编辑退编辑态并清空输入，由父组件处理） -->
    <view v-if="editing != null" :class="ns.e('editbar')">
      <EmIcon name="rect-pencil" :size="14" :class="ns.e('editbar-icon')" />
      <view :class="ns.e('editbar-main')">
        <text :class="ns.e('editbar-title')">{{ t('message.editing') }}</text>
        <text :class="ns.e('editbar-preview')">{{ editing.preview }}</text>
      </view>
      <view :class="ns.e('editbar-close')" @click="emit('edit-close')">
        <EmIcon name="circle-xmark" :size="18" />
      </view>
    </view>

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
      <!-- 包裹层点击转发焦点：灰底比原生 textarea 大一圈（上下 8px、左右 12px padding 不在原生命中区），
           点灰底边缘默认落不到原生输入框上 → 不聚焦、也唤不起键盘（Android 真机实测） -->
      <view v-else-if="growingInput" :class="ns.e('multiline-wrap')" :style="growWrapStyle" @click="requestInputFocus">
        <textarea
          :class="[ns.e('multiline-input'), disabled && ns.m('input-disabled')]"
          :style="growTextareaStyle"
          v-model="text"
          :focus="inputFocus"
          :placeholder="placeholder !== '' ? placeholder : t('chat.placeholder')"
          :disabled="disabled"
          :auto-height="growAutoHeight && !growCapped"
          :confirm-type="features.sendOnReturn ? 'send' : 'return'"
          :adjust-position="false"
          :show-confirm-bar="false"
          :disable-default-padding="true"
          @confirm="onComposerConfirm"
          @linechange="onGrowLineChange"
          @focus="onTextareaFocus"
          @blur="onTextareaBlur"
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
import { computed, nextTick, ref, toRef, watch } from 'vue'
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
  /** 编辑态（M2.20）：非空时输入栏上方展示编辑条（优先于引用条），关闭经 edit-close 交回父组件 */
  editing?: { preview: string } | null
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
  editing: null,
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
  // 编辑条关闭（M2.20）：父组件退编辑态并清空输入（vue 对齐 handleCancelEdit）
  (e: 'edit-close'): void
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
// 全部改 JS 驱动——行数/高度跟 linechange 上报值走，行数用来封顶 5 行（不信草稿 \n）。
// 高度口径（坑集 §5r，改动前先读）：
// - ≤5 行：不写任何高度，交给原生 auto-height + 包裹层自适应（单一口径最稳）；
// - >5 行：关 auto-height、给 textarea 显式高度，包裹层高度 = 文本高度 + 竖直 padding（border-box 下必须自己加，
//   否则 padding 被吃掉、文字顶到灰底边缘）；
// - 封顶高度**恒 > 0**：恢复 >5 行草稿时首个 linechange 就已超行数上限，若只在「≤5 行」时冻结高度，
//   封顶态会拿到高度 0 → 原生 textarea 塌成一条细线、文字溢出、点不聚焦（Android 真机实测，M2.22）。
const GROW_MAX_LINES = 5
// 包裹层竖直 padding 合计（css：上下各 --em-spacing-2 = 8px）
const GROW_WRAP_PAD_Y = 16
// 单行高度兜底：进页回填草稿的首帧还没有 linechange，用兜底行高先把封顶高度算出来，避免首帧塌陷/跳高
const GROW_LINE_FALLBACK = 19

// auto-height 开关：删除整行后原生 textarea 不回缩（Android 侧实测框高停在旧值），
// 关一帧再打开可强制原生重新测量
const growAutoHeight = ref(true)
const growLineCount = ref(1)
const growLineHeight = ref(0) // 单行高度（px），由 height / lineCount 反推（同一事件内自洽，不受 padding 口径影响）
const growTextHeight = ref(0) // 文本区高度（px，不含包裹层 padding）；0 = 还没有可信测量

// 单行高度：优先实测值，没有测量时用兜底常量
function effectiveLineHeight(): number {
  return growLineHeight.value > 0 ? growLineHeight.value : GROW_LINE_FALLBACK
}

// 封顶后的文本区高度：恒 > 0（seed / linechange / 兜底三路都落在 growTextHeight）
const growCappedTextHeight = computed(() => {
  if (growTextHeight.value > 0) return growTextHeight.value
  return Math.round(effectiveLineHeight() * GROW_MAX_LINES)
})

// 是否封顶（行数 > 上限）：所有高度/样式判断的唯一开关
const growCapped = computed(() => growLineCount.value > GROW_MAX_LINES)

function onGrowLineChange(e: EmTextareaLineChangeEvent): void {
  const lineCount = e.detail?.lineCount ?? 0
  const height = e.detail?.height ?? 0
  if (lineCount > 0) growLineCount.value = lineCount
  if (height <= 0) return
  if (lineCount > GROW_MAX_LINES) {
    // 封顶：只有「已知高度还不到封顶高度」时才用本次上报反推（恢复 >5 行草稿、一次粘贴多行都属这类）。
    // 已经到位的封顶高度不再学习——封顶态 textarea 有显式高度，上报值可能停在布局高度/残留值上，
    // 用它反推会把封顶高度越学越大（Android 实测出现过 109 → 166px 的回路）
    const target = Math.round(effectiveLineHeight() * GROW_MAX_LINES)
    if (growTextHeight.value >= target) return
    growLineHeight.value = clampLineHeight(height / lineCount)
    growTextHeight.value = Math.round(effectiveLineHeight() * GROW_MAX_LINES)
    return
  }
  // 未封顶：原生 auto-height 生效，height 就是文本高度（可信），顺便学习单行高度
  growLineHeight.value = clampLineHeight(height / Math.max(1, lineCount))
  growTextHeight.value = height
}

// 单行高度夹在合理区间：字体 14px 的蒸汽端实测约 18.6px，超出 [12, 40] 视为异常上报
function clampLineHeight(value: number): number {
  if (value < 12) return 12
  if (value > 40) return 40
  return value
}

// 生长态复位（草稿清空：linechange 在删空时可能不回调）
function resetGrowState(): void {
  growLineCount.value = 1
  growLineHeight.value = 0
  growTextHeight.value = 0
}

// 进页回填草稿时先估封顶高度：草稿由父组件 onMounted 后回填，linechange 要等原生布局才来，
// 中间那一帧如果按「未知高度」渲染，Android 上会先撑成整段文本高度再塌回封顶高度（可见的高度跳变）。
// 只数硬换行：折行数量必须等原生测量，这里只解决「已知 >5 行」的封顶态首帧。
function seedGrowFromDraft(value: string): void {
  const hardLines = value.split('\n').length
  if (hardLines <= GROW_MAX_LINES) return
  // 已经按同一（或更长）草稿封顶过：交给 linechange 精修，别在每次输入时重置
  if (hardLines <= growLineCount.value) return
  growLineCount.value = hardLines
  growTextHeight.value = Math.round(effectiveLineHeight() * GROW_MAX_LINES)
}

// 删除整行后原生 textarea 的 auto-height 不会回缩（Android 侧行为，实测灰底停在旧高度）：
// 关一帧 auto-height 再打开，逼原生按当前文本重新测量
let growHardLines = 0

function nudgeGrowAutoHeight(): void {
  if (growCapped.value) return
  growAutoHeight.value = false
  nextTick(() => {
    growAutoHeight.value = true
  })
}

watch(() => props.modelValue, (v) => {
  const hardLines = v.split('\n').length
  const shrank = hardLines < growHardLines
  growHardLines = hardLines
  if (v === '') {
    resetGrowState()
    nudgeGrowAutoHeight()
    return
  }
  seedGrowFromDraft(v)
  if (shrank) nudgeGrowAutoHeight()
}, { immediate: true })

// 包裹层高度：未封顶不写（原生 auto-height 是唯一口径，包裹层跟着内容走，删除文字时不会出现
// 「灰底比文字高/矮」的错位）；封顶时 = 文本高度 + 竖直 padding（border-box 下必须自己加）
const growWrapStyle = computed(() => {
  if (!growCapped.value) return ''
  return `height: ${growCappedTextHeight.value + GROW_WRAP_PAD_Y}px;`
})
// 封顶后关 auto-height（auto-height 下 style.height 不生效，反过来固定高度才生效）并写死文本高度
const growTextareaStyle = computed(() => {
  if (!growCapped.value) return ''
  return `height: ${growCappedTextHeight.value}px;`
})

// 原生聚焦态（本地记一份）：包裹层点击转发焦点时用它避免打断已聚焦的输入
const growFocused = ref(false)

function onTextareaFocus(): void {
  growFocused.value = true
  onInputFocus()
}

function onTextareaBlur(): void {
  growFocused.value = false
  onInputBlur()
}

// 灰底 padding 区点击转发焦点（原生 textarea 只覆盖内容区）：
// :focus 是布尔 prop，已是 true 时再赋 true 不会重新请求，故先落 false、nextTick 再置 true；
// 已聚焦时直接跳过（原生自己处理光标/键盘，不打断打字）
function requestInputFocus(): void {
  if (props.disabled) return
  if (growFocused.value) return
  inputFocus.value = false
  nextTick(() => {
    inputFocus.value = true
  })
}

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
