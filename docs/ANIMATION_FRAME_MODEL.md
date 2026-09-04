# Animation Frame Model

This document describes how editable Animation and Motion frames become compiled animation data,
how the worker interprets that data, and how sparse frames can be compacted safely. The Shift
management operation is documented separately in [`SHIFT.md`](./SHIFT.md).

The authoritative implementations are:

- `src/math/animation/AnimFunc.ts` for compilation.
- `src/math/animation/frameSemantics.ts` for the compiler's sparse-frame defaults, inheritance,
  derived values, and Motion command-presence rules.
- `src/math/animation/compressFrames.ts` for compiler-backed sparse-frame compaction.
- `src/math/animation/OrthogonalFunc.ts` for chained spherical rotations.
- `src/workers/animation/createSpiroAnimator.ts` for playback and path rendering.
- `src/composables/useSpiroAnimQS.ts` and `src/services/query/versions/` for query-string
  serialization.

## Frames and displayed segments

An animation with `N` editable frames has `N - 1` displayed segments.

For a segment at index `i`, the worker calls the current compiled frame `p1` and the next compiled
frame `p2`:

```text
compiled[i] ------ displayed segment i ------> compiled[i + 1]
     p1                                               p2
```

The final frame is an endpoint. Its `beats` value is not used unless a management operation moves
that endpoint to a position from which a segment leaves.

The first raw frame is also special. There is no editable frame before it. The compiler calculates
it from the fixed application basis:

- Initial point: `PPOS[PNTIND.MBC]`
- Initial orthogonal reference: `PPOS[PNTIND.ML]`

Consequently, removing the first raw object does not make the old second compiled frame become the
new starting state. Its relative angles would instead be applied directly to the fixed basis.
Operations that change the first frame must reconstruct it.

## Raw values, defaults, and inheritance

`AnimData` is sparse. A missing property either inherits from the preceding frame or uses a
per-frame default. These are different behaviors.

| Property   |     First-frame default | Later frame when undefined | Role                                                      |
| ---------- | ----------------------: | -------------------------- | --------------------------------------------------------- |
| `turns`    |                     `0` | Inherit                    | Incoming rotation amount                                  |
| `twist`    |                     `0` | Inherit                    | Incoming local-axis roll amount                           |
| `beats`    |                     `1` | Inherit                    | Duration of the outgoing segment                          |
| `scale`    |           `100` (`1.0`) | Inherit                    | Radius state in internal hundredths                       |
| `warp`     |                     `0` | Inherit                    | Incoming auxiliary hand-path rotation in degrees          |
| `strength` |         `1000` (`100%`) | Inherit                    | Warp contribution in internal tenths of a percent         |
| `depth`    |                     `0` | Inherit                    | State at this frame                                       |
| `type`     |               Spherical | Inherit                    | Incoming transition type                                  |
| `adjust`   |                     `0` | Inherit                    | Adjusted rotation state                                   |
| `arc`      |                     `0` | Inherit                    | Incoming position arc and spherical rotation contribution |
| `plane`    |                     `0` | Always default to `0`      | Incoming position plane                                   |
| `axis`     | Current frame's `plane` | Current frame's `plane`    | Incoming rotation axis                                    |

`plane` and `axis` do not inherit from the preceding frame. A repeated nonzero `plane` therefore
cannot be deleted merely because the previous frame used the same value. `axis` can be deleted
when it equals the current frame's `plane`.

`rootCompile()` JSON-clones the root, then resolves sparse values without expanding the editor's
source objects. The compiler, compression, pattern generators, and frame-management operations use
the same resolver.

## Compilation

Each prop starts with separate position and rotation state:

```text
position = InitialPoint
position reference = InitialOrtho
rotation = InitialPoint
rotation reference = InitialOrtho
```

For every frame, the compiler calculates:

```text
position arc = radians(arc)
rotation amount =
  radians(turns) + radians(arc)   for Spherical
  radians(turns)                  for Linear
```

`orthoNext()` performs a chained rotation:

1. Convert `plane` or `axis` into an orthogonal point relative to the current source and reference.
2. Cross the source with that point to produce the rotation direction.
3. Rotate the source around that direction.
4. Transport the orthogonal reference to the new source for the next frame.

The resulting direction vectors are saved as:

- `posx`: axis used for the frame's incoming spherical position arc.
- `rotx`: axis used for the frame's incoming rotation.

