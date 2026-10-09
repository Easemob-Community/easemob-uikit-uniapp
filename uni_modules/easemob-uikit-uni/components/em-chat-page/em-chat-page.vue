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
        :class="[ns.e('msg'), m.self ? 'em-chat-page__msg--self' : '']"
      >
        <em-avatar :name="m.self ? '' : m.from" :size="36" />
        <view :class="[ns.e('content'), m.self ? 'em-chat-page__content--self' : '']">
          <view v-if="m.type === 'image'" :class="[ns.e('bubble'), ns.e('bubble-image')]" @click="onPreview(m)">
            <image
              :class="ns.e('image')"
              :src="m.thumbUrl !== '' ? m.thumbUrl : m.url"
              mode="aspectFill"
              :style="imageStyle(m)"
            />
          </view>
          <view v-else-if="m.type === 'other'" :class="ns.e('bubble')">
            <text :class="ns.e('text')">{{ t('message.unsupported') }}</text>
          </view>
          <view v-else :class="[ns.e('bubble'), m.self ? 'em-chat-page__bubble--self' : '']">
            <text :class="[ns.e('text'), m.self ? 'em-chat-page__text--self' : '']">{{ m.text }}</text>
          </view>
          <view :class="ns.e('meta')">
            <text v-if="m.status === 'sending'" :class="ns.e('status')">{{ t('message.status.sending') }}</text>
            <text v-else-if="m.status === 'failed'" :class="ns.e('status-failed')">{{ t('message.status.failed') }}</text>
            <text :class="ns.e('time')">{{ formatTimeHM(m.time) }}</text>
          </view>
        </view>
      </view>
      <view :id="bottomAnchor" :class="ns.e('anchor')"></view>
    </scroll-view>

    <view :class="ns.e('inputbar')">
      <input
        :class="ns.e('input')"
        v-model="draft"
        :placeholder="t('chat.placeholder')"
        confirm-type="send"
        @confirm="onSend"
      />
      <view :class="ns.e('plus')" @click="onPickImage">
        <EmIcon name="plus" :size="20" />
      </view>
      <view :class="ns.e('send')" @click="onSend">
        <text :class="ns.e('send-text')">{{ t('chat.send') }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import EmAvatar from '../em-avatar/em-avatar.vue'
import EmIcon from '../em-icon/em-icon.vue'
import { EmKit, chooseImage, previewImage } from '../../libs'
import type { EmMessageItem } from '../../libs/types'
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
})

// 草稿默认开：输入即存，清空/发送即清
watch(draft, (v) => {
  setDraft(props.conversationId, v)
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
  try {
    await EmKit.sendText(props.conversationId, text)
    draft.value = ''
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

function onPreview(m: EmMessageItem): void {
  const url = m.url !== '' ? m.url : m.thumbUrl
  if (url !== '') {
    previewImage([url], url)
  }
}

// 气泡图尺寸：按宽高比约束在 120~200px 区间
function imageStyle(m: EmMessageItem): string {
  const maxW = 200
  const maxH = 200
  let w = m.width > 0 ? m.width : 120
  let h = m.height > 0 ? m.height : 160
  const scale = Math.min(maxW / w, maxH / h, 1)
  w = Math.round(w * scale)
  h = Math.round(h * scale)
  return `width: ${w}px; height: ${h}px;`
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
  padding: var(--em-spacing-2) var(--em-spacing-3);
}

.em-chat-page__bubble--self {
  background-color: var(--em-bubble-bg-self);
}

.em-chat-page__bubble-image {
  padding: 0;
  overflow: hidden;
}

.em-chat-page__image {
  border-radius: var(--em-bubble-radius);
}

.em-chat-page__text {
  font-size: var(--em-font-size-16);
  line-height: var(--em-lineheight-normal);
  color: var(--em-bubble-text-other);
}

.em-chat-page__text--self {
  color: var(--em-bubble-text-self);
}

.em-chat-page__meta {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: var(--em-spacing-1);
}

.em-chat-page__status {
  font-size: var(--em-font-size-12);
  color: var(--em-text-tertiary);
  margin-right: var(--em-spacing-1);
}

.em-chat-page__status-failed {
  font-size: var(--em-font-size-12);
  color: var(--em-danger-color);
  margin-right: var(--em-spacing-1);
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
