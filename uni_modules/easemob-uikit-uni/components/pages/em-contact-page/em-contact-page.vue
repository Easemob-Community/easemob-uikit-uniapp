<template>
  <view :class="[ns.b(), themeClass]">
    <!-- 自绘导航栏（宿主页面需配 navigationStyle:custom / App titleNView:false）：右侧 personadd 添加好友 -->
    <em-nav-bar
      :title="t('contact.title')"
      :show-back="false"
      action-icon="personadd"
      @action="emit('add')"
    />

    <em-search-bar v-model="keyword" :placeholder="t('contact.searchPlaceholder')" />

    <view :class="ns.e('body')">
      <scroll-view
        :class="ns.e('scroll')"
        scroll-y
        :scroll-into-view="scrollIntoId"
        :scroll-with-animation="scrollAnim"
      >
        <!-- 新请求入口卡（对齐 vue 版 ContactNav 入口：图标 + 标题 + 红点/计数 + 右箭头） -->
        <view :class="ns.e('entry')" @click="emit('open-requests')">
          <EmIcon name="personadd" :size="20" :class="ns.e('entry-icon')" />
          <text :class="ns.e('entry-text')">{{ t('contact.newRequests') }}</text>
          <em-badge v-if="pendingCount > 0" :count="pendingCount" :class="ns.e('entry-badge')" />
          <EmIcon name="right" :size="22" :class="ns.e('entry-arrow')" />
        </view>

        <view v-if="syncing && groups.length === 0" :class="ns.e('tip')">
          <text :class="ns.e('tip-text')">{{ t('conversation.syncing') }}</text>
        </view>
        <view v-else-if="groups.length === 0" :class="ns.e('tip')">
          <text :class="ns.e('tip-text')">{{ keyword.trim() !== '' ? t('contact.noSearchResult') : t('contact.empty') }}</text>
        </view>

        <view v-for="group in groups" :key="group.key">
          <!-- 分组锚点 id 供索引条 scroll-into-view 定位 -->
          <view :id="anchorId(group.key)" :class="ns.e('group-header')">
            <text :class="ns.e('group-header-text')">{{ group.key }}</text>
          </view>
          <view
            v-for="c in group.items"
            :key="c.userId"
            :class="ns.e('item')"
            @click="onSelect(c)"
            @longpress="onLongPress(c)"
          >
            <em-avatar :src="avatarOfItem(c)" :name="nameOf(c)" :size="48" />
            <view :class="ns.e('item-body')">
              <em-text :text="nameOf(c)" :text-class="ns.e('name')" :text-style="nameTextStyle" :class="ns.e('name-host')" />
            </view>
          </view>
        </view>
      </scroll-view>

      <em-alphabet-nav
        v-if="groups.length > 0"
        :active-key="activeKey"
        :dim-keys="dimKeys"
        @jump="onJump"
      />
    </view>

    <em-action-sheet
      :visible="itemSheetVisible"
      :actions="itemActions"
      :title="activeContact != null ? nameOf(activeContact) : ''"
      @select="onItemAction"
      @update:visible="itemSheetVisible = $event"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import EmAlphabetNav from '../../em-alphabet-nav/em-alphabet-nav.vue'
import EmAvatar from '../../em-avatar/em-avatar.vue'
import EmBadge from '../../em-badge/em-badge.vue'
import EmIcon from '../../em-icon/em-icon.vue'
import EmNavBar from '../../em-nav-bar/em-nav-bar.vue'
import EmActionSheet from '../../em-action-sheet/em-action-sheet.vue'
import EmSearchBar from '../../em-search-bar/em-search-bar.vue'
import { EmKit } from '../../../libs'
import { ALPHABET_KEYS, CONTACT_MENU_KEY } from '../../../libs/constants'
import { contactStore, pendingInviteCount } from '../../../libs/store/contact'
import { avatarOf, displayNameOf } from '../../../libs/store/user'
import type { EmActionSheetAction, EmContactItem } from '../../../libs/types'
import { useNamespace } from '../../../libs/use/useNamespace'
import { useTheme } from '../../../libs/use/useTheme'
import { useLocale } from '../../../libs/use/useLocale'
import { groupContacts, matchContact } from '../../../libs/utils/pinyin'
import { TEXT_STYLE_NAME } from '../../../libs/style/textStyles'

defineOptions({ styleIsolation: 'app-and-page' })

