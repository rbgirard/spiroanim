// src\stores\SpiroAnim\panes\useMainPaneStore.ts

import { createPaneStore } from '@/stores/createPaneStore'

/**
 * Defines the logical "views" that can be dynamically assigned to a pane.
 * Each entry must match the `data-type="..."` and `ref="..."` on its corresponding DOM element or component.
 *
 * Example:
 * <PlayerComponent ref="ePlayer" data-type="player" />
 */
export const viewKeysMain = ['player', 'editor', 'timeline'] as const

/**
 * Defines the available panes that views can be moved between.
 *
 * - 'left' and 'right' are visible containers.
 * - 'hidden' is used as an off-screen DOM container to preserve inactive views.
 *
 * Layout Notes:
 * 1. Each **view component** must include both:
 *    - `ref="ePlayer"` (or equivalent) → must match `e${capitalize(viewKey)}`
 *    - `data-type="player"` → must match the string value of the view key
 *
 *    Example:
 *    ```html
 *    <PlayerComponent ref="ePlayer" data-type="player" />
 *    <EditorComponent ref="eEditor" data-type="editor" />
 *    <TimelineComponent ref="eTimeline" data-type="timeline" />
 *    ```
 *
 * 2. Each **pane container** must use the appropriate `ref` so the system can insert views:
 *    - `ref="eLeft"` for the left pane
 *    - `ref="eRight"` for the right pane
 *    - `ref="eHidden"` for the hidden (off-screen) container
 *
 * 3. Views should be rendered inside the **hidden pane by default**.
 *    The store will automatically move DOM elements to the correct pane container when assigned.
 *    You should specify default pane assignment for each visible pane using the `defaults` map.
 *
 * 4. If the view should be **destroyed/unmounted when hidden** (e.g. for resource-heavy components), use:
 *    ```html
 *    <TimelineComponent
 *      v-if="parents.timeline !== 'hidden'"
 *      ref="eTimeline"
 *      data-type="timeline"
 *    />
 *    ```
 *    This ensures it is completely torn down when not in use.
 *
 * Example layout container structure:
 *
 * ```html
 * <div ref="eLeft" class="pane" />
 * <div ref="eRight" class="pane" />
 *
 * <div ref="eHidden" style="display: none">
 *   <PlayerComponent v-if="parents.player !== 'hidden'" ref="ePlayer" data-type="player" />
 *   <EditorComponent v-if="parents.editor !== 'hidden'" ref="eEditor" data-type="editor" />
 *   <TimelineComponent v-if="parents.timeline !== 'hidden'" ref="eTimeline" data-type="timeline" />
 * </div>
 * ```
 */
export const paneKeysMain = ['left', 'right', 'hidden'] as const

/**
 * Creates the reactive pane store that tracks which view is assigned to which pane,
 * and ensures the corresponding DOM elements are moved accordingly.
 *
 * You should pass a `defaults` map assigning specific views to visible panes,
 * such as `{ left: 'player', right: 'timeline' }`.
 * Any view not included in `defaults` will be initialized in the hidden pane.
 *
 * Example usage:
 *   const paneStore = usePaneStore()
 *   paneStore.setViewInPane('editor', 'right')
 *   paneStore.rotatePane('left')
 */
export const useMainPaneStore = createPaneStore('main', viewKeysMain, paneKeysMain, 'hidden', {
  left: 'player',
  right: 'timeline',
})