These vectors are essential data. Matching only the compiled `pos` and `rot` endpoints is not
enough to preserve a path: different `posx` or `rotx` values can connect identical endpoints along
different three-dimensional arcs.

The compiler also creates:

```text
adju = rot rotated around rotx by adjust
```

`adju` is the adjusted orientation used by smooth rotation blending.

Warp compiles a second position chain, `warpPos` and `warpx`, from the same Plane as the canonical
position but with `Arc + Warp` angular movement. This mirrors the relationship between Arc and
Turns without using or changing the prop's rotation chain. Canonical `pos` and `posx` remain
unchanged, so structural pattern matching can deliberately ignore Warp.

Twist is a signed local-axis roll added during each incoming frame interval. Compilation performs
a prefix sum and stores both the inherited interval `twist` and absolute `twistRoll` at every
frame. Setting Twist to zero stops adding roll without undoing the accumulated orientation. The
worker can therefore seek directly to any frame without replaying earlier intervals.

## Worker ownership of values

A displayed segment combines values from both endpoint frames.

| Behavior                       | Source                                                            |
| ------------------------------ | ----------------------------------------------------------------- |
| Segment duration               | `p1.beats`                                                        |
| Starting position and rotation | `p1.pos`, `p1.rot`                                                |
| Starting adjusted rotation     | `p1.adju`                                                         |
| Starting hand state            | `p1.pos`, `p1.scale`, `p1.strength`, `p1.depth`                   |
| Transition type                | `p2.type`                                                         |
| Spherical hand path            | Strength blend of canonical Arc and Warp vectors, scaled together |
| Linear hand path               | Interpolate the scaled canonical `pos` endpoints                  |
| Rotation path                  | Rotate `p1.rot` around `p2.rotx`                                  |
| Rotation amount                | `p2.turns`, plus `p2.arc` for Spherical                           |
| Rotation adjustment            | `p2.adjust`, with optional smooth blending from `p1.adjust`       |
| Local prop roll                | `p1.twistRoll + p2.twist * segment progress`                      |
| Ending hand state              | `p2.pos`, `p2.scale`, `p2.strength`, `p2.depth`                   |
| Warp rotation for the segment  | `p2.arc + p2.warp`                                                |

The same setup routine is used for playback and for constructing visible path/hand lines. A
management operation must therefore preserve the incoming axes on the new `p2`, not just its final
coordinates.

After composing the transported Turns/Arc orientation and smooth adjustment, the worker
post-multiplies Twist around the model's local Y axis. Twist changes the visible model orientation
without changing its path, active direction, Plane, Axis, Arc, or Turns. Because the local roll is
applied after the transported orientation, its axis follows the prop through three-dimensional
movement.

For a Linear transition, the worker applies each frame's Scale to its endpoint before
interpolating. Interpolating position and Scale separately and then multiplying them would produce
a quadratic curve when both values change.

For a Spherical transition, the worker samples the canonical Arc vector `C` and the independently
compiled Warp vector `W`, then calculates the rendered hand position as:

```text
weight = Strength / 2
hand = Scale * ((1 - weight) * C + weight * W)
```

Strength is normalized from 0% to 100%. At 0%, the formula is exactly the established `C * Scale`
behavior. Increasing Strength deepens the lobes without changing their outer boundary: when the
vectors align, the hand remains at `Scale`. When the vectors oppose, its inner radius is
`Scale * (1 - Strength)`. Strength 100% can therefore reach the center, while lower values retain a
rounded inner radius. Scale controls the size of the complete result independently. When Warp is
zero from the start, `C` and `W` remain aligned, so changing Strength does not alter the ordinary
scaled path. After Warp has accumulated a phase difference, setting Warp to zero stops additional
relative rotation; setting Strength to zero suppresses the deformation immediately.

Assigning Warp the same interval values as Turns reproduces VTG timing geometry without coupling
the hand path to the prop. For timing `p:q`, anti-spin produces `p + q` petals and in-spin produces
`abs(q - p)` petals over the complete timing cycle. With 45-degree intervals, `2:3` uses Warp
`-112.5` for five anti-spin petals or `22.5` for one in-spin petal across its sixteen-interval
cycle. Linear transitions remain straight and ignore Warp. Paths, Hands, Nodes, Anchors, and Arms
use the same rendered position as live playback.
Motion and Depth are applied independently afterward.

