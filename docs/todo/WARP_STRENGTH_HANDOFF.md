# Warp and Strength hand-path handoff

## Purpose

This is the continuation note for the hand-path work discussed, implemented, and manually validated
on September 3, 2026. It is intended to make the task recoverable from another computer without
relying on the chat history.

At the final local update, the repository was on branch `dev` at commit `6ab38b2` (`Third Order
(begins)`) with an intentional closeout diff described below. The user intends to push that diff to
`dev` before resuming from another computer. Inspect `git status --short` and recent `dev` history
first; do not discard any remaining changes if the push has not happened.

**September 4, 2026 decision:** the implemented query-string v12 field ranges, ordering, and
grouping are accepted and locked. Keep the version number at 12 and treat the documented `pN`/`xN`
layout as the durable v12 contract.

The central result is a pair of Animation properties:

- **Warp** gives the hand path an independent Turns-like angular channel.
- **Strength** controls how strongly that auxiliary path deforms the ordinary hand path.

These properties affect the rendered hand location and all visualizations derived from it, but do
not alter the canonical animation state used by VTG/QST recognition or the prop's orientation.

## Original goal

The requested behavior began as a hand-path-only equivalent to Adjust:

- Adjust adds an orientation offset on top of Axis without redefining Axis.
- The new property was meant to add angular behavior to the hand path without redefining `pos`,
  `posx`, Arc, Plane, Turns, or the prop's rotation.
- The desired results were rounded in-spin and anti-spin flower/lobe paths, including arbitrary VTG
  timing ratios such as `1:3`, `2:3`, and other supported ratios.
- The hand path had to be independently tunable without requiring negative Depth.
- Scale had to continue controlling the size of the entire result rather than being overloaded as
  the lobe-depth control.
- Paths, nodes, selection feedback, and related editor displays had to show the rendered hand path.
- VTG/QST matching had to continue recognizing the same conceptual animation while intentionally
  ignoring this extra rendered-path styling.

The first name was **Bend**, but that was rejected because Bend already has a meaning in Flow Arts
and would be confusing. The chosen names are **Warp** and **Strength**.

## Approaches that were tried and rejected

These failures are important because they explain why the current model has two properties and an
independent compiled vector.

### A fixed endpoint offset

An early interpretation treated the new angle as a simple endpoint adjustment. That could move a
hand endpoint and draw a straight line to it, but it could not generate the desired continuous
rounded ratio paths.

### Making Warp depend directly on Arc interpolation

An early implementation only produced useful-looking connections at special angular increments,
especially multiples of 45 degrees. Around 29/30 degrees appeared closest for a three-lobe test,
but this was an approximation rather than a general timing model. It also made the result dependent
on the authored Arc arrangement, which violated the requirement that VTG concepts remain intact.

The current approach still uses the segment's Arc as the canonical displacement, but Warp is a
separate accumulated angular channel. It does not rewrite Arc or the canonical path.

### Using Depth to control lobe size

Negative Depth could create some visually related results, but it changes a different spatial
property and was explicitly rejected. Hand-path shaping must not depend on negative Depth.

### Using Scale for both outer radius and lobe depth

Scale initially appeared sufficient to pull parts of the path inward, but this coupled two controls
that must remain independent. Scale now controls the whole result's outer size. Strength controls
the deformation and how deeply the rounded lobes move inward.

### A single Bend/Warp property

One angular value can define the relative timing, but it cannot also independently set the lobe
depth. This is why Warp and Strength are separate.

## Final geometry model

Compilation maintains two hand-path vectors:

- `C`: the canonical hand vector, compiled from the existing `pos`, `posx`, Plane, and Arc rules.
- `W`: an auxiliary Warp vector, compiled in parallel using the same authored Plane but its own
  accumulated orientation state (`warpPos` and `warpx`).

For a Spherical segment:

