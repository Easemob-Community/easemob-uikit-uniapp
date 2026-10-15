<template>
  <em-popup :visible="show" @update:visible="onPopupVisible">
    <view :class="ns.e('sheet')" :style="sheetStyle">
      <!-- 头部：标题 + 关闭（半屏底部弹层形态，对齐 vue 版 new-chat-modal 语义） -->
      <view :class="ns.e('header')">
        <text :class="ns.e('title')">{{ titleText }}</text>
        <view :class="ns.e('close')" @click="onClose">
          <EmIcon name="closeempty" :size="20" :class="ns.e('close-icon')" />
        </view>
      </view>
      <em-search-bar v-model="keyword" :placeholder="t('contact.searchPlaceholder')" />

      <!-- multiple：已选头像条（横向滚动，点头像任意处移除，对齐 vue 移动端 contact-transfer-modal strip） -->
      <scroll-view v-if="isMultiple" :class="ns.e('strip')" scroll-x>
        <view :class="ns.e('strip-content')">
          <view
            v-for="entry in selectedItems"
            :key="entry.userId"
            :class="ns.e('strip-item')"
            @click="onToggle(entry)"
          >
            <em-avatar :src="entry.avatar" :name="entry.name" :size="44" />
            <view :class="ns.e('strip-remove')">
              <EmIcon name="closeempty" :size="8" :class="ns.e('strip-remove-icon')" />
            </view>
          </view>
          <text v-if="selectedItems.length === 0" :class="ns.e('strip-empty')">{{ t('group.createSelectedEmpty') }}</text>
        </view>
      </scroll-view>

      <!-- multiple：panel-top 注入区（如建群弹层的群名/开关表单），位于已选条与列表之间（对齐 vue panel-top） -->
      <slot v-if="isMultiple" name="panel-top" />

      <view :class="ns.e('body')">
        <scroll-view
          :class="ns.e('list')"
          scroll-y
          :scroll-into-view="scrollIntoId"
          :scroll-with-animation="scrollAnim"
        >
          <!-- single：平铺直点（对齐 vue new-chat-modal，无字母导航） -->
          <block v-if="!isMultiple">
            <view
              v-for="entry in filtered"
              :key="entry.userId"
              :class="ns.e('row')"
              @click="onSelect(entry.userId)"
            >
              <em-avatar :src="entry.avatar" :name="entry.name" :size="40" />
              <em-text :text="entry.name" :text-class="ns.e('name')" :text-style="nameTextStyle" :class="ns.e('name-host')" />
            </view>
          </block>
          <!-- multiple：字母分组 + 自绘 checkbox（对齐 vue contact-transfer-modal 移动端） -->
          <block v-else>
            <view v-for="group in groups" :key="group.key">
              <view :id="anchorId(group.key)" :class="ns.e('group-header')">
                <text :class="ns.e('group-header-text')">{{ group.key }}</text>
              </view>
              <view
                v-for="entry in group.items"
                :key="entry.userId"
                :class="rowClass(entry)"
                @click="onToggle(entry)"
              >
                <view :class="checkboxClass(entry)">
                  <EmIcon v-if="isSelected(entry.userId)" name="checkmarkempty" :size="12" :class="ns.e('check-icon')" />
                </view>
                <em-avatar :src="entry.avatar" :name="entry.name" :size="40" />
                <em-text :text="entry.name" :text-class="ns.e('name')" :text-style="nameTextStyle" :class="ns.e('name-host')" />
              </view>
            </view>
          </block>
          <em-empty v-if="filtered.length === 0" icon="search" :description="t('contact.noSearchResult')" />
        </scroll-view>

        <em-alphabet-nav
          v-if="isMultiple && groups.length > 0"
          :active-key="activeKey"
          :dim-keys="dimKeys"
          @jump="onJump"
        />
      </view>

      <!-- multiple：通栏确认按钮（计数 + 空选禁用，对齐 vue 移动端 transfer footer） -->
      <view v-if="isMultiple" :class="ns.e('footer')">
        <em-button type="primary" pill block :disabled="selectedIds.length === 0" :text="confirmText" @click="onConfirm" />
      </view>
    </view>
  </em-popup>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import EmAlphabetNav from '../em-alphabet-nav/em-alphabet-nav.vue'
import EmAvatar from '../em-avatar/em-avatar.vue'
import EmButton from '../em-button/em-button.vue'
import EmEmpty from '../em-empty/em-empty.vue'
import EmIcon from '../em-icon/em-icon.vue'
import EmPopup from '../em-popup/em-popup.vue'
import EmSearchBar from '../em-search-bar/em-search-bar.vue'
import EmText from '../em-text/em-text.vue'
import { ALPHABET_KEYS, SELECT_CONTACT_MODE } from '../../libs/constants'
import type { SelectContactModeValue } from '../../libs/constants'
import { TEXT_STYLE_NAME } from '../../libs/style/textStyles'
import type { EmSelectContactItem } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'
import { useLocale } from '../../libs/use/useLocale'
import { groupContacts } from '../../libs/utils/pinyin'

