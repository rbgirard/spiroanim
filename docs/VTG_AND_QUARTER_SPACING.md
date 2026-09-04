# VTG and QTR Mode

This document describes the Concepts controls and the shared VTG/QTR pattern pipeline,
including player settings, transforms, matching, relationship classification, and matrix headers.
These controls are separate from the editor property-panel pipeline documented in
[`PROPERTY_CONTROLS.md`](./PROPERTY_CONTROLS.md).

Eight Step uses the same shared Concepts controls but has a separate pattern model documented in
[`EIGHT_STEP.md`](./EIGHT_STEP.md).

## Quarter Spacing versus Quarter Timing

These terms describe different properties and must not be used interchangeably:

| Term                                  | Definition                                                                                                                                                 | Effect on `Hands / Props` labels                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Quarter Spacing**                   | The QTR geometry transform. It changes the pattern's spatial arrangement through a 90-degree first-frame arc adjustment.                                   | None by itself. Enabling QTR does not force either timing letter to `Q`.                                            |
| **Quarter Timing** (**Quarter Time**) | A directed phase relationship. The two hands or two props reach the shared bottom reference 90 or 270 degrees apart, meaning one leads by a quarter-cycle. | Produces `Q` independently on the applicable side of the slash. Direction is still separately `S`ame or `O`pposite. |

The slash order is always `Hands / Props`. Each side is classified independently, so Quarter
Timing in one system says nothing about the other system's timing. Quarter Spacing often creates a
Quarter Timing relationship, but that is a result of the generated motion rather than a naming
rule. Valid combinations therefore include:

- `TS / QS`: Together/Same hands with Quarter/Same props. This has prop Quarter Timing without the
  Quarter Spacing transform.
- `QS / SS`: Quarter/Same hands with Split/Same props. This uses Quarter Spacing while the props are
  not in Quarter Timing.
- `QO / QS`: Quarter/Opposite hands with Quarter/Same props. Both systems have Quarter Timing, but
  their direction relationships differ.

The authoritative implementations are:

- `src/features/vtg/data/vtgPlayerSettings.ts` for numeric controls and rendering settings.
- `src/features/vtg/data/vtgPatternCatalog.ts` for the VTG pattern catalog and builder inputs.
- `src/features/vtg/math/` for VTG building, matching, and relationship classification.
- `src/features/vtg/math/createVtgTransitionQuickSlotAnimations.ts` for reciprocal-transition
  Quick Slot extraction and cyclic phase candidates.
- `src/features/vtg/qtr/` for the VTG-owned QTR transforms, matching, labels, and frame-derived
  headers, with the shared QTR contracts in `src/features/vtg/types.ts`.
- The shared Concepts store for the selected concept, Quick Slots, QTR mode, Speed Ratio, Swap,
  and 180° state.
- `src/math/animation/subdivideAnimationPlayback.ts` for frame subdivision that preserves the
  visible path while changing the authored playback rate.

## Control and player behavior

The Concepts pane does not use `PropertyPanel`, `DynamicVal`, or `useProperties.constraints()`.
Its VTG and Eight Step panels use the same native player and transform controls. VTG sends a
`VtgPatternSelection` to the VTG builder when QTR is disabled and a `QtrPatternSelection` to the Qtr
builder when QTR is enabled. Eight Step sends an `EightStepPatternSelection` to its builder. QTR,
Speed Ratio, Swap, 180°, and the player controls are held in the shared Concepts store so their
applicable values remain unchanged when switching panels. Persisted selections from the retired
Quarter Spacing panel migrate to VTG with QTR enabled. Legacy Quarter Spacing routes do the same and
then canonicalize to the VTG route.

The Quick Slots control appears above the concept selector and is also available inside Timeline
and Editor. Slots persist complete animation paths, update only after animation changes, and can be
saved as named sets. Their interaction, startup, routing, and Timeline placement contracts are
documented in [`QUICK_SLOTS.md`](./QUICK_SLOTS.md).

