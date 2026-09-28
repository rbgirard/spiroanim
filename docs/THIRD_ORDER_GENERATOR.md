# Third Order definition generator (experimental)

Run `npm run generate:third-order` from the repository root. It uses Vite's server-side module
loader so the generator reuses the actual TypeScript VTG builder, compiler, tooltip classifier,
Third Order controls, and URL codec. It does not start a browser. Regenerating the compact
catalog updates the definitions consumed by the Concepts page.

The app-ready output is `src/features/third-order/data/generatedDefinitions.ts`. It stores
only timing axes, shared minimal VTG recipes, shared version lists, and small lookup indices.
It contains no URLs, animation frames, duplicate evidence, signatures, or analysis statistics.

Developer-only outputs are retained outside TODO under `docs/generated/third-order/`:

- `catalog-review.json`: expanded representative recipes and playable query strings, grouped by timing,
  final Hand/Prop tooltip pair, and unique version.
- `evidence.json`: every accepted alternative and its transform to a canonical representation.
- `report.md`: search scope, counts, and empty combinations.
- `review.html`: links to each representative on `http://localhost:8080/play-vtg`.

The Concepts page uses the compact catalog for both thumbnails and player selections. The review
artifacts must not be imported into application code. Generation overwrites these four review files and the compact
runtime file. Version numbers are deterministic for identical inputs but are local to
each timing/direction cell, not stable identifiers across changes to the rules.

## Runtime format

Schema 1 stores each distinct recipe once: VTG cell reference, variant/180/Swap/reversed-order
switches when true, and Adjust. Timing comes from the selected matrix coordinates; warp direction
comes from Hand. Fixed schema rules supply orientation 0, spacing 0, scales 0.5/1, and default full
warp strength. Input scale assignment and output warp target are derived from reversed-order and
Swap, so redundant driver/follower indices are not shipped.

`versionSets` contains ordered recipe indices; array position plus one is Version. `cells` contains
version-set indices in top-timing, left-timing, AA/AS/SA/SS order. Empty version lists support future
unsupported combinations without changing the format.

`definitionCatalog.ts` exposes version-count and recipe lookups, plus
`createAnimationFromThirdOrderDefinition(catalog, request, current?, display?)`. Reconstruction uses VTG and
Third Order directly, without importing the offline generator, query codec, or analysis code.
It deliberately preserves the current generator's output without the Concepts page exceptions.
The optional current animation preserves playback speed through VTG's normal generation path.
Optional display settings apply the shared Customize controls without overriding catalog-owned
timing, scale, Swap, orientation, or warp settings.

Publication retains two versions per cell. The one four-result discovery, 1:1 / 1:1 Spin / Spin,
uses the reviewed #3 (5-5, Adjust 0, direct) and #4 (1-1, Adjust 0, direct) as runtime Versions 1
and 2. Compaction verifies this exception explicitly and fails for review if those discoveries
change. The expanded review/evidence still retains all four original results. The runtime catalog
therefore contains 1,088 entries, while the full discovery evidence contains 1,090.

Before writing, the generator reconstructs every representative using only the compact catalog
and compares the complete animation data against the expanded recipe. Generation fails if a new
rule would lose data during compaction; extend the schema intentionally in that case.

## Search rules

The default search covers the current eight top timings and 17 left timings, VTG cells
5-5, 3-5, 1-5, 5-3, 3-3, 3-1, 5-1, 1-3, and 1-1,
both variants where supported, both floor-plane 180 states, and both
Swap states. Each timing pair is independently built in both orders. Swapping an already-built
pair is not a substitute for building the other order because the first timing selects the VTG
base definition family.

The prop carrying the top timing has scale 0.5. The other has scale 1.0 and Third Order strength
1, with the top timing as its warp ratio. Warp direction must match the final Hand category:
Anti requires Anti warp; Spin requires Pro warp. All eight Adjust values from 0 through 315 in
45-degree steps are checked. Scale and warp roles follow the tracks
through Swap. Physical driver/follower indices are recorded explicitly.

The **final ordered tooltip spins after Swap** determine the Hand/Prop category. These are
separate from physical scale/warp roles: a driver can be at output index 1. Consumers must use
the saved role indices, not assume the first physical prop is always the driver.

Candidates are built at orientation 0. None of the recent Concepts page rotation, base-cell,
version, or Adjust exceptions are imported. The exported reconstruction function rebuilds from
the saved VTG selection, then applies Third Order to the recorded follower.

## Alignment and equivalence

For uniform planar periodic animations, the hand and head-direction motions are finite sums of
rotating vectors. Alignment compares the follower's hand with the driver's hand plus its head
direction multiplied by 0.5, using hand-radius units. This ideal head radius deliberately ignores
the model's 0.48 head-center radius and static presentation spacing. The tolerance is `1e-7`.
It tests continuous motion, not just coincident endpoints or similar drawn paths.

The extractor verifies closure, planar geometry, constant scale/strength, and every interval's
angular velocity. Unsupported nonuniform, nonplanar, or translated motion causes a failure;
it is not silently approximated. A cheap analytic warp calculation rejects impossible Adjust
values; every accepted candidate is rebuilt through the production generator and checked again.

Equivalence allows global rotation, turning the plane over (a proper 3D half-turn), exchange of
the complete prop tracks, and any common phase shift through the cycle. It does not permit time
reversal or independently rotating a prop. Canonicalization solves the phase/rotation relation
between two Fourier frequencies, enumerating the finite roots, with coefficients rounded to
eight decimal places. Hand positions AND prop directions participate in the signature.

Deduplication is within a timing/direction cell. The same geometry can appear under different
ordered tooltip categories after Swap; these are separate dropdown entries. Prefer non-swapped
recipes within a group, then direct timing order. Reversed-only and swapped-only discoveries
remain available. Evidence includes each candidate's canonical transform, applied after ordering
the tracks by driver/follower role.

## Limits of this first pass

- Regular VTG cells only; no transitions, QTR, arbitrary per-prop rotation offsets, or other
  free-form editor transforms.
- Adjust is searched on a 45-degree grid, not restricted to 0/180 and not yet continuous.
- The script does not assume there are exactly two versions. Degenerate timings can have
  different numbers of versions; the report exposes this for review.
- Candidate scope and equivalence rules are explicit, provisional assumptions. A successful
  run establishes coverage of this search space, not all imaginable Third Order animations.

Focused tests cover the six supplied examples (groups 1/2/6 and 3/4/5), aligned versus opposed
Adjust, the later 180-degree Spin example, 45-degree alignment, arbitrary phase/rotation,
unsupported motion, ordered post-Swap labels, role reconstruction, and deterministic generation.
