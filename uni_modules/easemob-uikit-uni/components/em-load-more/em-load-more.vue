<template>
  <!-- 触底加载统一 footer：三态收口（loading 静态 spinner + 文案 / noMore / button 可点）。
       消费契约：scroll-view @scrolltolower → 消费方检查 hasMore && !loading 锁 → 触发加载并切 state -->
  <view :class="ns.b()">
    <view v-if="state === LOAD_MORE_STATE.LOADING" :class="ns.e('row')">
      <EmIcon name="loading-arc-normal" :size="14" :class="ns.e('spinner')" />
      <text :class="ns.e('text')">{{ t('common.loading') }}</text>
    </view>
    <view v-else-if="state === LOAD_MORE_STATE.BUTTON" :class="ns.e('row')" @click="emit('load')">
      <text :class="[ns.e('text'), 'em-load-more__text--button']">{{ t('common.loadMore') }}</text>
    </view>
    <view v-else :class="ns.e('row')">
      <text :class="ns.e('text')">{{ t('common.noMore') }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import EmIcon from '../em-icon/em-icon.vue'
import { LOAD_MORE_STATE } from '../../libs/constants'
import type { LoadMoreStateValue } from '../../libs/constants'
import { useNamespace } from '../../libs/use/useNamespace'
import { useLocale } from '../../libs/use/useLocale'

// 触底加载 footer 原子组件（对齐 vue 版 group-member-list 尾部按钮 / group-list load-more 区）：
// 静态 spinner（ucss 禁伪元素动画，蒸汽端动画体系一期不用），状态枚举收口 constants
interface Props {
  state: LoadMoreStateValue
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'load'): void
}>()

defineOptions({ styleIsolation: 'app-and-page' })

const ns = useNamespace('load-more')
const { t } = useLocale()
</script>

<style>
@import './em-load-more.css';
</style>