- the canonical vector rotates by `Arc`;
- the auxiliary vector rotates by `Arc + Warp`;
- Strength blends the vectors;
- Scale is applied to the complete blended result.

The rendered hand position is:

```text
s      = raw Strength / 1000
weight = s / 2
hand   = Scale * ((1 - weight) * C + weight * W)
```

Consequences:

- Strength `0%` gives the established canonical position: `Scale * C`.
- Strength `100%` gives an equal blend of `C` and `W`.
- If `C` and `W` oppose each other at 100%, their midpoint is the center.
- Intermediate Strength values make shallower, rounder lobes that can stay away from the center.
- If `C` and `W` align, Strength does not change the outer radius.
- Scale acts on the entire shape after deformation.
- Negative Scale reverses the final position as it did before.
- Scale zero remains valid and simply collapses the final position to the center; Warp's internal
  vector direction can still exist independently.

The pure blend function is `applyWarpPath()` in
`src/math/animation/warpPathInterpolation.ts`.

## Warp timing and in-spin/anti-spin

Warp is intentionally analogous to Turns, but only for the auxiliary hand-path vector:

```text
canonical displacement = Arc
auxiliary displacement = Arc + Warp
```

Comparing the signed canonical and auxiliary displacement gives the visual timing direction:

- same signed direction: in-spin-style hand path;
- opposite signed direction: anti-spin-style hand path.

This mirrors the general VTG ratio equations. For a reduced timing ratio `p:q` and one segment:

```text
Anti Warp = -Arc * (p + q) / p
In Warp   =  Arc * (q - p) / p
```

For a 45-degree segment:

| Ratio | Spin |     Warp | Auxiliary `Arc + Warp` | Relative lobes over cycle |
| ----- | ---- | -------: | ---------------------: | ------------------------: |
| `1:1` | Anti |    `-90` |                  `-45` |                         2 |
| `1:1` | In   |      `0` |                   `45` |                         0 |
| `1:3` | Anti |   `-180` |                 `-135` |                         4 |
| `1:3` | In   |     `90` |                  `135` |                         2 |
| `2:1` | Anti |  `-67.5` |                `-22.5` |                         3 |
| `2:1` | In   |  `-22.5` |                 `22.5` |                         1 |
| `2:3` | Anti | `-112.5` |                `-67.5` |                         5 |
| `2:3` | In   |   `22.5` |                 `67.5` |                         1 |
| `2:5` | Anti | `-157.5` |               `-112.5` |                         7 |
| `2:5` | In   |   `67.5` |                `112.5` |                         3 |

The sign of Warp alone is not enough to classify the motion. For example, `Arc = 45` and
`Warp = -22.5` still leaves a positive auxiliary displacement of `22.5`, so it is in-spin-style.

## Accumulation and inheritance

Warp and Strength are inherited Animation properties.

- An undefined Warp inherits the previous resolved Warp.
- An explicit Warp of zero stops adding relative auxiliary rotation on later segments.
- Setting Warp to zero does **not** erase auxiliary phase that has already accumulated. It means the
  auxiliary vector advances with Arc from its current orientation.
- An undefined Strength inherits the previous resolved Strength.
- Strength defaults to raw `1000`, displayed as `100%`.
- An explicit Strength of zero restores the ordinary canonical rendered path even if the auxiliary
  vector retains an accumulated phase.

This distinction matters during manual testing: use Strength zero to turn the visible deformation
off. Warp zero changes future relative timing but is not a reset-to-canonical-phase command.

## Plane, 3D behavior, and prop orientation

Plane defines the direction for both compiled chains. Warp does not need a separate sign flip when
Plane changes direction; it uses the direction established by Plane.

The auxiliary chain is transported independently, so it can accumulate a different phase while
following the same authored 3D plane changes. Warp and Strength affect only the hand position:

- canonical `pos` and `posx` remain unchanged;
- Arc, Plane, Axis, Turns, Twist, and Adjust remain unchanged;
- the prop quaternion/orientation remains unchanged;
- the prop is translated to the rendered hand position, so the spatial prop path naturally follows
  the hand path without Warp becoming a prop-rotation property.

This last point explains an earlier observation that Warp seemed to modify the prop path: the prop
must move with the hand, but its own rotation path must remain identical.

## Canonical recognition and generated replacement

VTG/QST detection is intentionally based on the canonical animation concepts. It reads values such
as `pos`, `posx`, Arc, Turns, and their compiled relationships. It does not use the rendered Warp or
Scale result for exact pattern identity.

Therefore:

- Warp and Strength do not change a VTG timing match.
- Scale remains intentionally ignored by conceptual matching.
- Exact rendered hand positions should not be used as equality requirements for VTG recognition.
- When a generated pattern replaces an animation, old Warp and Strength values should be discarded
  with the replaced animation rather than leaking into the new generated pattern.

This separation is a primary design constraint. Do not solve a rendering issue by rewriting
canonical `pos`, `posx`, Arc, or the prop's timing.

## Spherical interpolation

During a Spherical transition, both vectors are sampled continuously:

- `C(t)` rotates through the segment Arc;
- `W(t)` rotates through `Arc + Warp`;
- Scale and Strength interpolate between their endpoint values;
- the blend formula is evaluated for the current sample.

This produces the rounded in-spin and anti-spin lobes rather than connecting sparse adjusted nodes
with pointed chords.

## Linear interpolation

The settled Linear rule is different and explicit:

1. Compute the fully rendered starting endpoint `A` using that frame's Warp phase, Strength, and
   Scale.
2. Compute the fully rendered ending endpoint `B` using the next frame's Warp phase, Strength, and
   Scale.
3. Render the transition as `lerp(A, B, t)`.

In other words, Linear moves in a straight line to the position that Warp would otherwise place at
the end. Warp determines the endpoints but must not curve a Linear transition. Interpolating Warp,
Strength, and Scale independently during the segment could create a curve, so Linear interpolates
the final endpoints instead.

This was a specific concern from the original discussion and was found to be wrong in the previous
implementation: the worker used scaled canonical endpoints and ignored Warp/Strength for Linear
movement. The implemented worker correction makes live rendering and baked hand-path samples use
fully rendered endpoints.

Relevant implementation names in `createSpiroAnimator.ts` are `LinearStart`, `LinearEnd`, and
`WarpEnd`. `WarpPerform` remains zero for a Linear segment because Warp is represented by the
compiled endpoint rather than sampled as a curved rotation.

## Smooth and plane changes

Smooth is necessary for Adjust because Adjust is an inherited orientation offset reapplied around
an Axis that can change between frames. The worker can blend the previous adjustment quaternion
away to prevent an orientation jump.

Warp has different state semantics:

- the previous compiled `warpPos` is a world-space starting vector;
- the next segment begins exactly at that vector;
- it then rotates about the new Plane-defined axis.

Position is therefore continuous when Plane changes without a Warp-specific Smooth operation. The
path tangent may change at the frame boundary, just as the canonical spherical Arc tangent can
change when Plane changes. Smoothing that tangent would be a new curve-shaping feature, not the
same fix as Adjust smoothing. It could also distort exact ratio geometry.

Current conclusion: **Warp-specific Smooth is not required for positional continuity and should not
be added now.** If later testing demonstrates a need for tangent-continuous 3D seams, treat that as
an explicit new design decision. Linear does not need it because it is defined solely by its two
rendered endpoints.

The existing Smooth property remains Adjust-specific. Its editor control is currently commented
out but retained for testing unusual 3D Adjust/Plane transitions.

## Paths, nodes, selection, and feedback

All displays that represent hand location should respect Warp, Strength, and Scale:

- live hand/prop placement;
- hand path lines;
- prop path translations;
- animation nodes;
- selection/editor feedback;
- final placement at animation completion;
- baked path geometry.