## Independent Motion frames

Each finalized prop owns two independent frame arrays:

```text
prop.anim    Animation frames
prop.motion  Motion frames
```

Motion frames contain `beats`, `precision`, `arc`, `plane`, `distance`, `shape`, `axis`, and
`amount`. Their
frame boundaries do not need to align with Animation. An unused Motion track is always represented
in memory as `motion: []`. Cartesian Move is an editor conversion into Arc, Plane, and Distance;
X/Y/Z is not stored in Motion frames.

The Manage pane follows the selected frame set. Animation exposes its point and prop management
tools. Motion exposes Insert Frame and Delete Selection; Insert Frame adds an empty frame before or
after the current position or selected range without invoking player point selection. Compress
applies the compiler's default, inheritance, derived-value, and playback rules to props, Motion,
Camera Orbit, and Camera Center. Callers can independently include or exclude inherited Prop values,
Animation, Motion, and Camera tracks.

Animation Manage also exposes Double Frames and Halve Frames across every prop. Double Frames
inserts the intermediate frame in each authored interval and doubles BPM. Turns, Twist, Warp, and Arc are
split between the two intervals; Scale, Strength, Depth, and Adjust are interpolated; and Plane and Axis are
transported through the continuation frame. Because Warp is an accumulated angular channel, the
subdivided auxiliary-vector path remains exactly representable and does not disable Double or Halve.
Because Prop Motion and Camera are independent
timelines, effective Beats values on multi-frame tracks are multiplied by two so doubling BPM does
not change their absolute playback timing. A single-frame Motion or Camera track has no interval, so
its Beats value remains unchanged. Camera Orbit owns Camera Beats; Camera Center remains beatless.
The action is disabled when BPM or any generated or adjusted value cannot be represented by the
current property range and precision. Halve Frames is enabled only when consolidating alternating
Animation frames, halving Beats on multi-frame Motion and Camera tracks, and doubling the result
reproduces the complete compiled playback exactly.

Motion `beats` defaults to `1` on the first frame and inherits afterward. Precision initially
defaults to `false`; Shape initially defaults to Linear and Amount initially defaults to 50%.
Precision, Shape, and Amount inherit. Arc, Plane, and Axis default to zero without inheriting.
Distance also defaults to zero without inheriting, so empty and Beats-only
frames hold position.

An authored Arc, Plane, or Distance marks a directional command. Arc and Plane are relative to the
preceding authored direction, even when Distance is zero. Before playback, the compiler converts
that chained direction into a Cartesian tangent and evaluates the selected path to create a
cumulative endpoint:

```text
offset[0] = pathEnd(frame[0])
offset[i] = offset[i - 1] + pathEnd(frame[i])
```

Distance sets the Linear destination and the scale of a curved path. Linear and a zero-Amount curved shape travel
straight. Circle maps 50% to a semicircle and 100% to a complete circle that returns to its starting
position. Arc maps 50% to a semicircle and 100% to a 270-degree long arc. Axis rotates the bending
direction around the Cartesian tangent.

A Motion segment evaluates the next frame's path from `offset[i]`. Animation and Motion are both
evaluated at the same absolute playback time. When either frame set ends first, it holds its final
state while the other continues. Overall playback ends at the last frame boundary from either set.

Motion translates the live prop, arms, anchors, guides, and active point during playback. Completed
Paths and Hands are not children of that translated group. Instead, the worker samples Motion at
the absolute time of every generated point and bakes that world-space offset into the line. Nodes
likewise store the sampled world-space offset for their Animation frame. This makes the completed
visualizations show where the prop traveled without sliding the already-drawn geometry as playback
continues. Motion boundaries inside an Animation segment are included as exact line samples so
direction changes remain intact even when the two frame sets do not align. When Motion outlasts
Animation, the final animated pose continues contributing baked line points through the remaining
Motion boundaries.

Travel renders the Motion center path itself using the Hands color. It is sampled from the same
path calculation used for playback so curved Travel, playback, Paths, and Hands cannot disagree.

## Root-owned Camera frames

Camera is a third independent frame set owned by the root rather than by a prop. Every finalized
animation has at least one Camera frame. Orbit is the primary path and owns `beats`; Center uses
the same frame boundaries without storing a second duration:

```text
camera[i].orbit   Motion-style path and Camera frame duration
camera[i].center  Motion-style world-space look-at path without Beats
```

