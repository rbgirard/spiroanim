# Third Order

The Third Order Concepts page (`/third-order`, or pane routes such as `/play-to`) contains an
8-column by 17-row matrix. Top headers use the eight VTG primary picker timings; left headers
use all 17 VTG More picker timings, in the same order.

Hand and Prop independently select Anti or Spin, defaulting to Anti. Header previews use the
shared concept thumbnail renderer. Top headers show one prop at 50% scale in Customize's Left
color; left headers show one prop at 100% scale in its Right color. Both use the selected prop
type and a common camera. All header animations apply a -90-degree initial rotation using the
same animation-data transform as VTG. Preview presentation follows the other concepts' fixed path rendering.

Clicking a header preserves the opposite coordinate of the selected cell. With no selection,
the opposite coordinate is chosen randomly. The corner shuffle button selects any of the 136
cells. Selection, direction, and Version state are local to the page.

Headers show their Hand/Prop timing and Anti/Spin direction in shared VTG-style pattern tooltips.
Cell tooltips show both timings/directions and the selected Version. They support hover, keyboard
focus, and touch taps with the shared dismissal behavior, independently of optional general-control
tooltips. Opening a tooltip does not change selection; tapping a tile still selects it normally.

All four Hand / Prop combinations have two versions at every timing pair (1,088 entries).
Cells use only `data/generatedDefinitions.ts`, the compact output of the offline
[definition generator](THIRD_ORDER_GENERATOR.md). No generation searches, URLs, or review evidence
are imported by the page. In the 1:1 / 1:1 Spin / Spin case, the reviewed #3 and #4 are published
as Versions 1 and 2; the other two discoveries remain in the offline review evidence.

The catalog supplies the VTG reference, variant, timing order, Swap, plane reversal, and Adjust.
The top timing drives the scale-0.5 prop; the scale-1 prop receives Third Order warp using that
timing. Roles follow reversed timing order and Swap rather than assuming fixed physical indices.
Warp direction follows Hand (Anti uses Anti; Spin uses Pro). Cell orientation is 0, with none of
the former hardcoded base-cell, Adjust, or version/column rotation exceptions. Headers remain
independent and retain their -90-degree orientation.

Cell thumbnails and player selections share one generator. Clicking a supported cell updates
the player through the normal Concepts event path. Version changes reapply the selected cell.
Missing definitions leave individual cells blank and never emit a replacement animation.
Shuffle chooses only populated cells.
No pattern is automatically selected on mount, and pattern matching remains disabled.

Customize reuses the shared Concepts controls and preferences. Spacing, colors, prop type, BPM,
thickness, and rendering controls update the selected animation. The general Scale slider is
hidden because both prop scales are fixed by the definition. Thumbnail presentation remains
consistent with the other concepts' fixed path rendering. Header construction stays independent
of cell generation. No persisted or serialized format changes are introduced.