The brighter blue ordinary path can be hidden by setting Paths to false during visual tests. The
prop itself can be hidden by setting Visible to false, leaving the hand-path visualization easier
to inspect.

The canonical compiled fields must still remain available separately for recognition and
reconstruction.

## Shift, Double, Halve, and editing operations

### Shift

Shift reconstruction has historically been fragile when new accumulated channels are added. Warp
support reconstructs the independent auxiliary vector and its reference orientation, including
seam alignment, inherited values, and rebuilt starting state. Strength is preserved/interpolated as
an ordinary inherited scalar.

A manual regression found that the UI's final-outgoing preservation overwrote the reconstructed
final Warp after one additional Shift. In the reported pattern the shifted rendered start was
`(0.113137, -0.113137, 0)`, but the end became `(0.565685, -0.565685, 0)`. Warp is an incoming
transition value, so the old final Warp cannot replace the rotated seam value. The fix keeps the
reconstructed final Warp; a partial-range Shift materializes the old resolved Warp on the following
unselected frame only when needed to preserve its inheritance. The reported pattern now starts and
ends at `(0.113137, -0.113137, 0)`, and repeated Shift behavior was manually accepted.

### Double Frames

For Spherical transitions, subdivision divides Arc, Turns, Twist, and Warp while interpolating
Scale, Strength, Depth, and Adjust and transporting Plane/Axis state. The independent canonical and
auxiliary rotations remain continuously representable.

Linear transitions require an additional guard. Subdividing properties can produce an inserted
rendered node that does not lie on the original straight line. If accepted, one original line would
become multiple angled chords. The implementation computes the original fully rendered line and
verifies every inserted compiled rendered boundary against the corresponding lerp point. Double is
disabled if that exact rendered position cannot be represented.

### Halve Frames

Halve relies on the existing compile-and-double round-trip validation. Because Double now rejects a
Linear subdivision that would bend the path, Halve receives the same protection. Consolidation must
still reproduce the complete compiled playback exactly.

This means Double/Halve may be unavailable for some Linear combinations of changing Warp,
Strength, or Scale. That is deliberate. A future need for universally representable Linear
subdivision may require storing an explicit Cartesian rendered midpoint, which is outside the
current model.

## Editor behavior

The Animation panel order is:

```text
Arc, Turns, Plane, Axis, Adjust, Scale, Depth, Warp, Strength
```

Warp is at the end of the established path properties, followed by Strength as requested.

Current controls:

- Warp uses the Decimal control and changes in 5-degree slider increments.
- Turns and Warp snap to half-degree precision internally (`float: 2`).
- Strength displays as percent, with raw integer tenths of a percent.
- Strength defaults to 100% and can range from 0% through 100%.
- Scale retains its existing visible convention: `1.0`, `1.1`, `1.11`, etc.
- Scale now stores hundredths internally, allowing raw `100`, `110`, and `111` to display as
  `1.0`, `1.1`, and `1.11`.
- Scale range is raw `-200..400`, equivalent to displayed `-2.00..4.00`.

The visible Warp slider increment and serialized precision are separate decisions: the slider can
move by 5 degrees while typed/generated values can preserve half degrees.

### Third Order pattern controls

VTG and the Builder/Viewer selected-portion Properties panel now expose a final `Third Order` tab.
It provides independent Left and Right Initial, Strength, and Timing controls under the description
`Hand path manipulations`.

- Initial and Timing offer Anti and Pro definitions for `1:1`, `2:1`, `1:2`, `1:3`, `2:3`, `1:4`,
  `1:5`, and `2:5`, plus `Undefined`.
- Pro is the in-spin relationship. `1:1 Pro` therefore produces explicit Warp `0`.
- Initial presets use the established canonical 45-degree VTG timing values because frame zero is a
  starting pose rather than a movement interval. Timing presets calculate Warp from each editable
  continuation frame's actual resolved Arc, preserving their relationship when a portion is
  resampled.
