<template>
  <!-- Demo 宿主自绘整栏输入栏（不进 UIKit）：注入 em-chat-page 的 #input-bar 插槽。
       演示「约束式整栏替换」：结构/样式全自绘，但行为全部经 scope（EmChatInputBarScope）驱动——
       键盘避让（页面壳承担）、键盘↔面板互斥、录音手势状态机、禁言、@ 提及、草稿持久化、
       引用/发送链路由库内保持运作。业务方可在自己项目里照抄这个组件。 -->
  <view :class="ns.b()">
    <!-- 快捷回复（scope.quickReplies）：点击走 scope.selectQuickReply（fill/send 由页面 quickReplyMode 决定） -->
    <scroll-view v-if="scope.quickReplies.length > 0 && !scope.disabled" scroll-x :show-scrollbar="false" :class="ns.e('quick')">
      <view :class="ns.e('quick-track')">
        <view v-for="item in scope.quickReplies" :key="item.label" :class="ns.e('quick-chip')" @click="scope.selectQuickReply(item)">
          <text :class="ns.e('quick-chip-text')">{{ item.label }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 引用条（scope.quote）：关闭走 scope.closeQuote -->
    <view v-if="scope.quote != null" :class="ns.e('quote')">
      <view :class="ns.e('quote-line')"></view>
      <text :class="ns.e('quote-text')">{{ quoteLabel }}</text>
      <view :class="ns.e('quote-close')" @click="scope.closeQuote">
        <EmIcon name="xmark-bold" :size="14" />
      </view>
    </view>

    <!-- 录音提示（scope.recording / willCancel 由库内录音状态机驱动） -->
    <view v-if="scope.recording" :class="ns.e('record-hint')">
      <text :class="ns.e('record-hint-text')">{{ scope.willCancel ? '松开手指，取消发送' : '上滑取消' }}</text>
    </view>

    <view :class="ns.e('bar')">
      <view v-if="scope.features.voice" :class="ns.e('tool')" @click="scope.toggleVoiceMode">
        <EmIcon name="mic" :size="22" />
      </view>
      <!-- 按住说话：四个手势事件直接绑 scope 处理函数（60s 自动停/过短拦截/上滑取消内置） -->
      <view
        v-if="scope.voiceMode"
        :class="[ns.e('record'), scope.recording && ns.m('record-active'), scope.willCancel && ns.m('record-cancel')]"
        @touchstart="scope.onVoiceTouchStart"
        @touchmove="scope.onVoiceTouchMove"
        @touchend="scope.onVoiceTouchEnd"
        @touchcancel="scope.onVoiceTouchCancel"
      >
        <text :class="ns.e('record-text')">{{ scope.recording ? '松开 发送' : '按住 说话' }}</text>
      </view>
      <!-- 自绘输入框：:value + @input 走 scope.setDraft；focus/blur 必须上报（面板/键盘互斥依赖） -->
      <input
        v-else
        :class="ns.e('input')"
        :value="scope.draft"
        :focus="scope.inputFocus"
        :placeholder="scope.placeholder !== '' ? scope.placeholder : '说一句…'"
        :disabled="scope.disabled"
        confirm-type="send"
        :adjust-position="false"
        @input="onInput"
        @confirm="onSend"
        @focus="scope.notifyInputFocus"
        @blur="scope.notifyInputBlur"
      />
      <view v-if="scope.features.emoji" :class="[ns.e('tool'), scope.panel === 'emoji' && ns.m('tool-active')]" @click="scope.togglePanel('emoji')">
        <EmIcon name="circle-face" :size="22" />
      </view>
      <view :class="[ns.e('tool'), scope.panel === 'media' && ns.m('tool-active')]" @click="scope.togglePanel('media')">
        <EmIcon name="circle-plus" :size="22" />
      </view>
      <view :class="ns.e('send')" @click="onSend">
        <text :class="ns.e('send-text')">发送</text>
      </view>
    </view>

    <!-- 底部面板：高度/安全区直接绑 scope.panelStyle（跟随最近键盘高度，互切不跳变） -->
    <view v-if="scope.panel === 'emoji'" :class="ns.e('panel')" :style="scope.panelStyle">
      <scroll-view scroll-y :class="ns.e('emoji-scroll')">
        <view :class="ns.e('emoji-grid')">
          <view v-for="emoji in scope.emojis" :key="emoji" :class="ns.e('emoji-cell')" @click="onEmoji(emoji)">
            <text :class="ns.e('emoji-char')">{{ emoji }}</text>
          </view>
        </view>
      </scroll-view>
    </view>
    <view v-else-if="scope.panel === 'media'" :class="ns.e('panel')" :style="scope.panelStyle">
      <view :class="ns.e('media-grid')">
        <view v-for="item in mediaItems" :key="item.key" :class="ns.e('media-item')" @click="onMedia(item.key)">
          <view :class="ns.e('media-tile')">
            <EmIcon :name="item.icon" :size="24" />
          </view>
          <text :class="ns.e('media-label')">{{ item.text }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import EmIcon from '@/uni_modules/easemob-uikit-uni/components/em-icon/em-icon.vue'
import type { EmIconName } from '@/uni_modules/easemob-uikit-uni/components/em-icon/em-icons'
import { MEDIA_PANEL_KEY } from '@/uni_modules/easemob-uikit-uni/libs'
import type { EmChatInputBarScope, EmInputFeatures } from '@/uni_modules/easemob-uikit-uni/libs'

// 与 demo-composer-bar 同约定：app-and-page 隔离、不写 scoped、本地 BEM（demo- 前缀）
defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  /** em-chat-page #input-bar 插槽透出的完整 scope（EmChatInputBarScope 契约） */
  scope: EmChatInputBarScope
}

const props = defineProps<Props>()

const ns = {
  b: () => 'demo-inputbar',
  e: (element: string) => `demo-inputbar__${element}`,
  m: (modifier: string) => `demo-inputbar--${modifier}`
}

const quoteLabel = computed(() => {
  const q = props.scope.quote
  if (q == null) return ''
  const from = q.fromName != null && q.fromName !== '' ? q.fromName : q.from
  return `${from}：${q.text}`
})

// 禁用态操作统一先上报（页面 toast「全员禁言中」），与默认输入栏的 disabled-tap 出口一致
function guardDisabled(): boolean {
  if (props.scope.disabled) {
    props.scope.notifyDisabledTap()
    return true
  }
  return false
}

// 草稿写回必须走 scope.setDraft：草稿持久化 / typing 信号 / @ 尾部触发检测都由页面侧 watch 驱动
function onInput(e: { detail: { value: string } }): void {
  props.scope.setDraft(e.detail.value)
}

// 发送：空草稿拦截、引用/@ext 挂载、清草稿、滚底都由 scope.send 内置
function onSend(): void {
  if (guardDisabled()) return
  props.scope.send()
}

// emoji 只能追加到草稿末尾（uni 的 input 跨端拿不到光标位置）
function onEmoji(emoji: string): void {
  if (guardDisabled()) return
  props.scope.setDraft(props.scope.draft + emoji)
}

interface DemoMediaItem {
  key: string
  text: string
  icon: EmIconName
  feature: keyof EmInputFeatures
}

// 媒体格子按 scope.features 过滤（与默认输入栏同语义；选择器与发送由 scope.selectMedia 内置）
const mediaItems = computed<DemoMediaItem[]>(() => {
  const candidates: DemoMediaItem[] = [
    { key: MEDIA_PANEL_KEY.ALBUM, text: '相册', icon: 'rect-img', feature: 'image' },
    { key: MEDIA_PANEL_KEY.CAMERA, text: '拍照', icon: 'camera', feature: 'camera' },
    { key: MEDIA_PANEL_KEY.VIDEO, text: '视频', icon: 'video', feature: 'video' },
    { key: MEDIA_PANEL_KEY.FILE, text: '文件', icon: 'folder', feature: 'file' }
  ]
  return candidates.filter((item) => props.scope.features[item.feature])
})

function onMedia(key: string): void {
  if (guardDisabled()) return
  props.scope.selectMedia(key)
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';

.demo-inputbar {
  display: flex;
  flex-direction: column;
  background-color: var(--em-bg-elevated);
  border-top-width: 1px;
  border-top-style: solid;
  border-top-color: var(--em-divider-color);
}

/* 快捷回复胶囊条 */
.demo-inputbar__quick {
  display: flex;
  flex-direction: row;
  white-space: nowrap;
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: var(--em-divider-color);
}

.demo-inputbar__quick-track {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 6px 12px;
}

.demo-inputbar__quick-chip {
  flex-shrink: 0;
  height: 28px;
  padding: 0 12px;
  margin-right: 8px;
  border-radius: 14px;
  background-color: var(--em-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.demo-inputbar__quick-chip-text {
  font-family: var(--em-font-family);
  font-size: 12px;
  line-height: 28px;
  color: var(--em-text-primary);
}

/* 引用条 */
.demo-inputbar__quote {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 8px 12px;
}

.demo-inputbar__quote-line {
  width: 2px;
  height: 16px;
  border-radius: 1px;
  background-color: var(--em-primary-color);
  margin-right: 8px;
  flex-shrink: 0;
}

.demo-inputbar__quote-text {
  flex: 1;
  min-width: 0;
  font-family: var(--em-font-family);
  font-size: 13px;
  line-height: 18px;
  color: var(--em-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.demo-inputbar__quote-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* 录音提示 */
.demo-inputbar__record-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
}

.demo-inputbar__record-hint-text {
  font-family: var(--em-font-family);
  font-size: 12px;
  line-height: 16px;
  color: var(--em-text-secondary);
}

/* 主栏 */
.demo-inputbar__bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 8px 12px;
}

.demo-inputbar__tool {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.demo-inputbar--tool-active {
  background-color: var(--em-bg-secondary);
  border-radius: 8px;
}

.demo-inputbar__input {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  margin: 0 8px;
  border-radius: 18px;
  background-color: var(--em-bg-secondary);
  font-family: var(--em-font-family);
  font-size: 14px;
  color: var(--em-text-primary);
}

.demo-inputbar__record {
  flex: 1;
  min-width: 0;
  height: 36px;
  margin: 0 8px;
  border-radius: 18px;
  background-color: var(--em-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.demo-inputbar--record-active {
  background-color: var(--em-bg-active);
}

.demo-inputbar--record-cancel {
  opacity: 0.6;
}

.demo-inputbar__record-text {
  font-family: var(--em-font-family);
  font-size: 14px;
  line-height: 36px;
  color: var(--em-text-primary);
}

.demo-inputbar__send {
  flex-shrink: 0;
  height: 32px;
  padding: 0 14px;
  border-radius: 16px;
  background-color: var(--em-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.demo-inputbar__send-text {
  font-family: var(--em-font-family);
  font-size: 13px;
  line-height: 32px;
  color: #ffffff;
}

/* 底部面板（高度由 scope.panelStyle 内联给定） */
.demo-inputbar__panel {
  display: flex;
  flex-direction: column;
  border-top-width: 1px;
  border-top-style: solid;
  border-top-color: var(--em-divider-color);
}

.demo-inputbar__emoji-scroll {
  flex: 1;
  height: 0;
}

.demo-inputbar__emoji-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  padding: 8px;
}

.demo-inputbar__emoji-cell {
  width: 12.5%;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.demo-inputbar__emoji-char {
  font-size: 24px;
  line-height: 32px;
}

.demo-inputbar__media-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  padding: 16px 12px;
}

.demo-inputbar__media-item {
  width: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 12px;
}

.demo-inputbar__media-tile {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background-color: var(--em-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.demo-inputbar__media-label {
  margin-top: 6px;
  font-family: var(--em-font-family);
  font-size: 11px;
  line-height: 15px;
  color: var(--em-text-secondary);
}
</style>