Scale, Thick, Spacing, and BPM appear below the Starting Beat and transition controls in VTG. Each
slider gesture is one undo step. The sliders begin a query
history group on pointer-down or key-down and end it on pointer-up, pointer-cancel, key-up, or blur,
matching the editor slider interaction boundary. Touch and pen pointer input allows vertical page
panning without relying on device or user-agent detection. If the browser cancels a slider gesture
to begin page scrolling, its original value is restored rather than committing the touch-down
position.

Paths, Hands, Arms, Left, and Right are native checkbox controls above the sliders. Left and Right
represent `props[0]` and `props[1]` and default to checked. Unchecking one writes `paths`, `hands`,
`arms`, and `visible` as `false` on that prop; checking it removes those prop-level overrides so
they are inherited and omitted from the query string. At least one prop must remain enabled;
disabling the only enabled side automatically enables the other side. VTG and Quarter Spacing
players default to Paths on, Hands off, and Arms on; non-default choices are added to the pattern
selection before the player animation is built. These choices are intentionally excluded from
`usePatternPreviews`: thumbnail animations always use their canonical Paths-on, Hands-off,
Arms-off rendering settings.

Current VTG numeric behavior is:

| Control                | UI range and step    | Stored transform                                                    |
| ---------------------- | -------------------- | ------------------------------------------------------------------- |
| BPM                    | 40..140, step 1      | Explicitly clamped by `clampVtgBpm()`                               |
| Scale                  | 0.5..1.4, step 0.1   | Explicitly clamped, multiplied by 10, and rounded for frame `scale` |
| Scale-derived Distance | Piecewise 14..15..25 | Interpolated from Scale and rounded to the nearest whole number     |
| Thick                  | 1..15, step 1        | Defaults to 5 and is passed directly from the UI selection          |
| Spacing                | 0..20, step 1        | Alternates precise horizontal placement between the two props       |

Spacing is a persisted Concepts preference and is never inferred from a loaded pattern. Its
default is `1`. The integer value is distributed outward one step at a time: `0 -> (0, 0)`,
`1 -> (+1, 0)`, `2 -> (+1, -1)`, `3 -> (+2, -1)`, and so on. These placements are stored as one
Precision Motion frame per nonzero prop. In QS v6 the first positive and negative moves encode as
`m0=_1_mxqv__` and `m1=_1_J1qv__`, respectively.

The Scale-to-Distance mapping uses a pivot:

```text
Scale 0.5 -> Distance 14
Scale 0.6 -> Distance 15
Scale 1.4 -> Distance 25
```

Values between those points are linearly interpolated within their side of the pivot and then
rounded. For example, Scale `0.8` produces Distance `18`.

VTG builds a new two-prop pattern, merges most current root settings, applies the selected rendering
features, replaces pattern props, and then assigns `ROOT.value`. The normal route watcher
subsequently serializes it.

VTG matching identifies patterns from their normalized authored `turns`, `arc`, `plane`, and `axis`
frame values. Scale is recovered separately from the first frame's internal hundredths, while Warp
and Strength are deliberately excluded from the structural signature. Matching authored frames
is important because two closed cycles can compile to the same geometry while retaining different
first-frame instructions that identify their selected starting beat. The authored rotation axis is
also pattern-defining and distinguishes cells whose hand paths coincide but whose prop rotations do
not. Equivalent positive and negative angles are normalized before comparison. Root Distance is not
part of the pattern signature, so a distance mismatch does not by itself stop a match. Candidate
indexes derive shifted and doubled variants incrementally from each base pattern and are built only
for the active concept.

When several control combinations produce the same authored pattern, matching tries every Starting
Beat position before changing the current Swap, 180-degree, or Qtr mode. The lowest Starting Beat is
used only to break a tie between candidates that preserve the same current transform controls.
Nonzero rotations are a last-resort canonical match: an available unrotated candidate wins before
a rotated candidate at every ratio. Transition Quick Slot generation applies the stronger
exact-first rule described below. Within each match tier it exhausts unrotated VTG and QTR phases
before rotated phases. The matcher and selector use the same canonical orientation rule.