Center and Orbit use the same Arc, Plane, Distance, Shape, Axis, Amount, Cartesian conversion, and
inheritance rules as Motion, including Precision. When Precision is enabled, authored Move and
Distance remain unchanged while their rendered path offsets are divided by 10. They are compiled
with the shared Motion path compiler and evaluated
at the same absolute Camera timeline time. The rendered camera position is `center + orbit`, and
the camera always looks at Center. Center's Linear shape uses ordinary Cartesian interpolation.
Orbit's Linear shape instead interpolates direction around Center and interpolates radius directly,
so equal endpoint radii remain constant rather than zooming through the chord between them. Orbit
Arc and Circle retain the Cartesian curved-path behavior and can intentionally vary that radius.

The animation worker owns and evaluates the authored Camera during playback and seeks. Main-thread
OrbitControls request the current worker pose when a pointer gesture begins. A normal gesture
temporarily supplies manual position and target values, then releases ownership and snaps back to
the authored pose at the current time. The persisted Free Camera toggle retains that manual
ownership until disabled. Editor changes rebuild authored Camera data without changing the active
manual position or target. Its manual pose is not persisted: replacing the active animation resets
the camera to the new Camera track's initial authored pose while leaving Free Camera enabled.

Selecting Camera in the editor shows its single root timeline regardless of prop selection. Orbit
appears before Center and owns the Beats control. Both paths are rendered in the main player only
while Camera is selected. Timeline thumbnails always render the authored Camera track and
intentionally ignore temporary gestures and the Free Camera override. Timeline thumbnails and
image/video exports suppress Camera guides. Camera supports Insert Frame and Delete Selection,
but deletion cannot remove its final frame. While Free Camera is enabled, Manage also exposes
Match Free Camera. It rewrites the active Camera frame's Center and Orbit to the closest pose
available under the integer angle, Distance, Shape, Axis, and Amount constraints. A 100% Circle
cannot match a nonzero endpoint because its path closes at its starting point.

The default Camera has Center at the origin and Orbit at `[0, 0, -22]`, matching the former global
Distance view. Concept builders replace it with one centered Camera frame at their derived viewing
distance. Clearing the first Orbit's movement also falls back to this valid default separation so
the camera never collapses onto Center merely because its sparse values are undefined.

QS versions 1 through 3 stored Cartesian `move` on Animation frames. Version 4 migration removes
those legacy fields, converts their chained Cartesian directions into Arc, Plane, and Distance,
and builds a Motion track with equivalent boundaries. Stationary spans may be collapsed, but the
Animation frame immediately before a transition must remain as a Motion boundary because its
outgoing `beats` value determines when movement begins.

QS versions 1 through 4 stored a global root Distance. Version 5 migrates that value into the first
Camera Orbit and removes Distance from finalized root settings.

QS version 6 adds Precision to Motion and both Camera paths. Older versions compile its missing
value as `false`.

QS version 12 adds Warp and Strength and changes Scale's internal storage from tenths to hundredths.
Strength is stored as integer tenths of a percent from `0` through `1000`. When a Version 1-11 URL
is opened by the current decoder, authored Scale values are multiplied by ten exactly once. Display
values remain unchanged: raw `100`, `110`, and `111` render as `1.0`, `1.1`, and `1.11`.

## Sparse frame compaction

After a management operation, frames are compacted through the compiler-owned semantic resolver:

- Delete inherited values when they equal the preceding effective value.
- On the first frame, delete inherited values when they equal their first-frame default.
- Delete `plane` only when it is zero.
- Delete `axis` only when it equals the current frame's `plane`.

Animation compaction proves that removing a field leaves every resolved frame unchanged. Motion
compaction recompiles the complete track after each candidate removal because authored zero-valued
direction commands can advance the chained direction even when they do not move the prop. A
zero-valued command is removed only when compiled playback remains unchanged.

Pattern-definition callers can preserve selected authored fields and VTG relationship boundaries.
This prevents compaction from erasing metadata that a later transformation intentionally inspects.

Query values are integer-based. Derived floating-point noise near an integer must be
snapped before it reaches the editor or serializer.

The URL-level representation of undefined fields, empty frames, separators, and stripped trailing
groups belongs to [`QUERY_STRING_FORMAT.md`](./QUERY_STRING_FORMAT.md).
