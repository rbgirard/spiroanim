<template>
  <span
    class="elemental-relationship-icons"
    :class="{ 'elemental-relationship-icons--responsive': responsive }"
    :aria-label="tokens.map(({ label }) => label).join(' / ')"
  >
    <span
      v-for="(token, index) in tokens"
      :key="`${token.label}-${index}`"
      class="elemental-relationship-icons__icon"
      :class="`elemental-relationship-icons__icon--${token.symbol.toLowerCase()}`"
      :data-element="token.symbol"
    >
      <BaseIcon :path="relationshipIcons[token.symbol]" :size="size" />
    </span>
  </span>
</template>

<script setup lang="ts">
import {
  mdiCancel,
  mdiEarth,
  mdiFire,
  mdiMoonWaningCrescent,
  mdiWeatherSunny,
  mdiWater,
  mdiWeatherWindy,
} from '@mdi/js'

import BaseIcon from '@/components/icons/BaseIcon.vue'
import {
  relationshipElement,
  type ElementalRelationship,
  type ElementName,
} from '@/features/concepts/elementalRelationships'

const props = withDefaults(
  defineProps<{
    hands?: ElementalRelationship
    props?: ElementalRelationship
    handsIndeterminate?: boolean
    propsIndeterminate?: boolean
    size?: number | string
    responsive?: boolean
  }>(),
  {
    handsIndeterminate: false,
    propsIndeterminate: false,
    size: 18,
    responsive: false,
  },
)

type RelationshipSymbol = ElementName | 'Sun' | 'Moon' | 'Indeterminate'
interface RelationshipToken {
  symbol: RelationshipSymbol
  label: string
}

const relationshipIcons: Readonly<Record<RelationshipSymbol, string>> = {
  Earth: mdiEarth,
  Water: mdiWater,
  Air: mdiWeatherWindy,
  Fire: mdiFire,
  Sun: mdiWeatherSunny,
  Moon: mdiMoonWaningCrescent,
  Indeterminate: mdiCancel,
}
const createRelationshipTokens = (
  relationship: ElementalRelationship | undefined,
  indeterminate: boolean,
): readonly RelationshipToken[] => {
  if (indeterminate) return [{ symbol: 'Indeterminate', label: 'Indeterminate' }]
  if (!relationship) return []
  // The Sun/Moon quarter-time extension is attributed in THIRD_PARTY_NOTICES.md.
  const symbol: RelationshipSymbol | undefined =
    relationship.timing === 'Q'
      ? relationship.direction === 'S'
        ? 'Sun'
        : 'Moon'
      : relationshipElement(relationship)
  return symbol ? [{ symbol, label: symbol }] : []
}
const tokens = computed<readonly RelationshipToken[]>(() =>
  [
    { relationship: props.hands, indeterminate: props.handsIndeterminate },
    { relationship: props.props, indeterminate: props.propsIndeterminate },
  ].flatMap(({ relationship, indeterminate }) =>
    createRelationshipTokens(relationship, indeterminate),
  ),
)
</script>

<style scoped>
.elemental-relationship-icons {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
}

.elemental-relationship-icons__icon {
  display: inline-flex;
  align-items: center;
  filter: drop-shadow(0 0 1px var(--color-element-outline));
}

.elemental-relationship-icons--responsive :deep(.base-icon) {
  width: clamp(1rem, 3.5cqi, 2rem);
  height: clamp(1rem, 3.5cqi, 2rem);
}

.elemental-relationship-icons__icon + .elemental-relationship-icons__icon::before {
  margin-inline-end: var(--space-1);
  color: var(--color-text-muted);
  content: '/';
  font-size: 0.72em;
  font-weight: 700;
}

.elemental-relationship-icons__icon--earth {
  color: var(--color-element-earth);
}

.elemental-relationship-icons__icon--water {
  color: var(--color-element-water);
}

.elemental-relationship-icons__icon--air {
  color: var(--color-element-air);
}

.elemental-relationship-icons__icon--fire {
  color: var(--color-element-fire);
}

.elemental-relationship-icons__icon--sun {
  color: var(--color-element-sun);
}

.elemental-relationship-icons__icon--moon {
  color: var(--color-element-moon);
}

.elemental-relationship-icons__icon--indeterminate {
  color: var(--color-status-error);
}
</style>