The rotation selector is also canonicalized at the pattern-family level. Availability checks all
four Starting Beats and is invariant under the selected Beat, Swap, and 180-degree controls. A
rotation is omitted when it is beat-equivalent to the unrotated pattern family. Shape and QTR remain
inputs because they change the pattern before the final rotation comparison.

For ordinary 1:3 Diamond VTG, every cell currently canonicalizes to `0°`. The deterministic
exceptions are mode-dependent:

| Mode        | Cells whose rotation selector remains enabled                               |
| ----------- | --------------------------------------------------------------------------- |
| Box VTG     | `1-6`, `2-5`, `5-2`, `5-6`, `6-1`, `6-5`                                    |
| QTR Diamond | `1-5`, `1-6`, `2-6`, `5-1`, `5-2`, `5-5`, `5-6`, `6-1`, `6-2`, `6-5`, `6-6` |
| QTR Box     | `1-5`, `2-6`, `5-1`, `5-5`, `6-2`, `6-6`                                    |

This difference is expected from rotation-last canonicalization and is not by itself evidence that
the Quarter Placement relationships are incomplete.

Pattern matching runs in the shared, lazily created application-level pattern-matching worker. The
worker remains available for as long as a mounted Concepts pane has VTG, Eight Step, or QST selected,
preserving generated candidate indexes across animation changes. Hiding the Concepts pane or
selecting TKA starts a 30-second idle period. Returning to a matching concept during that period
cancels the pending shutdown, and a worker request is never interrupted. VTG requests include the
merged QTR matching result. TKA does not use this worker. Responses are versioned by the requesting pane so
an older result cannot overwrite newer animation data or a user interaction.

## Starting beat, QTR, and 45-degree transitions

VTG exposes Starting Beat radios `1` through `4` at the bottom of the Concepts pane. Beat `1` is the
default. Each following value applies one additional closed-cycle frame shift
to both prop tracks, so Beat `2` shifts once, Beat `3` twice, and Beat `4` three times. Reset returns
the control to Beat `1`; previews and compiled-geometry matching include the selected shift. Quarter
Spacing applies this shift to the completed QTR animation, after its quarter-arc transform, so the
control changes only the cycle's starting point rather than which source frame receives the QTR
adjustment. The responsive row is ordered Diamond, Box, QTR, beats `1` through `4`, and the
`45° Trans'` button. QTR switches the matrix labels, cell descriptions, previews, generated
selection, matching behavior, headers, and the meaning of the shared transform control as one mode
change. The control is labeled `180°` in VTG and `Flip` in QTR. QTR has no separate
quarter-orientation radios.

The reciprocal transition internally subdivides every authored frame interval in two and doubles
the stored animation BPM before adding its relationship changes. The added frame is the midpoint of
the interval: incremental turns and arcs are
halved, while scale, strength, depth, and adjustment values are interpolated. The BPM control continues to
show the user's original value, and matching maps the stored BPM back to that displayed value.
Because both rate and frame count change by the same multiplier, total duration, interval endpoints,
and visible motion remain unchanged. Subdivision derives its output from the animation's actual
frame tracks and does not assume a fixed pattern length. Added frames remain sparse: inherited
animation values and zero-angle defaults are omitted unless a frame must explicitly change them.

The reciprocal transition toggle is labeled `45° Trans'`. Starting from the internally subdivided
closed cycle, the transform inserts one
doubled beat before each relationship change, changes alternating prop tracks, and plays one full
derived cycle between changes. For a change frame, Plane is 180 and Turns is derived as
`-turns - 2 * arc`. This reverses the local rotation axis while preserving the compiled prop
rotation at the handoff. The process visits each prop twice, returning both tracks to their original
turn values before the animation loops into its original doubled cycle. Cycle and transition sizes
come from the animation and subdivision multiplier rather than fixed frame counts.

