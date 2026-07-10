// Auto-load types that may be used frequently throughout the app

import type {
  CSSProperties as VueCSSProperties,
  Ref as VueRef,
  Component as VueComponent,
  ComponentPublicInstance as VueComponentPublicInstance,
} from 'vue'

//import type { DefineStore as PiniaDefineStore, _GettersTree, _ActionsTree, StoreState } from 'pinia'

declare global {
  type CSSProperties = VueCSSProperties
  type Ref<T = unknown> = VueRef<T>
  type Component = VueComponent
  type ComponentPublicInstance = VueComponentPublicInstance

  type HTMLElementUndef = HTMLElement | null | undefined

  /*
  // Generic base store type with default structure
  type DefineStore<
    Id extends string,
    State extends StoreState,
    Getters extends _GettersTree<State> = object,
    Actions extends _ActionsTree = object,
  > = PiniaDefineStore<Id, State, Getters, Actions>
  */
  interface Window {
    eruda?: {
      init: () => void
      show: () => void
      hide: () => void
      // Add more methods if needed
    }
  }
}

export {}
