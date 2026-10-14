<template>
  <view :class="[ns.b(), themeClass]">
    <!-- 自绘导航栏（宿主页面需配 navigationStyle:custom / App titleNView:false）：右侧 personadd 添加好友 -->
    <em-nav-bar
      :title="t('contact.title')"
      :show-back="false"
      action-icon="personadd"
      @action="emit('add')"
    />

    <view :class="ns.e('search')">
      <view :class="ns.e('search-box')">
        <EmIcon name="search" :size="16" :class="ns.e('search-icon')" />
        <input
          :class="ns.e('search-input')"
          v-model="keyword"
          :placeholder="t('contact.searchPlaceholder')"
        />
      </view>
    </view>

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
          <view v-if="pendingCount > 0" :class="ns.e('entry-badge')">
            <text :class="ns.e('entry-badge-text')">{{ pendingCount > 99 ? '99+' : `${pendingCount}` }}</text>
          </view>
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
import EmAlphabetNav from '../em-alphabet-nav/em-alphabet-nav.vue'
import EmAvatar from '../em-avatar/em-avatar.vue'
import EmIcon from '../em-icon/em-icon.vue'
import EmNavBar from '../em-nav-bar/em-nav-bar.vue'
import EmActionSheet from '../em-action-sheet/em-action-sheet.vue'
import { EmKit } from '../../libs'
import { ALPHABET_KEYS, CONTACT_MENU_KEY } from '../../libs/constants'
import { contactStore, pendingInviteCount } from '../../libs/store/contact'
import { avatarOf, displayNameOf } from '../../libs/store/user'
import type { EmActionSheetAction, EmContactItem } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'
import { useTheme } from '../../libs/use/useTheme'
import { useLocale } from '../../libs/use/useLocale'
import { groupContacts, matchContact } from '../../libs/utils/pinyin'

defineOptions({ styleIsolation: 'app-and-page' })

// 文字样式内联兜底（小程序样式隔离下父组件 wxss 够不到 em-text 内部 text，须走 text-style；详见 em-text 注释）
const nameTextStyle = 'font-family: var(--em-font-family); font-size: var(--em-font-size-15); font-weight: var(--em-font-weight-semibold); line-height: 20px; color: var(--em-text-primary); white-space: nowrap;'

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
// 名字一次算成 map，分组/排序/搜索三处共用同一口径，避免分组函数内反复 find
const nameMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  contactStore.list.forEach((c) => {
    map[c.userId] = c.remark !== '' ? c.remark : displayNameOf(c.userId, c.nickname)
  })
  return map
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
  contactStore.list.filter((c) => matchContact(c, nameOf(c), keyword.value))
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
@import '../../libs/style/variables.css';

.em-contact-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  background-color: var(--em-conversation-list-bg);
}

/* 列表区：relative 容器供字母索引条 absolute 覆盖 */
.em-contact-page__body {
  flex: 1;
  height: 0;
  position: relative;
}

.em-contact-page__scroll {
  flex: 1;
  height: 100%;
}

/* 搜索槽：上下 8px、左右 16px（与会话页搜索同口径） */
.em-contact-page__search {
  display: flex;
  flex-direction: row;
  padding: var(--em-spacing-2) var(--em-spacing-4);
}

.em-contact-page__search-box {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 36px;
  padding: 0 var(--em-spacing-3);
  background-color: var(--em-control-bg);
  border-radius: var(--em-input-radius);
}

.em-contact-page__search-icon {
  color: var(--em-icon-muted);
  margin-right: 6px;
  flex-shrink: 0;
}

.em-contact-page__search-input {
  flex: 1;
  height: 36px;
  font-size: var(--em-font-size-14);
  color: var(--em-text-primary);
  background-color: transparent;
}

/* 新请求入口卡：64px 行（对齐联系人条目行高），图标 20px / 标题 15px / 箭头 22px（vue 版 ContactNav 口径） */
.em-contact-page__entry {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: var(--em-cell-height);
  padding: 0 var(--em-spacing-4);
  background-color: var(--em-bg-base);
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: var(--em-divider-color);
}

.em-contact-page__entry-icon {
  color: var(--em-text-secondary);
  flex-shrink: 0;
}

.em-contact-page__entry-text {
  flex: 1;
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-15);
  font-weight: var(--em-font-weight-medium);
  line-height: 20px;
  color: var(--em-text-primary);
  margin-left: var(--em-spacing-3);
}

.em-contact-page__entry-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding-left: 5px;
  padding-right: 5px;
  border-radius: 9px;
  background-color: var(--em-badge-bg);
  margin-right: var(--em-spacing-2);
  flex-shrink: 0;
}

.em-contact-page__entry-badge-text {
  font-size: var(--em-font-size-11);
  line-height: 1;
  color: var(--em-badge-text);
}

.em-contact-page__entry-arrow {
  color: var(--em-icon-muted);
  flex-shrink: 0;
}

.em-contact-page__tip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--em-spacing-7) var(--em-spacing-4);
}

.em-contact-page__tip-text {
  font-size: var(--em-font-size-14);
  color: var(--em-empty-text-color);
}

/* 分组头：28px 高、11px/500 tertiary（对齐 vue 版 __group-header）；
   sticky 吸顶在蒸汽 App 端若不生效则降级为随列表滚动（一期可接受降级，索引条定位不受影响） */
.em-contact-page__group-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 28px;
  padding: 0 var(--em-spacing-4);
  background-color: var(--em-conversation-list-bg);
  position: sticky;
  top: 0;
}

.em-contact-page__group-header-text {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-11);
  font-weight: var(--em-font-weight-medium);
  line-height: 16px;
  color: var(--em-text-tertiary);
}

/* 联系人条目：行高 64px（48px 头像 + 8px×2，对齐 vue 版 cell 口径），分割线在文字列内左内收 */
.em-contact-page__item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: var(--em-spacing-2) var(--em-spacing-4);
  background-color: var(--em-bg-base);
}

.em-contact-page__item-body {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  min-width: 0;
  align-self: stretch;
  margin-left: var(--em-spacing-3);
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: var(--em-divider-color);
}

/* 名称折叠由 em-text 收口；宿主节点补 min-width:0 保持 flex 约束链（小程序宿主参与 flex 布局） */
.em-contact-page__name-host {
  flex: 1;
  min-width: 0;
}

.em-contact-page__name {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-15);
  font-weight: var(--em-font-weight-semibold);
  line-height: 20px;
  color: var(--em-text-primary);
}
</style>