// 名称文字内联样式收口 libs/style/textStyles.ts（小程序样式隔离，须走 text-style；详见 em-text 注释）
const nameTextStyle = TEXT_STYLE_NAME

const emit = defineEmits<{
  (e: 'select', userId: string): void
  (e: 'open-requests'): void
  (e: 'add'): void
}>()

const ns = useNamespace('contact-page')
const { themeClass } = useTheme()
const { t } = useLocale()

const syncing = computed(() => contactStore.syncing)
const keyword = ref('')
const pendingCount = computed(() => pendingInviteCount())

// 展示名回落链（对齐 vue 版 contact-display）：remark > userStore nickname > userId；
// 名字一次算成 nameByUserId，分组/排序/搜索三处共用同一口径，避免分组函数内反复 find
const nameMap = computed<Record<string, string>>(() => {
  const nameByUserId: Record<string, string> = {}
  contactStore.items.forEach((c) => {
    nameByUserId[c.userId] = c.remark !== '' ? c.remark : displayNameOf(c.userId, c.nickname)
  })
  return nameByUserId
})

function nameOf(c: EmContactItem): string {
  return nameMap.value[c.userId] ?? c.userId
}

function avatarOfItem(c: EmContactItem): string {
  const url = avatarOf(c.userId)
  return url !== '' ? url : c.avatarUrl
}

// 搜索：展示名/userId 原文命中（注入拼音 adapter 后追加拼音/首字母命中，见 utils/pinyin）
const filtered = computed<EmContactItem[]>(() =>
  contactStore.items.filter((c) => matchContact(c, nameOf(c), keyword.value))
)

// 字母分组（A-Z + '#'，空组剔除，组内排序）
const groups = computed(() => groupContacts(filtered.value, (c) => nameOf(c)))

const groupKeys = computed<string[]>(() => groups.value.map((g) => g.key))

// 无分组的字母淡化（索引条 dimEmpty 语义）
const dimKeys = computed<string[]>(() =>
  ALPHABET_KEYS.filter((k) => groupKeys.value.indexOf(k) < 0)
)

// 索引条定位：scroll-into-view + 组头锚点 id；同组连跳需先清空再赋值保证必触发
// （scroll-into-view 值不变不触发，与聊天页滚底 999999/1000000 交替同因）
const scrollIntoId = ref('')
const scrollAnim = ref(false)
const activeKey = ref('')

function anchorId(key: string): string {
  return key === '#' ? 'em-contact-group-hash' : `em-contact-group-${key}`
}

function onJump(key: string, sliding: boolean): void {
  if (groupKeys.value.indexOf(key) < 0) return
  activeKey.value = key
  scrollAnim.value = !sliding
  const id = anchorId(key)
  if (scrollIntoId.value === id) {
    scrollIntoId.value = ''
    nextTick(() => {
      scrollIntoId.value = id
    })
  } else {
    scrollIntoId.value = id
  }
}

// 索引条初始高亮第一组（vue 版分组数据变化兜底高亮首组的同款语义）：
// 好友快照异步就位，watch 到首个分组出现时设一次初值，之后交给索引条交互驱动
watch(groupKeys, (keys) => {
  if (activeKey.value === '' && keys.length > 0) {
    activeKey.value = keys[0]
  }
})

function onSelect(c: EmContactItem): void {
  emit('select', c.userId)
}

// 长按条目：action-sheet 删除好友（CONTACT_MENU_KEY 收口，danger 项）
const itemSheetVisible = ref(false)
const activeContact = ref<EmContactItem | null>(null)

const itemActions = computed<EmActionSheetAction[]>(() => [
  { key: CONTACT_MENU_KEY.DELETE, text: t('contact.delete'), icon: 'trash', danger: true }
])

function onLongPress(c: EmContactItem): void {
  activeContact.value = c
  itemSheetVisible.value = true
}

function onItemAction(action: EmActionSheetAction): void {
  const c = activeContact.value
  if (c == null) return
  if (action.key === CONTACT_MENU_KEY.DELETE) {
    uni.showModal({
      title: '',
      content: t('contact.deleteConfirm'),
      success: (res) => {
        if (!res.confirm) return
        EmKit.deleteContact(c.userId)
          .then(() => {
            uni.showToast({ title: t('contact.deleteSuccess'), icon: 'none' })
          })
          .catch(() => {
            uni.showToast({ title: t('error.unknown'), icon: 'none' })
          })
      }
    })
  }
}
</script>

<style>
@import './em-contact-page.css';
</style>