- Timing authors Warp sparsely on the first editable continuation frame and only authors it again
  when a changed resolved Arc requires a different value. Intervening frames inherit Warp.
- Once Timing is authored, Initial becomes a 0-360 degree slider with 5-degree steps.
- Strength is a 0-100 percent slider with 5-percent steps.
- Mirror defaults on, hides Right, and applies Left to both props. Opposed is enabled only with
  Mirror and swaps Anti/Pro on Right while preserving numeric Initial phase and Strength.
- Mirror and Opposed are detected from loaded animation data when the relationship is exactly
  reproducible; disabling Mirror materializes Right before exposing its independent controls.
- Trash actions delete the raw field and reveal the inherited/default display value.
- With no authored Timing, Timing displays Initial as its inherited value without writing Warp on
  continuation frames. An inherited `2:*` Timing still selects the two-cycle duration.
- Initial is omitted for later Builder/Viewer portions because their local frame zero is context,
  not editable data. Warp and Strength use minimal successor guards so editing one portion does not
  change the next portion's inherited behavior.
- VTG keeps the authored settings while cells or speed timings change, matching the existing
  Offset, Rotate, and related property workflow.
- A continuing `2:*` Third Order Timing gives `1:*` grid patterns the same two-cycle duration as
  native `2:*` prop timing. This includes ordinary VTG, Trans, thumbnails, and Builder/Viewer
  45-degree portions; matching and slider behavior remain intentionally unchanged.
- VTG thumbnails render these Third Order channels and follow Customize's Hands toggle while
  retaining canonical Paths-on and Arms-off preview presentation.
- Customize BPM now accepts 20-140.

The shared transform and detection logic lives in `src/features/vtg/thirdOrder.ts`. This work does
not alter the locked v12 query layout.

## Query-string version and packing

The query-string version remains **12**. Do not bump it for these current changes.

The current `pN` and `xN` ordering and grouping were accepted as final for v12 on September 4, 2026.
Future incompatible packing changes require a new query version. Preserve real v1-v11 decoding and
the one-time Scale/Turns migration.

### Current v12 angle definitions

Turns and Warp now share:

```text
range:     -2160° through 1440°
precision: 0.5°
encoding:  round(value * 2), decode / 2
bits:      13 each
```

This range was selected from the current VTG timing-ratio requirements scaled out to a maximum
360-degree Arc, rather than retaining older largely invented limits. Half-degree precision is the
known requirement for numerator-2 timings in 45-degree splices. There is no current reason to keep
tenths of a degree. Precision and range can be expanded in a future query version if a real case
requires it.

The curated VTG ratio picker currently includes `1:1`, `2:1`, `1:2`, `1:3`, `2:3`, `1:4`, `1:5`,
and `2:5`. The general parser can describe other positive reduced ratios, so the current angle
range is not a mathematical guarantee for every arbitrary future ratio.

### `pN`

The v12 Animation `pN` Turns/Type group uses 15 of 18 available bits:

```text
Turns: 13 bits
Type:   2 bits
```

The group remains three query characters. The packing helpers use 18-bit groups because each URL
character carries 6 bits. Going beyond a three-character/18-bit group means intentionally changing
the group width; JavaScript bitwise capacity alone is not the format boundary.

### `xN`

The v12 extended Animation frame is now three packed groups in this order:

```text
group 1: 2 chars, Scale                 (10 bits)
group 2: 2 chars, Beats + Depth         (6 + 6 bits)
group 3: 4 chars, Strength + Warp       (10 + 13 bits)
```

A complete `xN` frame occupies 8 characters. Trailing undefined groups are omitted by the usual
sparse-frame rules.

The ordering reflects the decisions from the discussion:

- Beats and Depth are together in the second group.
- Warp moved to the end of the extended frame.
- Strength follows/shares the final extended group with Warp.

