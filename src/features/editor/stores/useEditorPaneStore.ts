// src\features\editor\stores\useEditorPaneStore.ts

// See useMainPaneStore.ts for more info

import { createPaneStore } from '@/stores/createPaneStore'

export const viewKeysMain = ['properties', 'timeline'] as const
export const paneKeysMain = ['top', 'bottom', 'hidden'] as const

export const useEditorPaneStore = createPaneStore('editor', viewKeysMain, paneKeysMain, 'hidden', {
  top: 'properties',
  bottom: 'timeline',
})
