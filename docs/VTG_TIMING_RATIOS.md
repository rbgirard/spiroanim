# VTG Timing Ratios

This document defines the mathematics, canonical naming, generation, and detection rules for VTG
timing ratios. The ratio vocabulary is independent of the curated ratio picker and pattern catalog,
so loaded animations may carry other valid timings.

VTG cell references are always written row first, then column. For example, `3-5` means row 3,
column 5. Catalog keys, UI selections, previews, matching results, and tests all use this order.

In this document, **petal** means one relative prop rotation expressed by the completed pattern.

## Angle terms

For one movement segment:

- `Arc` is the hand or path displacement.
- `Turns` is the prop's rotation relative to that hand displacement.
- The prop's absolute angular displacement is `Arc + Turns`.

The sign of `Turns` alone does not determine Anti-Spin or In-Spin. Spin is determined by comparing
the hand's motion with the prop's absolute motion. When their signed movement axes agree, the motion
is In-Spin; when they oppose, it is Anti-Spin.

For example, `Arc = 45` and `Turns = -22.5` produces an absolute prop displacement of `22.5`.
Although Turns is negative, both absolute movements remain in the same direction, so this is
In-Spin.

For a complete pattern, accumulated values are the sums of the segment values. A segment Arc may
remain within the current 360-degree limit even when a preview or animation contains repeated
segments.

VTG generation uses eight 45-degree intervals per complete hand rotation. At the established
doubled playback rate, each hand rotation occupies four beats. A numerator-1 timing therefore uses
four beats and nine frames, while a numerator-2 timing uses eight beats and seventeen frames. A
compound timing uses the least common multiple of its two numerators so both prop timings close.

Reciprocal Trans playback follows the same timing-cycle length. A one-rotation timing performs four
relationship-change passes. When either prop requires a numerator-2 cycle, Trans performs eight
passes so the reciprocal sequence closes across the complete eight-beat pattern.

## Individual timing definition

A valid individual VTG timing is a positive reduced ratio `p:q`:

- the hand or path completes `p` full circles;
- the prop completes `q` full absolute circles;
- `p` and `q` are positive whole numbers;
- `gcd(p, q) = 1`.

Ratios are always canonicalized to lowest terms. Therefore `2:2` is named `1:1`, and `2:4` is
named `1:2`.

For the completed timing:

```text
Complete Arc              =  360 * p
Anti absolute prop motion = -360 * q
In absolute prop motion   =  360 * q

Anti total Turns          = -360 * (p + q)
In total Turns            =  360 * (q - p)
```

For a segment whose hand displacement is `Arc`:

```text
Anti Turns = -Arc * (p + q) / p
In Turns   =  Arc * (q - p) / p
```

The relative petal counts over a complete timing are:

```text
Anti petals = p + q
In petals   = abs(q - p)
```

The existing `1:n` equations are the `p = 1` form of these general equations:

```text
Anti Turns = -Arc * (n + 1)
In Turns   =  Arc * (n - 1)
```

## Forty-five-degree examples

| Ratio | Spin |   Turns | Absolute `Arc + Turns` | Petals over complete timing |
| ----- | ---- | ------: | ---------------------: | --------------------------: |
| `1:1` | Anti |    -90° |                   -45° |                           2 |
| `1:1` | In   |      0° |                    45° |                           0 |
| `1:3` | Anti |   -180° |                  -135° |                           4 |
| `1:3` | In   |     90° |                   135° |                           2 |
| `2:1` | Anti |  -67.5° |                 -22.5° |                           3 |
| `2:1` | In   |  -22.5° |                  22.5° |                           1 |
| `2:3` | Anti | -112.5° |                 -67.5° |                           5 |
| `2:3` | In   |   22.5° |                  67.5° |                           1 |
| `2:5` | Anti | -157.5° |                -112.5° |                           7 |
| `2:5` | In   |   67.5° |                 112.5° |                           3 |

The `1:1` In-Spin case is not a mathematical exception. Its Turns value is zero because the
absolute prop displacement equals the hand displacement. The prop is not static. Its completed
path has zero petals and may appear as a circle or a degenerate circle depending on geometry and
phase.

The `2:1` In-Spin case demonstrates why the sign of Turns cannot identify spin. Its negative
relative Turns only partially counters the positive Arc, leaving a positive absolute prop motion.

## Worked `2:3` example

For two complete hand circles:

| Motion    |  Arc |  Turns | Absolute prop displacement | Petals |
| --------- | ---: | -----: | -------------------------: | -----: |
| Anti-Spin | 720° | -1800° |                     -1080° |      5 |
| In-Spin   | 720° |   360° |                      1080° |      1 |

The equivalent 45-degree segments are:

| Motion    | Arc |   Turns | Absolute prop displacement |
| --------- | --: | ------: | -------------------------: |
| Anti-Spin | 45° | -112.5° |                     -67.5° |
| In-Spin   | 45° |   22.5° |                      67.5° |

