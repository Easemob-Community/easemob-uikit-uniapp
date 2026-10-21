<template>
  <view :class="[ns.b(), themeClass]" :style="primaryColorStyle()">
    <!-- 自绘导航栏（宿主页面需配 navigationStyle:custom / App titleNView:false）；返回动作以 back 事件透出，路由由宿主接线 -->
    <em-nav-bar :title="t('contact.entryContact')" @back="emit('back')" />

    <em-search-bar v-model="keyword" :placeholder="t('contact.searchPlaceholder')" />

    <view :class="ns.e('body')">
      <scroll-view
        :class="ns.e('scroll')"
        scroll-y
        :scroll-into-view="scrollIntoId"
        :scroll-with-animation="scrollAnim"
      >
        <!-- 好友同步骨架（对齐 vue 版 contact-list：8 条条目占位） -->
        <view v-if="syncing && groups.length === 0" :class="ns.e('skeleton')">
          <view v-for="index in SKELETON_COUNT" :key="index" :class="ns.e('skeleton-item')">
            <em-skeleton variant="avatar" shape="rounded" width="48px" height="48px" />
            <view :class="ns.e('skeleton-lines')">
              <em-skeleton :width="SKELETON_LINE_WIDTHS[0]" />
              <em-skeleton :width="SKELETON_LINE_WIDTHS[1]" :class="ns.e('skeleton-line-sub')" />
            </view>
          </view>
        </view>
        <em-empty
          v-else-if="groups.length === 0"
          icon="person-single"
          :description="keyword.trim() !== '' ? t('contact.noSearchResult') : t('contact.empty')"
        />

        <view v-for="group in groups" :key="group.key">
          <!-- 分组锚点 id 供索引条 scroll-into-view 定位 -->
          <view :id="anchorId(group.key)" :class="ns.e('group-header')">
            <text :class="ns.e('group-header-text')">{{ group.key }}</text>
          </view>
          <view
            v-for="c in group.items"
            :key="c.userId"
            :class="ns.e('item')"
            @touchstart="onTouchStart"
            @click="onSelect(c)"
            @longpress="onLongPress(c)"
          >
            <em-avatar :src="avatarOfItem(c)" :name="nameOf(c)" :size="48" />
            <view :class="ns.e('item-body')">
              <em-text :text="nameOf(c)" :text-class="ns.e('name')" :text-style="nameTextStyle" :class="ns.e('name-host')" />
            </view>
          </view>
        </view>

        <!-- 底部「没有更多了」（对齐 vue 版 contact-list no-more；SDK 本地全量无分页，恒 noMore 态） -->
        <em-load-more v-if="groups.length > 0" :state="LOAD_MORE_STATE.NO_MORE" />
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
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import EmAlphabetNav from '../../em-alphabet-nav/em-alphabet-nav.vue'
import EmAvatar from '../../em-avatar/em-avatar.vue'
import EmEmpty from '../../em-empty/em-empty.vue'
import EmNavBar from '../../em-nav-bar/em-nav-bar.vue'
import EmActionSheet from '../../em-action-sheet/em-action-sheet.vue'
import EmLoadMore from '../../em-load-more/em-load-more.vue'
import EmSearchBar from '../../em-search-bar/em-search-bar.vue'
import EmSkeleton from '../../em-skeleton/em-skeleton.vue'
import { EmKit } from '../../../libs'
import { ALPHABET_KEYS, CONTACT_MENU_KEY, LOAD_MORE_STATE } from '../../../libs/constants'
import type { ContactMenuKeyValue } from '../../../libs/constants'
import { contactStore } from '../../../libs/store/contact'
import { primaryColorStyle } from '../../../libs/store/config'
import { avatarOf, displayNameOf } from '../../../libs/store/user'
import type { EmActionSheetAction, EmContactItem } from '../../../libs/types'
import { useNamespace } from '../../../libs/use/useNamespace'
import { useTheme } from '../../../libs/use/useTheme'
import { useLocale } from '../../../libs/use/useLocale'
import { useLongPressClickGuard } from '../../../libs/use/useLongPressClickGuard'
import { groupContacts, matchContact } from '../../../libs/utils/pinyin'
import { TEXT_STYLE_NAME } from '../../../libs/style/textStyles'

// 好友完整列表页（自 em-contact-page 入口化重构平移）：字母分组 + 索引条 + 搜索 + 长按删除
defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  /** 条目长按菜单项与顺序（默认仅删除好友全量）；联系人详情/拉黑仍留二期 */
  menuKeys?: ContactMenuKeyValue[]
  /** 首次挂载自动读好友快照，默认 true；宿主可关闭后自行控制同步时机 */
  autoSync?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  menuKeys: () => [CONTACT_MENU_KEY.DELETE],
  autoSync: true
})

// 名称文字内联样式收口 libs/style/textStyles.ts（小程序样式隔离，须走 text-style；详见 em-text 注释）
const nameTextStyle = TEXT_STYLE_NAME

const emit = defineEmits<{
  (e: 'select', userId: string): void
  (e: 'back'): void
}>()

const ns = useNamespace('contact-list-page')
const { themeClass } = useTheme()
const { t } = useLocale()
// H5 长按后仍会补发 click：长按删除菜单与点击进会话会同时触发，这里吞掉长按抬手那一次 click
const { onTouchStart, shouldSkipClick } = useLongPressClickGuard()

const syncing = computed(() => contactStore.syncing)
const keyword = ref('')

// 首次挂载自拉好友快照（登录后 SDK 已后台同步，这里读内存；失败静默，事件会继续驱动刷新）
onMounted(() => {
  if (!props.autoSync || EmKit.state.userId === '') return
  EmKit.syncContacts().catch(() => {})
})

// 好友同步骨架：条数与行宽对齐 vue 版 contact-list（8 条、35%/65% 两行）
const SKELETON_COUNT = 8
const SKELETON_LINE_WIDTHS = ['35%', '65%']

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
  if (shouldSkipClick()) return
  emit('select', c.userId)
}

// 长按条目：action-sheet 菜单项按 menuKeys props 过滤排序（默认删除好友，CONTACT_MENU_KEY 收口，danger 项）
const itemSheetVisible = ref(false)
const activeContact = ref<EmContactItem | null>(null)

const itemActions = computed<EmActionSheetAction[]>(() => {
  const candidates: EmActionSheetAction[] = [
    { key: CONTACT_MENU_KEY.DELETE, text: t('contact.delete'), icon: 'trash', danger: true }
  ]
  return props.menuKeys
    .map((key) => candidates.find((a) => a.key === key))
    .filter((a): a is EmActionSheetAction => a != null)
})

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
@import './em-contact-list-page.css';
</style>
