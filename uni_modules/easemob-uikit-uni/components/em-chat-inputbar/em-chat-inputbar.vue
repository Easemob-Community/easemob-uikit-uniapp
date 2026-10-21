<template>
  <view :class="ns.b()" :style="rootStyle">
    <!-- 快捷回复条（M2.12）：常用语胶囊，点选事件交给父组件（填草稿/直接发送）；禁言态自动隐藏 -->
    <em-quick-reply-bar
      v-if="quickReplies.length > 0 && !disabled"
      :items="quickReplies"
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
      <view
        v-if="hasMediaFeatures"
        :class="[ns.e('tool'), !showVoice && !features.emoji && ns.m('tool-first'), panel === 'media' && ns.m('tool-active')]"
        @click="onToggleMedia"
      >
        <EmIcon name="circle-plus" :size="24" />
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
import { computed, onUnmounted, ref, watch } from 'vue'
import EmIcon from '../em-icon/em-icon.vue'
import EmQuickReplyBar from '../em-quick-reply-bar/em-quick-reply-bar.vue'
import EmText from '../em-text/em-text.vue'
import type { EmIconName } from '../em-icon/em-icons'
import { DEFAULT_EMOJI_LIST, MEDIA_PANEL_KEY, PANEL_MIN_HEIGHT } from '../../libs/constants'
import { PLATFORM_CAPABILITIES, cancelRecord, isRecording, startRecord, stopRecord } from '../../libs/platform'
import { getSafeAreaBottom } from '../../libs/use/useSafeArea'
import { useKeyboardHeight } from '../../libs/use/useKeyboardHeight'
import type { EmInputFeatures, EmQuickReply, EmQuoteInfo } from '../../libs/types'
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
  /** placeholder 覆盖（空串回落内置 chat.placeholder 文案；禁用态父组件传入「全员禁言中」等） */
  placeholder?: string
  /** 快捷回复常用语（M2.12；空数组不渲染，禁用态隐藏）；点击仅 emit，填草稿/发送由父组件决定 */
  quickReplies?: EmQuickReply[]
  /** 外部收起信号：数值变化即收起 emoji/媒体面板并隐藏软键盘（聊天页点击消息区时递增）。
   *  面板状态归组件内部，父级不持有，故用递增信号而非 $refs 调组件实例方法——蒸汽端/小程序/H5 行为一致 */
  collapseSignal?: number
}

const props = withDefaults(defineProps<Props>(), {
  quote: null,
  features: () => ({ voice: true, emoji: true, image: true, camera: true, video: true, file: true }),
  emojis: () => DEFAULT_EMOJI_LIST,
  disabled: false,
  placeholder: '',
  quickReplies: () => [],
  collapseSignal: 0
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

const text = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v)
})

