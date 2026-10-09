<template>
  <text :class="ns.b()" :style="iconStyle" @click="onClick">{{ glyph }}</text>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../libs/use/useNamespace'
import { EmIcons, type EmIconName } from './em-icons'

interface Props {
  name: EmIconName
  size?: number
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
  color: ''
})

defineOptions({ styleIsolation: 'app-and-page' })

const emit = defineEmits<{ (e: 'click'): void }>()

const ns = useNamespace('icon')

const glyph = computed(() => EmIcons[props.name])
const iconStyle = computed(() => {
  const base = `font-size: ${props.size}px; width: ${props.size}px; height: ${props.size}px;`
  return props.color.length > 0 ? `${base} color: ${props.color};` : base
})

function onClick(): void {
  emit('click')
}
</script>

<style>
@import '../../libs/style/variables.css';

@font-face {
  font-family: 'em-icons';
  src: url('./em-icons.ttf');
}

.em-icon {
  font-family: 'em-icons';
  color: var(--em-icon-muted);
  line-height: 1;
  text-align: center;
}
</style>
