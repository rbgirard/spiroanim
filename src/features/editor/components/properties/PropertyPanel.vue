<template>
  <details class="property-panel" :open="expanded" @toggle="onToggle">
    <summary class="title">{{ props.title }}</summary>
    <div class="panel">
      <div v-if="props.data !== undefined" class="container colb">
        <template v-for="(v, i) in props.vals" :key="'ct' + i">
          <BaseTooltip :disabled="!showTooltips">
            <template #activator="{ props: tooltipProps }">
              <div v-bind="tooltipProps" class="col1">{{ v.text }}:</div>
            </template>
            <template #html><slot :name="v.name" /></template>
          </BaseTooltip>
          <div class="col2 val-container">
            <button
              class="propval"
              :class="propClass(props.data[v.name]!)"
              type="button"
              @click="valueClick(v.name)"
            >
              {{ props.data[v.name]?.[STRING] }}
            </button>
            <button
              v-if="showTrash(v)"
              class="trash-button"
              type="button"
              :aria-label="'Clear ' + v.text"
              @click="clickTrash(v)"
            >
              <BaseIcon :path="mdiTrashCanOutline" size="18" />
            </button>
          </div>
          <div v-if="v.component && pINPUT == inputStr(v.name)" class="form-container">
            <component
              :is="components[v.component + 'Form']"
              :key="inputStr(v.name)"
              :data="props.data[v.name]"
              :vals="v"
              :setter="props.setter"
            />
          </div>
        </template>
      </div>
      <slot />
    </div>
  </details>
</template>
<script setup lang="ts">
import BaseTooltip from '@/components/ui/BaseTooltip.vue'
import BaseIcon from '@/components/icons/BaseIcon.vue'
import { useProperties, STRING, VALUE, FALL } from '@/features/editor/composables/useProperties'
import { useViewportStore } from '@/stores/useViewportStore'
import type { DynamicVal, ValRetType, SetterFunc } from '@/types/AnimTypes'

import { mdiTrashCanOutline } from '@mdi/js'

// Import type for components
import { type Component } from 'vue'

// Dynamically import all .vue files from the forms directory
const modules = import.meta.glob('@/features/editor/components/properties/forms/*.vue', {
  eager: true,
})

// Create an object to hold the components
const components: Record<string, Component> = {}

// Iterate through the modules and map them to the components object
for (const path in modules) {
  const componentName = path.split('/').pop()?.replace('.vue', '') || ''

  // Directly assign the default export
  components[componentName] = (modules[path] as { default: Component }).default as Component
}

const props = withDefaults(
  defineProps<{
    panel: string
    title: string
    data?: Record<string, ValRetType>
    vals?: DynamicVal[]
    setter?: SetterFunc
    store?: string
  }>(),
  {
    store: 'main',
    data: undefined,
    vals: undefined,
    setter: undefined,
  },
)

const { propClass, pINPUT, pEXPANDED } = useProperties(props.store)
const { showTooltips } = storeToRefs(useViewportStore())
const expanded = computed(() => pEXPANDED.value[props.panel]?.includes(props.panel) ?? false)

const onToggle = (event: Event) => {
  const open = (event.currentTarget as HTMLDetailsElement).open
  pEXPANDED.value[props.panel] = open ? [props.panel] : []
}

const inputStr = (name: string) => {
    return props.panel + '.' + name
  },
  valueClick = (name: string) => {
    const comp = inputStr(name)
    pINPUT.value = pINPUT.value == comp ? '' : comp
  },
  showTrash = (v: DynamicVal) => {
    const d = props.data?.[v.name]
    return d !== undefined && v.undef && d[VALUE] !== undefined && !d[FALL]
  },
  clickTrash = (v: DynamicVal) => {
    props.setter?.(v.name, undefined)
  }
</script>

<style scoped>
.title {
  padding: 8px 0 8px 25px;
  margin: 0;
  color: var(--color-action-primary);
  font-size: 18px;
  cursor: pointer;
}
.panel {
  padding: 0 10px 10px;
  font-size: 18px;
}

.propval {
  text-decoration: none;
  display: inline-block;
  width: 100%;
  height: 100%;
  cursor: pointer;
  color: inherit;
  text-align: start;
  background: transparent;
  border: 0;
}
.val-fall {
  color: var(--color-text-muted);
}
.val-mism {
  color: var(--color-action-primary);
}
.val-undef {
  color: var(--color-text-muted);
}
.val-def {
  color: var(--color-action-primary);
}
.val-err::before {
  content: '>> ';
}
.val-err::after {
  content: ' <<';
}
.container {
  display: grid;
  grid-template-columns: minmax(min-content, auto) 1fr;
}
.form-container {
  grid-column: span 2;
}
.col1,
.col2,
.colb,
.form-container {
  border-color: var(--color-border);
  border-style: solid;
}
.col1 {
  border-width: 1px 0 0 1px;
}
.col2,
.form-container {
  border-width: 1px 1px 0 1px;
}
.colb {
  border-width: 0 0 1px 0;
}
.col1,
.col2,
.form-container {
  padding: 3px;
}
.val-container {
  display: grid;
  grid-template-columns: 1fr min-content;
}

.trash-button {
  padding: 2px;
  color: var(--color-text-muted);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.propval:focus-visible,
.trash-button:focus-visible,
.title:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
