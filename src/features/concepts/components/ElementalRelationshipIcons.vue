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
      <img
        v-if="token.imageUrl"
        class="base-icon elemental-relationship-icons__asset"
        :src="token.imageUrl"
        alt=""
        :width="size"
        :height="size"
      />
      <BaseIcon v-else :path="mdiCancel" :size="size" />
    </span>
  </span>
</template>

<script setup lang="ts">
// Element artwork by Austen Cloud, The Kinetic Alphabet (https://tkaflowarts.com),
// CC BY 4.0. The icons come straight from the @austencloud/tka-elements package so
// SpiroAnim always shows exactly what TKA renders on its pictographs; bump the
// package to pick up new artwork. Sun and Moon (quarter-time relationships) are
// Austen's extension of the elemental model. See ATTRIBUTION.md.
import airIconUrl from '@austencloud/tka-elements/icons/air.webp'
import earthIconUrl from '@austencloud/tka-elements/icons/earth.webp'
import fireIconUrl from '@austencloud/tka-elements/icons/fire.webp'
import moonIconUrl from '@austencloud/tka-elements/icons/moon.webp'
import sunIconUrl from '@austencloud/tka-elements/icons/sun.webp'
import waterIconUrl from '@austencloud/tka-elements/icons/water.webp'
import { mdiCancel } from '@mdi/js'

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
  imageUrl?: string
}

const relationshipIconUrls: Readonly<Record<ElementName | 'Sun' | 'Moon', string>> = {
  Earth: earthIconUrl,
  Water: waterIconUrl,
  Air: airIconUrl,
  Fire: fireIconUrl,
  Sun: sunIconUrl,
  Moon: moonIconUrl,
}
const createRelationshipTokens = (
  relationship: ElementalRelationship | undefined,
  indeterminate: boolean,
): readonly RelationshipToken[] => {
  if (indeterminate) return [{ symbol: 'Indeterminate', label: 'Indeterminate' }]
  if (!relationship) return []
  const symbol: Exclude<RelationshipSymbol, 'Indeterminate'> | undefined =
    relationship.timing === 'Q'
      ? relationship.direction === 'S'
        ? 'Sun'
        : 'Moon'
      : relationshipElement(relationship)
  return symbol ? [{ symbol, label: symbol, imageUrl: relationshipIconUrls[symbol] }] : []
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

.elemental-relationship-icons__asset {
  display: block;
  object-fit: contain;
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

.elemental-relationship-icons__icon--indeterminate {
  color: var(--color-status-error);
}
</style>
