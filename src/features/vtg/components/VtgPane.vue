<template>
  <PatternMatrixPane
    :animation="animation"
    :animation-revision="animationRevision"
    :animation-ready="animationReady"
    :pattern-matcher="patternMatcher"
    :builder-active="builderActive"
    :builder-full-catalog="builderFullCatalog"
    :builder-full-catalog-forced="builderFullCatalogForced"
    :builder-full-grid="builderFullGrid"
    :builder-insertion-index="builderInsertionIndex"
    :builder-match-animation="builderMatchAnimation"
    @pattern-select="forwardSelection"
    @pattern-preview="emit('patternPreview', $event)"
    @customize="emit('customize', $event)"
    @quick-slots-create="emit('quickSlotsCreate', $event)"
    @animation-update="emit('animationUpdate', $event)"
    @builder-open="emit('builderOpen', $event)"
    @composer-cell-change="emit('composerCellChange', $event)"
    @update:builder-full-grid="emit('update:builderFullGrid', $event)"
  />
</template>

<script setup lang="ts">
import PatternMatrixPane from '@/features/concepts/components/PatternMatrixPane.vue'
import type { ConceptPatternSelection } from '@/features/concepts/types'
import type { ComposerCell } from '@/features/kinetic-alphabet/composerBridge'
import type { RootDataFinal } from '@/types/AnimTypes'
import type { PatternMatchingClient } from '@/workers/pattern-matching/PatternMatchingWorkerTypes'

withDefaults(
  defineProps<{
    animation?: RootDataFinal
    animationRevision?: number
    animationReady?: boolean
    patternMatcher?: PatternMatchingClient
    builderActive?: boolean
    builderFullCatalog?: boolean
    builderFullCatalogForced?: boolean
    builderFullGrid?: boolean
    builderInsertionIndex?: number
    builderMatchAnimation?: RootDataFinal
  }>(),
  {
    animationReady: true,
    builderActive: false,
    builderFullCatalog: false,
    builderFullCatalogForced: false,
    builderFullGrid: false,
  },
)

const emit = defineEmits<{
  patternSelect: [selection: ConceptPatternSelection]
  patternPreview: [selection: ConceptPatternSelection]
  customize: [selection: ConceptPatternSelection]
  quickSlotsCreate: [animations: readonly RootDataFinal[]]
  animationUpdate: [animation: RootDataFinal]
  builderOpen: [source: 'manual' | 'automatic']
  composerCellChange: [cell: ComposerCell | null]
  'update:builderFullGrid': [enabled: boolean]
}>()

const forwardSelection = (selection: ConceptPatternSelection) => {
  emit('patternSelect', selection)
}
</script>
