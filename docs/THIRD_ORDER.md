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

Anti / Anti is supported for both versions. The top timing is the first prop's timing and the
left timing is the second prop's timing, combined using VTG's More timing rules. Version 1 uses
VTG cell 5-5's Anti variant. Version 2 uses cell 3-3 for the 1:3 definition family and cell 1-3
otherwise. Family selection uses the same helper as VTG, based on the first prop's timing.
The first and second prop scales are fixed at 0.5 and 1.0. The second prop's continuing Third
Order warp uses the top timing in Anti direction. Adjust (initial warp) is 180 only for
Version 2 patterns in the 1:3 definition family; it is 0 for all other supported patterns.
Cell animations use a +90-degree rotation for Version 1. Version 2 uses -90 degrees except
for the top-header 1:4 column, which uses +90 degrees. Header animations remain at -90 degrees.

Cell thumbnails and player selections share one generator. Clicking a supported cell updates
the player through the normal Concepts event path. Version changes reapply the selected cell.
Unsupported direction pairs hide all cell thumbnails and never emit a replacement animation.
No pattern is automatically selected on mount, and pattern matching remains disabled.

Customize reuses the shared Concepts controls and preferences. Spacing, colors, prop type, BPM,
thickness, and rendering controls update the selected animation. The general Scale slider is
hidden because both prop scales are fixed by the definition. Thumbnail presentation remains
consistent with the other concepts' fixed path rendering. Header construction stays independent
of cell generation. No persisted or serialized format changes are introduced.