The transition controls and builder support every speed ratio on development and production hosts.
When the transition is enabled at 1:1 or 1:2, the interface warns that some or all of these 45°
Transitions may only work with Static Props in the current ratio selection.

Matching does not precompute the extended transition animations. Their derived frame-count shape is
used to recover the internally subdivided base cycle; the
remaining extended frames are treated as the transition produced by this control. Both the in-memory
form and the URL form with trailing inherited frames omitted are recognized.

When a reciprocal transition is detected, the orange QSlots button can replace the current slots
with five generated animations. It warns only when Quick Slots are enabled and at least one current
slot is populated. The replacement leaves every slot unselected.

The first generated slot is the complete detected transition. The next four correspond to the four
relationship-change segments. Each segment is shifted to its transition boundary, reduced to its
first two authored frames, and padded with inherited frames to the doubled base-cycle length. The
raw extraction is considered first, followed by every cyclic phase. Generation exhausts normal
exact matches before transition-derived first-frame Turns matches. Within each tier, it accepts an
unrotated phase before considering rotated matching; it does not change prop direction to
manufacture a match.

A closed extraction may retain a shared `-45°` or `45°` first-frame Turns state from its transition
handoff. These states use the same VTG/QTR candidate process at every speed ratio; there is no
separate odd/even matcher. They are indexed only for doubled closed patterns and only after normal
exact candidates, so an ordinary pattern cannot be reinterpreted as a transition-derived variant.
Regeneration preserves the exact result by subdividing the selected closed pattern first and then
applying the retained first-frame Turns state. Applying it before subdivision is not equivalent and
would incorrectly create `22.5°` continuation frames. The state does not add wall-plane rotation
options. It remains attached while editing the matched pattern, but selecting another matrix cell,
resetting, or starting another 45 Trans clears it. Its detected Starting Beat is retained separately:
when Beat changes, the builder completes the doubled pattern at that original beat and then applies
two semantic frame shifts per Beat step. Reapplying the Turns offset to frame 1 after changing Beat
would change the pattern's physical orientation instead of selecting another starting position.

Quick Slot generation resolves each extracted cycle independently through the normal matcher. It
exhausts exact unrotated phases, exact rotated phases, transition-derived unrotated phases, and
transition-derived rotated phases in that order. This prevents a hidden transition-derived Turns
state from replacing a normal rotated pattern whose visible controls can reproduce it. If no cyclic
phase resolves, that slot retains its raw generated extraction rather than preventing the other
slots from being created. The UI lists every unresolved slot so generated animation data is not
mistaken for a confirmed catalog match.

## Diamond and Box

VTG exposes the shared Diamond/Box radio controls immediately before the Starting Beat radios in
the responsive playback row.
Diamond is the default and preserves the source definition, so it is omitted from compact pattern
selections. Box rotates each prop's first-frame `arc` by 45 degrees: plane 0 uses `+45`, while plane
180 uses `-45` so both planes rotate in the same spatial direction. The original first continuation
arc is made explicit so sparse-frame inheritance cannot carry the Box adjustment into later frames.

Box is calculated from the authored VTG planes. Quarter Spacing then applies its QTR orientation,
followed by Starting Beat and the reciprocal transition when selected. Swap exchanges the
completed tracks. Outside QTR, `180°` reverses the completed pattern's initial motion planes. In QTR
Diamond, it first selects the alternate QTR orientation and then applies that plane reversal,
producing the alternate face-on presentation with the opposite travel direction. QTR Box is already
90-degree symmetric, so `180°` keeps the base QTR orientation and applies only the plane reversal.
Previews and compiled-geometry matching use the same order.

Cells `1-1`, `1-2`, `2-1`, `2-2`, `3-3`, `3-4`, `4-3`, and `4-4` have an intentional fixed shape in
their source patterns. Diamond and Box therefore produce identical animation data for those cells
in both VTG and Quarter Spacing.

## Quarter Spacing transforms