// 选人弹层原子组件：数据 props 进、事件 emits 出，不连 store 不碰路由。
// single（默认，对齐 vue new-chat-modal）：平铺直点、无字母导航；
// multiple（对齐 vue contact-transfer-modal 移动端）：字母分组 + 索引条 + 自绘 checkbox +
// 已选头像条 + 通栏确认按钮；#panel-top 插槽可在已选条与列表之间注入表单（建群弹层用）。
// confirm 仅透出选中 id 列表，不自动关闭（异步提交成败由父组件决定关窗时机）
interface Props {
  items: EmSelectContactItem[]   // 候选联系人（userId/展示名/avatar 由父组件装配好传入）
  show: boolean                  // 弹层显隐（v-model:show）
  selectMode?: SelectContactModeValue  // 默认 single（Phase 2 行为不变）
  disabledIds?: string[]         // 置灰不可选（如邀请入群时禁用已在群成员）
  title?: string                 // 空串按模式回落 i18n 默认（single=发起单聊 / multiple=选择成员）
}

const props = withDefaults(defineProps<Props>(), {
  selectMode: SELECT_CONTACT_MODE.SINGLE,
  disabledIds: () => [],
  title: ''
})

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'select', userId: string): void
  (e: 'confirm', userIds: string[]): void
}>()

defineOptions({ styleIsolation: 'app-and-page' })

const ns = useNamespace('select-contact')
const { t } = useLocale()

const isMultiple = computed(() => props.selectMode === SELECT_CONTACT_MODE.MULTIPLE)

const titleText = computed(() =>
  props.title !== '' ? props.title : (isMultiple.value ? t('contact.selectMembers') : t('conversation.newChat'))
)
const nameTextStyle = TEXT_STYLE_NAME

// 半屏高度：按窗口高比例预计算（读取时刻快照，弹层存续期内不响应旋转，同 useSafeArea 口径）；
// multiple 形态内容多（已选条 + 表单 + footer），对齐 vue mobileFullscreen 取 80%
const sheetStyle = computed(() => {
  const ratio = isMultiple.value ? 0.8 : 0.6
  return `height: ${Math.round(uni.getWindowInfo().windowHeight * ratio)}px;`
})

const keyword = ref('')

const filtered = computed<EmSelectContactItem[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (kw === '') return props.items
  return props.items.filter((item) =>
    item.name.toLowerCase().includes(kw) || item.userId.toLowerCase().includes(kw)
  )
})

// ===== multiple：分组 + 索引条（平移 em-contact-page 实现） =====
const groups = computed(() => groupContacts(filtered.value, (c) => c.name))
const groupKeys = computed<string[]>(() => groups.value.map((g) => g.key))
const dimKeys = computed<string[]>(() =>
  ALPHABET_KEYS.filter((k) => groupKeys.value.indexOf(k) < 0)
)

const scrollIntoId = ref('')
const scrollAnim = ref(false)
const activeKey = ref('')

function anchorId(key: string): string {
  return key === '#' ? 'em-select-contact-group-hash' : `em-select-contact-group-${key}`
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

// 索引条初始高亮第一组（同 em-contact-page 语义）
watch(groupKeys, (keys) => {
  if (activeKey.value === '' && keys.length > 0) {
    activeKey.value = keys[0]
  }
})

// ===== multiple：选中态 =====
const selectedIds = ref<string[]>([])

const selectedItems = computed<EmSelectContactItem[]>(() =>
  selectedIds.value
    .map((id) => props.items.find((item) => item.userId === id))
    .filter((item): item is EmSelectContactItem => item != null)
)

const confirmText = computed(() => `${t('button.confirm')} (${selectedIds.value.length})`)

function isSelected(userId: string): boolean {
  return selectedIds.value.indexOf(userId) >= 0
}

function isDisabled(entry: EmSelectContactItem): boolean {
  return props.disabledIds.indexOf(entry.userId) >= 0
}

function rowClass(entry: EmSelectContactItem): string {
  return [ns.e('row'), isDisabled(entry) ? 'em-select-contact__row--disabled' : ''].join(' ').trim()
}

function checkboxClass(entry: EmSelectContactItem): string {
  return [
    ns.e('checkbox'),
    isSelected(entry.userId) ? 'em-select-contact__checkbox--checked' : '',
    isDisabled(entry) ? 'em-select-contact__checkbox--disabled' : ''
  ].join(' ').trim()
}

function onToggle(entry: EmSelectContactItem): void {
  if (isDisabled(entry)) return
  const index = selectedIds.value.indexOf(entry.userId)
  if (index >= 0) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(entry.userId)
  }
}

function onConfirm(): void {
  if (selectedIds.value.length === 0) return
  emit('confirm', [...selectedIds.value])
}

function onSelect(userId: string): void {
  emit('select', userId)
}

function onClose(): void {
  emit('update:show', false)
}

function onPopupVisible(value: boolean): void {
  if (!value) {
    keyword.value = ''
    selectedIds.value = []
  }
  emit('update:show', value)
}
</script>

<style>
@import './em-select-contact.css';
</style>
