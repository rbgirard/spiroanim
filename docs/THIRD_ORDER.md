# Third Order

The Third Order Concepts page (`/third-order`, or pane routes such as `/play-to`) contains an
8-column by 17-row matrix. Top headers use the eight VTG primary picker timings; left headers
use all 17 VTG More picker timings, in the same order.

Hand and Prop independently select Anti or Spin, defaulting to Anti. Header previews use the
shared concept thumbnail renderer. Top headers show one prop at 50% scale in Customize's Left
color; left headers show one prop at 100% scale in its Right color. Both use the selected prop
type and a common camera. All header animations apply a -90-degree initial rotation using the
same animation-data transform as VTG. Preview presentation follows the other concepts' fixed path rendering.
Hand, Prop, and Version use native radio groups labeled H:, P:, and V:, with full accessible group
names and hover/focus/touch tooltips explaining each abbreviation. Arrow keys cycle radio options.
The matching-height D: dropdown chooses a duplicate of the selected version. It is empty and disabled
until a cell is selected. Cell selection starts at D: 1; clicking the same cell advances through its
duplicates and wraps back to 1. The player and selected thumbnail both use that duplicate.
Changing H/P/V, choosing a header, or shuffling resets D to 1; Customize preserves it without scrolling.
Unselected cells preview D: 1. Duplicate state is local, not persisted; loaded player data is matched
to a published duplicate, with the ambiguity rules below.
By default, published duplicates keep the small prop on the Left color and the full-size warped
prop on the Right color (Cyan and Green by default). Opposite assignments are filtered offline
before the minimal catalog is written; they remain an opt-in generator option and can also be
obtained by taking the pattern into VTG and using Swap.

Clicking a header preserves the opposite coordinate of the selected cell. With no selection,
the opposite coordinate is chosen randomly. The corner shuffle button selects any of the 136
cells. Selection, direction, and Version state are local to the page.
The selected cell has an orange border and inset outline, distinct from its blue/cyan row and
column highlights. Its thumbnail background stays unchanged.
Hand, Prop, and Version controls and the top timing headers stick to the top of the scrolling
Concepts pane. The main Concepts selector scrolls normally. Header offset follows the controls'
measured height so wrapped controls do not overlap the timing headers on narrow panes.
Cell, header, shuffle, and direction/version selections reveal the selected cell only when it is
outside the unobscured viewport, accounting for the sticky stack. Customize updates never request
selection scrolling.

Headers show their Hand/Prop timing and Anti/Spin direction in shared VTG-style pattern tooltips.
Cell tooltips show both timings/directions, Version, and `Duplicate: current / total`. They support hover, keyboard
focus, and touch taps with the shared dismissal behavior, independently of optional general-control
tooltips. Opening a tooltip does not change selection; tapping a tile still selects it normally.

All four Hand / Prop combinations have two versions at every timing pair (1,088 entries).
Cells use only `data/generatedDefinitions.ts`, the compact output of the offline
[definition generator](THIRD_ORDER_GENERATOR.md). No generation searches, URLs, or review evidence
are imported by the page. In the 1:1 / 1:1 Spin / Spin case, the reviewed #1 and #4 are published
as Versions 1 and 2; the other two discoveries remain in the offline review evidence.

The catalog supplies the VTG reference, variant, timing order, Swap, plane reversal, and Adjust.
The top timing drives the scale-0.5 prop; the scale-1 prop receives Third Order warp using that
timing. Roles follow reversed timing order and Swap rather than assuming fixed physical indices.
Warp direction follows Hand (Anti uses Anti; Spin uses Pro). The offline generator aligns the
small top-timing prop's outline to the top header and stores a single optional rotation per recipe.
Both props rotate together, preserving their alignment. Headers retain their -90-degree orientation;
the former hardcoded base-cell, Adjust, and version/column rotation exceptions are not used.

Cell thumbnails and player selections share one generator. Cell thumbnails show only the full-size
warped prop; the small top-timing prop is hidden after resolving Swap/reversed roles. Headers are
unchanged, and player selections retain both props. Clicking a supported cell updates
the player through the normal Concepts event path. Version changes reapply the selected cell.
Missing definitions leave individual cells blank and never emit a replacement animation.
Shuffle chooses only populated cells.
An empty player does not select or generate a random pattern on mount.

## Pattern matching

The current player animation is recognized on mount and when its data/revision changes. Detection
only restores the selected cell and H/P/V/D controls; it never emits `patternSelect` or `customize`,
replaces animation data, changes scales/rotation, or rewrites the player's URL. A newly detected
selection is revealed under the sticky headers if necessary. Re-detecting the same selection
does not scroll, so Customize changes retain the existing no-scroll behavior. Unmatched input
clears the highlight and empties D without changing the player.

Matching ignores a common planar Rotation, independent prop scales, colors, visibility, prop model,
static spacing, camera, rendering settings, and playback speed. Uniform tempo changes and frame
subdivision are also tolerated. VTG Swap is recognized against the equivalent published assignment
without adding the filtered duplicates back to the catalog. When multiple duplicates match, the
current complete selection is preferred if valid; otherwise the first match in catalog order is used.
The displayed preview remains the catalog form, not a copy of the edited player's presentation.

This is continuous motion matching, not image/path sampling: the compiled hand, auxiliary warp,
and head channels must retain their angular rates, relative phases, and warp strength. Changes to
Third Order timing/Adjust or relative prop phase match only if another published definition has
that motion. Arbitrary cycle-start shifts, nonuniform/nonplanar choreography, moving translations,
and fold/twist modifications are not treated as presentation-only changes.

Third Order uses the existing shared, lazy pattern-matching worker and its normal idle cleanup.
An input is compiled once; inferred timing ratios restrict candidate construction to that timing
pair. The worker lazily caches normalized signatures per pair, reusing them for later lookups.
No offline evidence, canonicalization search, or full-catalog scan enters the runtime matcher.
The UI coalesces changes to one active request plus the latest pending input, and discards stale
results after newer data, direct user actions, readiness changes, or unmounting. Hydration is guarded
through the Vue watcher flush so control restoration cannot feed back into player generation.

Customize reuses the shared Concepts controls and preferences. Spacing, colors, prop type, BPM,
thickness, and rendering controls update the selected animation. The general Scale slider is
hidden because both prop scales are fixed by the definition. Thumbnail presentation remains
consistent with the other concepts' fixed path rendering. Header construction stays independent
of cell generation. No persisted or serialized format changes are introduced.