Quarter Spacing uses the former Qtr #1 transform as its base: it adds 90 degrees to the original
first animation track's first-frame arc. In QTR Diamond, the shared `180°` checkbox selects the former
Qtr #2 orientation by rotating the complete base QTR pattern another 90 degrees through equivalent
first-frame arc adjustments. Plane 0 receives +90 degrees and plane 180 receives -90 degrees so both
planes rotate in the same spatial direction without turning the presentation edge-on to the camera.
After playback transforms, the checkbox also applies the normal plane reversal so the alternate
orientation travels in the opposite direction. Because QTR Box hand paths are invariant under that
90-degree presentation rotation, Box skips the alternate-orientation step and applies only the normal
plane reversal. Arc adjustments wrap within 0-359 degrees. Reset clears `180°` and therefore returns
to the base orientation. QTR selections retain an internal quarter-mode discriminator fixed at `1`
for compatibility with existing selection and worker contracts. The QTR adjustments remain on their
authored tracks until final-stage plane reversal and Swap are applied.

QTR previews and matching apply the Qtr transform around the shared VTG pattern builder and matcher
so selected cells and shared options can be recovered when toggling QTR or loading animation data.

Quarter Spacing and Quarter Time are related but independent concepts. Quarter Spacing names the
90-degree QTR geometry transform. Quarter Time (`Q`) is a timing classification: the two members of
the classified system reach the common bottom reference one quarter-cycle apart. Applying Quarter
Spacing does not force either half of the `Hands / Props` label to `Q`, and prop Quarter Time can
exist without Quarter Spacing. For example, a retained prop rotation can produce `TS / QS` in VTG,
while a QTR pattern whose prop phase is counter-rotated can produce `QS / SS`.

## Relationship classification

Matrix labels and cell tooltips are derived from each compiled pattern rather than a cell-label
table. Hands and Props are classified independently with the same directed-phase definition. Hand
timing measures each hand position against the common bottom reference along its physical path axis.
Prop timing measures each prop orientation against bottom along its physical spin direction. Equal
directed phases are Together (`T`), phases separated by 180 degrees are Split (`S`), and phases
separated by 90 or 270 degrees are Quarter (`Q`). Directed phase is necessary for
Opposite-direction patterns: two members can occupy the same Cartesian orientation while having
Split timing, or occupy mirrored orientations while reaching bottom Together.

The prop orientations are evaluated at the VTG three-quarter semantic checkpoint. Unequal ratios
change the Cartesian endpoint reached in one beat, so both starting orientations are advanced by the
same canonical phase along their real incoming axes instead of treating the compiled endpoints as
the timing definition. At 1:3, this checkpoint is the ordinary compiled destination, preserving the
established 1:3 labels. The generated tooltip expands the independent results as
`Hands: Timing / Direction` and `Props: Timing / Direction`.

An unrotated matrix classifies the destination rule relationship. A 90-degree pattern orientation
swaps the horizontal and vertical rule axes, so the same classifier uses the source relationship.
This transposes the logical relationship matrix without a cell-label map; for example, rotated
`2-1` corresponds to unrotated `1-2`. Both directions retain the real path axes when deriving Same
or Opposite. At 1:2 and 1:4, the rotation selector retains both quarter-turn directions. At 1:1,
1:3, and 1:5, `-90°` and `90°` resolve to the same quarter-turn class after beat, Swap, and 180
matching, so only the canonical positive `90°` value is generated and matched. There is no legacy
`-90°` recovery path. The 1:1 and 1:5 sets retain `180°`; 1:3 does not require it.
The 180-degree orientation rotates the starting arcs by a half-turn but does not swap the matrix or
header axes, so it retains the destination relationship checkpoint and established matrix layout.

Some compiled 180-degree animations are exactly equivalent to another cell, starting beat, Swap
state, or orientation. Pattern matching retains the exact 180-degree selection among its candidate
matches, and the last emitted selection prevents an immediate UI reclassification. Animation-only
hydration, including a URL reload without selection metadata, may canonicalize an ambiguous result
to another equivalent interpretation because the rendered animation does not contain enough
information to distinguish how it was authored.