// @ 触发检测：草稿变长且新值以 @ 结尾（尾部追加形态，含粘贴结尾为 @ 的情况；删除到 @ 结尾不触发）
watch(() => props.modelValue, (v, old) => {
  if (v.length > (old ?? '').length && v.endsWith('@')) {
    emit('mention-trigger')
  }
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

// ========== 键盘/面板互斥（对齐 vue 版 h5-input：none/emoji/media 三态，开面板收键盘，聚焦收面板） ==========

const inputFocus = ref(false)
const panel = ref<'none' | 'emoji' | 'media'>('none')
// 输入框真实聚焦态：H5 没有键盘高度监听（useKeyboardHeight 在 WEB 不注册），
// 且部分端键盘已弹起但高度事件未回，收起键盘时需靠它判定是否真要收（见 closeKeyboardIfVisible）
const focused = ref(false)

// 禁言翻转瞬间复位面板/语音/焦点（禁用态 guard 只拦新操作，已开的面板/语音模式需主动收）
watch(() => props.disabled, (v) => {
  if (v) {
    panel.value = 'none'
    exitVoiceMode()
    inputFocus.value = false
  }
})

// 禁用态守卫：任何交互尝试统一 emit disabled-tap（父组件 toast），不改动内部状态
function guardDisabled(): boolean {
  if (props.disabled) {
    emit('disabled-tap')
    return true
  }
  return false
}

// 快捷回复点选：禁用态兜底拦截，其余情况原样上抛（是否发送由父组件 quickReplyMode 决定）
function onQuickReply(item: EmQuickReply): void {
  if (guardDisabled()) return
  emit('quick-reply', item)
}

function onToggleEmoji(): void {
  if (guardDisabled()) return
  const open = panel.value !== 'emoji'
  // 开面板前先收键盘（对齐 vue 版 h5-input：togglePanel 先 blur textarea 再开面板，键盘位与面板位不叠加）
  if (open) closeKeyboardIfVisible()
  panel.value = open ? 'emoji' : 'none'
  if (open) {
    inputFocus.value = false
  }
}

function onInputFocus(): void {
  focused.value = true
  panel.value = 'none'
}

// 手动避让（对齐 hello-uni-app-x keyboard-adjust 示例）：adjust-position 关系统默认上推后，
// 输入栏以 margin-bottom = 键盘实际上推高度顶到键盘上方；blur 清零兜底部分端收起不补发 0 高度事件
function onInputBlur(): void {
  focused.value = false
  resetKeyboardHeight()
}

// 面板高度 = max(最近键盘本体高度, 280px)：真实键盘高于兜底值时面板跟随键盘（对齐 vue 版 panelHeightVar，
// 键盘↔面板互切无跳变）；键盘未弹过则恒为 280，对应 css 中 --em-chat-panel-height 一档已被内联覆盖。
// 注意面板用 keyboardHeight（面板口径）、输入栏上推用 keyboardLift（上推口径：鸿蒙用上报值原值，
// 不扣安全区），两者口径不同，见 useKeyboardHeight 文件头
const { keyboardHeight, keyboardLift, resetKeyboardHeight } = useKeyboardHeight()

// 面板底部安全区（对齐 vue 版 panel 的 safe-bottom padding）
const panelStyle = computed(() => {
  const bottom = getSafeAreaBottom()
  const pad = bottom > 0 ? `padding-bottom: ${bottom}px;` : ''
  return `height: ${Math.max(keyboardHeight.value, PANEL_MIN_HEIGHT)}px;${pad}`
})

// 无面板时输入栏自身贴底，需让出 Home 指示条安全区；面板打开时安全区由面板承担，避免双重间距。
// 键盘弹起时：以键盘实际上推高度顶起（键盘区已覆盖安全区，不再叠加安全区 padding；
// 面板口径与上推口径的差异收口在 useKeyboardHeight 的 keyboardHeight / keyboardLift）
const rootStyle = computed(() => {
  if (keyboardLift.value > 0) return `margin-bottom: ${keyboardLift.value}px;`
  if (panel.value !== 'none') return ''
  const bottom = getSafeAreaBottom()
  return bottom > 0 ? `padding-bottom: ${bottom}px;` : ''
})

// ========== 收起键盘 / 面板 ==========

// 键盘是否可能弹起：上推高度 > 0 是直接证据；H5 不监听键盘高度（见 useKeyboardHeight），靠 focused 兜底
function keyboardMaybeOpen(): boolean {
  return focused.value || keyboardLift.value > 0
}

// 收键盘：先主动清零键盘高度（部分端收起后不补发 0 高度事件，口径同 onInputBlur），再调原生收起。
// uni.hideKeyboard 在 App（含鸿蒙）/H5/微信小程序均实现；H5 实现为 blur 当前 input/DOM 焦点
function closeKeyboard(): void {
  inputFocus.value = false
  focused.value = false
  resetKeyboardHeight()
  uni.hideKeyboard()
}

// 仅在键盘可能弹起时收：面板展开态点工具按钮切换时调用，避免每次开面板都空调一次 hideKeyboard
function closeKeyboardIfVisible(): void {
  if (!keyboardMaybeOpen()) return
  closeKeyboard()
}

// 外部收起（聊天页点击消息区，对齐 vue 版 chat__content 的点击 blur 输入框）：
// 面板 + 键盘一起收；面板本就收起且键盘未弹起时为空操作
function collapseInput(): void {
  panel.value = 'none'
  closeKeyboardIfVisible()
}

watch(() => props.collapseSignal, () => {
  collapseInput()
})

// ========== 发送 ==========

function onSend(): void {
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
    // 平台能力显隐：App 端暂无通用文件选择器，隐藏「文件」入口（能力源见 PLATFORM_CAPABILITIES）
    if (item.key === MEDIA_PANEL_KEY.FILE && !PLATFORM_CAPABILITIES.filePick) return false
    return true
  })
})

// 四个媒体项全关时「+」入口整体隐藏
const hasMediaFeatures = computed(() => mediaItems.value.length > 0)

function onToggleMedia(): void {
  if (guardDisabled()) return
  const open = panel.value !== 'media'
  // 开面板前先收键盘（同 onToggleEmoji 口径）
  if (open) closeKeyboardIfVisible()
  panel.value = open ? 'media' : 'none'
  if (open) {
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
  if (guardDisabled()) return
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

// 录音结果统一出口：手动松开与 60s 自动停止共用（自动停止不再静默丢音频）
function onRecordResult(res: { path: string, duration: number }): void {
  if (res.path === '' || res.duration < 1) {
    uni.showToast({ title: t('chat.voice.tooShort'), icon: 'none' })
    return
  }
  emit('voice-send', res.path, res.duration)
}

function onRecordError(): void {
  recording.value = false
  willCancel.value = false
  voiceMode.value = false
  uni.showToast({ title: t('chat.voice.recordFailed'), icon: 'none' })
}

function onRecordTouchStart(e: TouchEvent): void {
  if (guardDisabled()) return
  if (recording.value) return
  try {
    startRecord({
      onError: onRecordError,
      onAutoStop: (res) => {
        // 到达 60s 上限由 SDK 自动停：复位手势态并按正常语音发送
        recording.value = false
        willCancel.value = false
        onRecordResult(res)
      }
    })
  } catch (err) {
    onRecordError()
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
  stopRecord().then(onRecordResult).catch(onRecordError)
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
@import './em-chat-inputbar.css';
</style>