Sixteen such segments accumulate the same values as the 720-degree form. Numerator-2 timing is why
Turns and Warp retain half-degree precision in the current query format.

## Ratio detection

For a timing-bearing compiled segment, calculate the absolute prop displacement and its magnitude
relative to the hand displacement:

```text
absolute = Arc + Turns
rate     = abs(absolute / Arc)
```

The reduced positive rational approximation of `rate` is `q/p`, so the displayed individual timing
reverses those fraction terms:

```text
rate = q / p
timing = p:q
```

Examples:

```text
rate = 3       -> 3/1 -> 1:3
rate = 1.5     -> 3/2 -> 2:3
rate = 0.5     -> 1/2 -> 2:1
```

Detection uses a floating-point tolerance when finding the reduced rational number. The tolerance
includes half of the widest supported serialized Turns step relative to the segment Arc, allowing
the intended ratio to survive historical whole-degree or current half-degree quantization. It
rejects a zero Arc, zero absolute prop displacement, non-finite values, and continuations that
disagree on either timing or spin.

Spin is recovered separately from the ratio. The compiled hand and prop axes, Arc, and absolute
prop displacement determine whether their signed motions agree:

```text
same signed direction     -> In-Spin
opposite signed direction -> Anti-Spin
```

This is the same geometric rule used by the Pattern Builder's `AA`, `AI`, `IA`, and `II` motion
labels.

Initial placement values do not replace continuations used for timing detection. For example, an
initial `Arc = 180`, `Turns = 0` may establish placement while later 45-degree continuations carry
the timing.

## Compound timings

Each prop's timing is detected independently and retains prop order. When both props have the same
individual timing, the pattern uses that timing directly:

```text
2:3 + 2:3 = 2:3
```

When the props differ but share a numerator, write the numerator once and join the denominators
with `v`:

```text
prop[0] 2:3 + prop[1] 2:5 = 2:3v5
prop[0] 2:5 + prop[1] 2:3 = 2:5v3
```

When the numerators differ, retain both complete ratios:

```text
prop[0] 1:1 + prop[1] 2:3 = 1:1v2:3
prop[0] 2:3 + prop[1] 1:1 = 2:3v1:1
```

A compound name is canonical only when each individual ratio is reduced, identical prop timings
are collapsed, and a shared numerator is not unnecessarily repeated.

Swap is applied after generation as an exchange of the completed animation tracks. It does not
change the selected compound timing because each completed track carries its generated timing with
it.

## Ratio-dependent Scale

VTG's established Scale adjustments are keyed by the individual timing denominator rather than by
the complete ratio string. Consequently, `2:3` uses the same adjustment as `1:3`, and `2:5` uses
the same adjustment as `1:5`.

For a compound timing, generation uses the larger of the two denominator adjustments. For example,
`1:3v2` uses the `3` adjustment because it is larger than the `2` adjustment.

## Pattern Builder Arc conversion

Pattern Builder normalizes a uniform continuation Arc to 45 degrees when the conversion factor is
a whole number. Larger Arcs are subdivided (`90`, `135`, `180`, and `360`, for example); smaller
Arcs are consolidated when they divide 45 evenly (`15`, for example) and complete frame groups are
available.

Subdivision divides Turns by the same factor. Every resulting Turns value must be exactly
representable in the current half-degree storage precision. A result requiring quarter-degrees or
finer precision is rejected instead of being rounded. Consolidation likewise preserves complete
intervals and multiplies Arc and Turns cleanly; it never discards a partial interval group.

## Detection procedure

1. Identify the compiled timing-bearing continuations for each prop.
2. Calculate `absolute = Arc + Turns` for each continuation.
3. Compare the signed hand and absolute prop motions to classify Anti-Spin or In-Spin.
4. Calculate `rate = abs(absolute / Arc)`.
5. Approximate `rate` as the reduced positive fraction `q/p`, then name the timing `p:q`.
6. Verify that every continuation for the prop has the same timing and spin.
7. Combine the two prop timings using the canonical compound naming rules.

The ratio picker remains curated. Its row contains `1:1`, `2:1`, `1:2`, `1:3`, `2:3`, `1:4`,
`1:5`, and `2:5`. Compound and other canonical ratios can still be generated programmatically,
recovered from loaded animations, and used by VTG pattern matching even though they are not exposed
as picker options.

The `More` control replaces the radio row with one ratio selector per prop. The first selector starts
with the current radio ratio. The second starts at `none`, which applies the first ratio to both
props. Selecting a second ratio creates the canonical compound timing for the two prop tracks.

Pattern Builder drag/drop operations retain one complete cycle of the selected timing. A
numerator-1-only selection inserts a four-beat piece; a selection involving a numerator-2 timing,
including a mixed compound such as `1:1v2:3`, inserts an eight-beat piece.

Every Builder junction preserves the complete motion code. Append, prepend, insert, replace, swap,
reverse, and suffix rejoin operations may adjust both Plane and Axis, and accept a junction only
when both props retain their Anti/In spins and their Same/Opposite direction relationship.