The selected Beat is part of relationship classification. Every Beats slider input rebuilds and
reclassifies every matrix cell at that playback origin, so the labels always describe the currently
selected beat. Thumbnail stills are rendered at that new time-zero pose, so the displayed prop can
move around an unchanged closed path as Beat changes; the path geometry itself remains invariant.
Equal-rate standard VTG and QTR patterns are reclassified but retain the same Hands and Props timing
relationships across Beats. For a compound ratio, the matrix also determines
whether each side can retain one truthful label for the complete repeating Beat cycle. Each
half-Beat shift advances a prop by 45 degrees times its `denominator / numerator` rate. Together and
Split remain stable only when the relative advance closes modulo 360 degrees. Quarter remains
stable when it closes modulo 180 degrees because both 90 and 270 degrees are Quarter Timing. This
calculation is exact ratio arithmetic, not a per-cell label table or an exhaustive list of special
cases. Retained per-prop phase alignment is a table-wide geometric offset defined against the
pattern's Beat 1 rotation axes. After Shift reconstructs a new starting frame, the offset is
translated through that frame's local rotation-axis gauge. This keeps one offset geometrically
identical even when adjacent shifted frames use opposite internal axis representations. Because
animation channels inherit omitted values, applying the offset also materializes the following
frame's original `turns` value; otherwise a compacted Shift result could accidentally inherit the
alignment offset as the motion for every later interval.

When a side is uncalculable or would use different timing codes at different Beats, text layout
shows `XX` for only that side and Elemental layout shows a red prohibited icon. A stable side remains
visible, so `TS / XX` means the Hands relationship is consistently Together/Same while the Props
relationship has no single valid whole-cycle label. Internally, the selected-Beat classifier still
returns the exact relationship at that Beat for matching and inference. Hand phase advances equally
on both tracks in the VTG/QTR model, so a calculable Hands relationship is Beat-invariant; an
uncalculable Hands relationship receives the same `XX`/prohibited treatment.

The QTR/VTG transition controls remain excluded from cell relationship classification because they
describe a transition away from the selected catalog pattern rather than its starting relationship.
Shape, Speed Ratio, Anti, Swap, 180°, QTR mode, retained prop rotation, and Beat remain relationship
inputs. This rule is applied uniformly; there is no cell-label table, forced label, canonical-beat
override, or cell-specific exception.

Prop direction is classified separately from prop timing. Each compiled rotation axis is multiplied
by the sign of that track's rotation amount (`turns + arc`) to obtain its physical angular-velocity
axis. Parallel signed axes are Same (`S`), and antiparallel signed axes are Opposite (`O`). This
avoids confusing an axis representation with the rendered spin direction and requires no hand-phase
or spacing correction. Cell `6-3`, for example, remains `SO / TS` in VTG and `QO / QS` in its base
Quarter Spacing form across the supported transforms.

## QTR headers

Qtr header display labels remain configured separately in `qtrLabels.ts`. Enabling QTR disables all
header tooltips because the normal VTG descriptions do not explain the transformed header
states. It also hides every header divider, including rule 5's offset divider, and hides the prop
diagrams in the top headers. The left-header prop diagrams remain visible.

The visible QTR header props mirror the rendered POI material colors. Each prop's large
end is the head (`COLSET` slot 0), its small end is the handle (`COLSET` slot 1), and its connecting
line is the tether (`COLSET` slot 2). The first header prop uses VTG's Green color set and the second
uses VTG's Orange color set, matching the generated animation's prop colors.

In QTR mode, each left-header prop diagram is recalculated from the first compiled frame of
the first cell in that row (`1-1` through `1-6`). The closest cardinal direction of `pos` selects
top, right, bottom, or left. The sign of `pos dot rot` selects out or in. Placements reuse the exact
bounds demonstrated by left rule 2 for left/right and top rule 2 for top/bottom. Swap and 180°
participate in this calculation. Tilted does not: header positions always derive from the
corresponding non-Tilted pattern.