Twist remains in the v11 `rN` Rotation track. Warp is not packed into `pN`, so Arc, Plane, Axis, and
Adjust packing remains structurally unchanged.

### Older-version conversion

When a v1-v11 URL is opened by the current decoder:

- Scale is multiplied by 10 exactly once to convert historical tenths to current hundredths.
- Turns is clamped to `-2160..1440` and rounded to the nearest half degree exactly once.
- Missing Warp resolves to zero.
- Missing Strength resolves to its default of 100%.

Current v12 values and undo-history data must not be converted a second time.

Backward compatibility is required for actual v1-v11 URLs. Compatibility is **not** required for
temporary, in-development v12 layouts or extreme historical Turns values outside the new range;
the user explicitly accepted that tradeoff because no meaningful stored URLs are expected to rely
on them.

The new normalization code is in:

- `src/domain/animation/timingAngle.ts`
- `src/services/query/migrateLegacyTurns.ts`
- `src/services/query/versions/SpiroAnimQSv12.ts`

## URLs used during the discussion

These are useful for historical context, but some predate the locked v12 layout. If one decodes
unexpectedly, compare it with the packing history before assuming the current implementation is
wrong. Newly emitted v12 URLs use the durable layout and must remain compatible.

Original one-prop circle example:

```text
http://localhost:8080/play-edit?r=Gw68kk11Y&p0=Q___M..bn_...&m0=_1__Vqv__&c=_i_bhq&v=12
```

The user's 180-degree Warp experiment:

```text
http://localhost:8080/play-edit?r=y068k411Y&p0=Q___M.........&x0=._q38.__NA.__P8.__QI.__P8.__NA.__P8.__QI&c=_i_bhq&v=12
```

Earlier diagnostic where Halve and visible path updates were questioned:

```text
http://localhost:8080/play-edit?r=G068Yk11Y&p0=Q__.bn_.5L_Qpg.......&x0=Qo__QRo&m0=_1_mxqv__&p1=N__.bn_Rhw.5JER3s.......&x1=Qo&c=_i_bhq&v=12
```

Shift regression source before the additional Shift:

```text
http://localhost:8080/play-edit?r=Ew28Yk11Y&p0=Q__..5L_-ZU.......................&x0=Qo____Yw.____Oif_........____MUf_&m0=_1_mxqv__&p1=N__..5E0-ZU...._U0_3w.._U0-ZU...._U0_3w.._U0-ZU...._U0_3w.._U0-ZU...._U0_3w.&x1=Qo____Yw.____Oif_........____MUf_&c=_i_bhq&v=12
```

The broken output captured before the Shift seam fix was:

```text
http://localhost:8080/play-edit?r=Ew28Yk11Y&p0=Q__.5L__6k_U0.___-ZU_U0.......................&x0=Qo__Lucw.____Oif_.......____MUf_&m0=_1_mxqv__&p1=N__..5E0-ZU...._U0_3w.._U0-ZU...._U0_3w.._U0-ZU...._U0_3w.._U0-ZU...._U0_3w.&x1=Qo____Yw.____Oif_........____MUf_&c=_i_bhq&v=12
```

That output incorrectly restored final Warp `0`; the corrected Shift writes final Warp `180` and
closes the rendered seam. Because tomorrow's v12 packing review may reorder fields, preserve the
decoded regression data and assertions rather than treating either encoded v12 string as permanent.

## Current worktree state

Commit `6ab38b2` on `dev` contains the Warp/Strength implementation, current v12 packing, legacy
migration, Linear rendered-endpoint behavior, Double/Halve guard, and the original handoff. The
intentional closeout diff on top of that commit contains:

1. the Shift final-Warp seam fix;
2. partial-range following-Warp inheritance preservation;
3. focused Shift regression coverage;
4. corrections to stale Scale midpoint, legacy Turns migration, and Warp-closure test fixtures;
5. documentation corrections and this updated handoff.

Files in that local diff before the planned push to `dev`:

```text
docs/ANIMATION_FRAME_MODEL.md
docs/SHIFT.md
docs/VTG_TIMING_RATIOS.md
docs/todo/WARP_STRENGTH_HANDOFF.md
src/composables/__tests__/useSpiroAnimQS.spec.ts
src/features/editor/components/properties/manage/ShiftFrames.vue
src/features/editor/components/properties/manage/__tests__/ResampleAnimationFrames.spec.ts
src/features/editor/components/properties/manage/__tests__/ShiftFrames.spec.ts
src/features/editor/manage/__tests__/resampleAnimationFrames.spec.ts
src/math/animation/__tests__/shiftAnimationFrames.spec.ts
src/math/animation/shiftAnimationFrames.ts
```

The user intends to push this state to `dev` after the handoff update. On the next computer, inspect
recent `dev` history and `git status --short` before assuming the files are still uncommitted.

## Validation already performed

- The user manually accepted spherical Warp/Strength behavior, Scale independence, Linear paths,
  live and baked displays, Double/Halve behavior, current query round trips, canonical recognition,
  repeated Shift behavior, and 3D Plane changes.
- The Shift regression URL was decoded through the application's v12 codec and compiler. After the
  fix, its rendered first and last positions both equal `(0.113137, -0.113137, 0)`.
- Focused Warp/Shift/animation/query tests passed: 8 files, 132 tests.
- The standard full unit suite passed: 162 files, 1,353 tests.
- `npm run type-check` passed.
- Changed files passed Prettier checking, ESLint, Oxlint, and `git diff --check`.
- Exhaustive/audit suites were intentionally not run at the user's request.
- End-to-end tests and the complete production build were not run during this closeout.

The first automated run exposed stale expectations rather than additional runtime defects. The
correct raw Scale midpoint between `100` and `200` is `150`, compact frames do not need an explicit
inherited `warp: 0`, the legacy migration test now generates data with the v11 codec so it actually
contains Turns, and the shared Shift fixture now closes its auxiliary Warp vector.

## Next-session pickup order

1. Pull or inspect the latest `dev` state and confirm whether the closeout diff above was pushed.
2. Preserve the locked v12 `pN` and `xN` layout, half-degree Turns/Warp range, and v1-v11 migration.
3. Continue subsequent hand-path work without repacking v12. Use a new query version for any future
   incompatible format change.
4. Rerun focused and standard unit suites after related changes. Do not run exhaustive audits unless
   separately requested.

## Known caveats and next decisions

- Do not add Warp-specific Smooth unless manual 3D testing demonstrates that tangent continuity is
  a required authored behavior. Position continuity is already provided by accumulated `warpPos`.
- Current Turns/Warp range covers the current curated VTG needs, not every possible arbitrary ratio
  the generic parser could express.
- Half-degree precision is the current demonstrated need. More precision can be added in a future
  query format if Third Order or another real workflow requires it.
- Warp zero does not reset prior phase; Strength zero disables the visible deformation.
- Some Linear transitions cannot be exactly Double/Halve represented under the current angular and
  scalar property model. The correct current behavior is to disable the operation.
- The v12 field order is locked. Any incompatible packing change requires a later query version.

## Design invariants to preserve

When making subsequent fixes, keep these invariants together:

1. Warp/Strength shape rendered hand location only.
2. Canonical path and prop-orientation state remain authoritative and unchanged.
3. VTG/QST recognition ignores rendered Warp/Strength/Scale styling intentionally.
4. Plane defines the 3D direction; Warp adds timing on the independently transported auxiliary
   vector.
5. Strength controls deformation; Scale controls the complete outer size.
6. Spherical samples the continuous dual-vector curve.
7. Linear connects fully rendered endpoints with one straight line.
8. Editing operations must preserve exact compiled/rendered playback or disable themselves.
9. Current QS version stays at 12, with its locked layout and real v1-v11 conversion preserved.
