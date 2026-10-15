<template>
  <view :class="[ns.b(), themeClass]" :style="primaryColorStyle()">
    <!-- 自绘导航栏（宿主页面需配 navigationStyle:custom / App titleNView:false）：右侧 personadd 添加好友 -->
    <em-nav-bar
      :title="t('contact.title')"
      :show-back="false"
      action-icon="personadd"
      @action="emit('add')"
    />

    <!-- 搜索只过滤入口项（label/key 命中，对齐 vue 版 address-book home 语义） -->
    <em-search-bar v-model="keyword" :placeholder="t('contact.searchPlaceholder')" />

    <scroll-view :class="ns.e('scroll')" scroll-y>
      <em-contact-nav :entries="entries" @entry-click="onEntryClick" />
      <em-empty
        v-if="entries.length === 0"
        icon="search"
        :description="t('contact.noSearchResult')"
      />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import EmContactNav from '../../em-contact-nav/em-contact-nav.vue'
import EmEmpty from '../../em-empty/em-empty.vue'
import EmNavBar from '../../em-nav-bar/em-nav-bar.vue'
import EmSearchBar from '../../em-search-bar/em-search-bar.vue'
import { CONTACT_ENTRY_KEY } from '../../../libs/constants'
import { contactStore, pendingInviteCount } from '../../../libs/store/contact'
import { primaryColorStyle } from '../../../libs/store/config'
import { groupStore } from '../../../libs/store/group'
import type { EmContactNavEntry } from '../../../libs/types'
import { useNamespace } from '../../../libs/use/useNamespace'
import { useTheme } from '../../../libs/use/useTheme'
import { useLocale } from '../../../libs/use/useLocale'

// 通讯录入口页（对齐 vue 版 address-book-container home 视图）：
// 三入口 = 新请求（pending 计数 + hot 红点）/ 群组 / 好友列表；
// 好友字母列表已迁至 em-contact-list-page，点击入口原样透出 key 由宿主接线路由
defineOptions({ styleIsolation: 'app-and-page' })

const emit = defineEmits<{
  (e: 'entry-click', key: string): void
  (e: 'add'): void
}>()

const ns = useNamespace('contact-page')
const { themeClass } = useTheme()
const { t } = useLocale()

const keyword = ref('')

const allEntries = computed<EmContactNavEntry[]>(() => {
  const pendingCount = pendingInviteCount()
  return [
    {
      key: CONTACT_ENTRY_KEY.NOTICE,
      label: t('contact.newRequests'),
      count: pendingCount,
      hot: pendingCount > 0,
      icon: 'personadd'
    },
    {
      key: CONTACT_ENTRY_KEY.GROUP,
      label: t('contact.entryGroup'),
      count: groupStore.items.length,
      icon: 'chatboxes'
    },
    {
      key: CONTACT_ENTRY_KEY.CONTACT,
      label: t('contact.entryContact'),
      count: contactStore.items.length,
      icon: 'contact'
    }
  ]
})

// home 搜索语义：label/key 子串命中（大小写不敏感），不过滤好友本体（对齐 vue navEntries 过滤）
const entries = computed<EmContactNavEntry[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (kw === '') return allEntries.value
  return allEntries.value.filter(
    (e) => e.label.toLowerCase().indexOf(kw) >= 0 || e.key.toLowerCase().indexOf(kw) >= 0
  )
})

function onEntryClick(key: string): void {
  emit('entry-click', key)
}
</script>

<style>
@import './em-contact-page.css';
</style>