The top-header prop diagrams are not displayed in QTR mode.

The 1:2 and 1:4 VTG ratios also hide the top-header labels, prop diagrams, dividers, and tooltips
while retaining the numbers and selection behavior. At 1:1 and 1:5, the visible top-header rules
are remapped by physical column as `3, 4, 1, 2, 5, 6`. The 1:3 top headers retain their standard
`1, 2, 3, 4, 5, 6` mapping.

The 180° control mirrors each left header from left to right. Its title block, divider, and regular
prop placements move together, including which end of a prop is rendered as the head. Rotated
left-header titles are right-aligned against the right edge. Header numbers remain in their normal
bottom-right position. Top headers keep their normal layout when 180° is enabled. Quarter
Spacing header props are not mirrored a second time because their positions already come from
compiled frames that include the 180-degree transform; the surrounding title layout still mirrors
normally.

## Regression coverage

Changes in this area should cover the applicable behavior:

- BPM, Scale, Thick, Spacing, and derived Distance boundaries.
- One undo step per continuous slider gesture.
- Player-only Paths, Hands, and Arms settings remaining separate from thumbnails.
- Pattern building, matching, Swap, 180°, Diamond/Box, fixed-shape cells, starting-beat shifts,
  Internal transition subdivision, reciprocal QTR/VTG transitions, speed ratios, and both Qtr modes.
- Phase-first transition Quick Slot extraction and rotation-last matching/canonicalization.
- Relationship classifications derived from compiled geometry, including the `6-3` `QO/QS`
  reference.
- Header labels, tooltip availability, dividers, colors, and prop placement.
- Full generated patterns through query encode/decode when serialized fields change.

The broad 45-transition catalog scan is intentionally opt-in because it evaluates 21,600 generated
source selections and takes substantially longer than a focused unit test. Run it with
`npm run audit:vtg-45-trans`. It is not discovered by `npm run test:unit` and is not part of the
normal build.

### Known 45-transition audit findings

The current audit covers all five ratios, both Diamond and Box, every matrix cell, all four Starting
Beats, transition lengths 2 through 6, and the normal, Quad-first, and Quad-second transition modes.
That produces 21,600 source transitions and 86,400 generated Q2-Q5 extractions. Q2 resolves for
every source. Of all generated extractions, 53,808 resolve and 32,592 remain unmatched:

| Ratio | Q3 unmatched | Q4 unmatched | Q5 unmatched | Total unmatched |
| ----- | ------------ | ------------ | ------------ | --------------- |
| 1:1   | 3,150        | 2,176        | 3,150        | 8,476           |
| 1:2   | 1,830        | 0            | 1,830        | 3,660           |
| 1:3   | 3,360        | 2,240        | 3,360        | 8,960           |
| 1:4   | 1,520        | 0            | 1,520        | 3,040           |
| 1:5   | 3,140        | 2,176        | 3,140        | 8,456           |

Every one of the 53,808 recognized extractions regenerates exactly from its selected VTG or QTR
controls after accounting for legitimate doubled playback. Verification compares BPM, normalized
authored signatures, and compiled position, rotation, and adjustment vectors. The rotation-option
integrity scan also passes at every ratio. Runtime generation retains an unresolved slot's raw
extraction while reporting it to the user, so unresolved data is not substituted with a different
catalog animation.

Continuation work should determine why the literal doubled-frame Q3/Q4/Q5 extractions are not
recognized by the normal VTG/QTR matcher. Do not replace them with a nearest catalog animation,
silently canonicalize their authored frames, add a hidden rotation index, or introduce a recovery
lookup. The generated animation must remain the literal edited cycle demonstrated by the supplied
URLs. Cyclic phase comparison and exact-before-transition-derived precedence are intentional domain
rules and should remain in place while the underlying extraction or matching semantics are
corrected.
