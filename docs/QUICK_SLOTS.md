# Quick Slots

Quick Slots are persisted animation bookmarks shared by Concepts, Timeline, and Editor. This
document owns slot persistence, path semantics, interaction behavior, pane routing, and named sets.
VTG's `45° Trans'` batch-generation rules remain documented in
[`VTG_AND_QUARTER_SPACING.md`](./VTG_AND_QUARTER_SPACING.md).

The authoritative implementations are:

- `src/features/concepts/stores/useConceptsStore.ts` for persisted slots and named sets.
- `src/features/concepts/components/QuickSlotsControl.vue` for slot interaction and display.
- `src/composables/useMainRoute.ts` for startup restoration and saving animation changes.
- `src/views/SpiroAnim.vue` for applying a slot and choosing its pane.
- `src/components/SpiroAnim/AnimTimeline.vue` for Timeline placement.
- `src/components/layout/QuickSlotSetsDialog.vue` for named-set management.

## Slot state and interaction

Quick Slots can be disabled with a count of zero. Creating the initial four slots selects Q1;
adding one slot selects the newly created slot. Count, selected slot, saved paths, named sets, and
the last loaded or saved set ID persist in the Concepts store.

Clicking an empty slot selects it and immediately stores the currently loaded animation. A selected
slot is updated only when the serialized animation query changes. Rearranging panes, switching
between Editor and Timeline, or making another path-only route change must not rewrite it. A
selected empty slot also remains selected across concept-only route changes.

A saved slot has a dot in its bottom-right corner. Desktop tooltips identify whether the slot is
empty or saved and add a second `Loads: <path>` line for saved slots. The same shared touch-device
rule used elsewhere disables those tooltips on touch devices.

Holding a populated slot for at least 500 ms clears its value. Moving more than 10 pixels cancels
the gesture. The synthesized click following a completed touch long-press is consumed so an iPad
cannot clear and then immediately refill the slot. Delete and Backspace provide the keyboard clear
operation. Double-click does not clear a slot.

## Path and pane semantics

Slot identity is the serialized animation query, not its route path. This allows the same animation
to stay selected while its hosting pane changes.

Saving follows these path rules:

- Concepts preserves its current concept route.
- Timeline preserves its current Timeline route.
- Editor stores the Timeline counterpart: `edit` becomes `time`, so `/play-edit` becomes
  `/play-time`; `/editor` becomes `/timeline`.

On a fresh `/` or `/app` load with no animation query, a persisted selected slot is restored before
the empty-animation random Concepts fallback runs. If the slot contains a pattern, that pattern and
its stored route become the startup source. An invalid stored query clears the selected slot rather
than allowing fallback generation to overwrite it.

Applying a slot loads its animation and changes the source pane to the slot's target view when that
view is not already visible in the paired pane. Thus Concepts can become Timeline for a Timeline
slot, while Timeline or Editor can become Concepts for a concept slot. Editor does not switch away
when a slot targets Timeline because its Timeline is already visible inside Editor.

## VTG Pattern Builder exception

While VTG Pattern Builder is open, saved slots are load-only buttons rather than selected radios.
Loading one keeps the current concept and pane layout. With no Builder portion selected, it previews
the saved animation and hydrates the VTG grid without replacing the built pattern. With a portion or
trailing drop target selected, a recognized VTG/Quarter pattern uses that target as preview context,
just like clicking the VTG grid. Loading a slot never inserts a portion or changes the Builder timeline
or selection. Unrecognized patterns can still be previewed without a VTG grid match.
Empty slots are disabled in this mode. Opening Builder preserves the active slot and its highlight,
and Builder edits continue saving to it. Clicking a different saved slot previews its pattern while
keeping the current editing slot selected. Only clicking the selected slot itself clears the editing
selection. Route matching does not reselect a slot after that click. Previewing never selects the
borrowed slot as a save target.

## Timeline placement

Timeline renders Quick Slots inside its vertical scroll container. They normally occupy layout
space above the first thumbnail row. When the selected slot is empty or targets Timeline, the
control becomes sticky at the top of that same scroll area; it never becomes an app-level fixed
header. The first thumbnail row receives the same workspace separator color on its top edge that
the Timeline uses below thumbnails.

## Named sets

The main menu's Quick Slots dialog snapshots the current slot paths and selected slot into a named,
ID-backed set in local storage. Saving is available only when Quick Slots are enabled and at least
one slot contains an animation. Default names use the first unused `Quick Slot Set #N` value.

Selecting a set loads its name into the text field. With a set selected, Save New is disabled and
Overwrite, Load, and Delete operate on that ID. The last loaded or saved set is selected when the
dialog reopens. Delete uses a confirmation dialog with a component-lifetime `Do not show again`
choice.

## Regression coverage

Changes should cover persistence and hydration, empty-slot saving, animation-only updates,
query-only identity, startup ordering, route conversion, pane selection, touch long-press click
suppression, named-set CRUD, Timeline sticky/non-sticky placement, and atomic VTG batch creation.
VTG batch creation must leave the current set unchanged if any generated extraction is not
recognized by the normal pattern matcher.
