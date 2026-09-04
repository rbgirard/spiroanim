# Query String Format

This document defines SpiroAnim's versioned URL schema, segment layouts, packing, sparse encoding,
decoder behavior, and compatibility requirements. Treat every published query version as a
persisted-data contract.

The authoritative implementations are:

- `src/services/query/versions/SpiroAnimQSv1.ts` through `SpiroAnimQSv12.ts` for versioned ranges,
  bit widths, field order, and segment layouts.
- `src/services/query/createBaseQueryCodec.ts` for integer normalization and bit packing.
- `src/composables/useSpiroAnimQS.ts` for root, prop, and frame encoding and decoding.
- `src/math/animation/PlayerFunc.ts` for post-decode root defaults.

## Query schema definitions

`SpiroAnimQSv1.ts` defines the shared ranges used by both supported layouts and by editor setters.
Every definition is:

```text
[minimum, maximum, bit width, optional decode transform]
```

Version 1 stores integer values. One all-ones bit pattern is reserved for `undefined`, so a field
with `N` bits has at most `2^N - 1` defined codes.

| Field       |       V1 range |      Bits | Stored scope and notes                                |
| ----------- | -------------: | --------: | ----------------------------------------------------- |
| `bpm`       |        20..520 |         9 | Root                                                  |
| `beats`     |          1..63 |         6 | Frame                                                 |
| `prop`      | 0..1 currently |         4 | Root and prop; range follows `PTEXT` length           |
| `color`     | 0..6 currently |         4 | Root and prop; range follows `COLORS` length          |
| `guides`    |           0..1 |         2 | Root and prop; decoded with `Boolean`                 |
| `paths`     |           0..1 |         2 | Root and prop; decoded with `Boolean`                 |
| `hands`     |           0..1 |         2 | Root and prop; decoded with `Boolean`                 |
| `precision` |           0..1 |         2 | Motion and Camera in V6; decoded with `Boolean`       |
| `arms`      |           0..1 |         2 | Root and prop in V2; decoded with `Boolean`           |
| `visible`   |           0..1 |         2 | Root and prop; decoded with `Boolean`                 |
| `nodes`     |           0..1 |         2 | Root and prop; decoded with `Boolean`                 |
| `anchors`   |           0..1 |         2 | Root and prop; decoded with `Boolean`                 |
| `smooth`    |           0..1 |         2 | Defined, but not currently included in a V1 segment   |
| `type`      | 0..1 currently |         2 | Frame; range follows `TTEXT` length                   |
| `scale`     |        -20..40 |         6 | Frame, in internal tenths through V11                 |
| `warp`      |    -1980..1980 | 16 in V12 | Extended Animation frame degrees; tenths in V12       |
| `strength`  |        0..1000 | 10 in V12 | Extended Animation frame; tenths of a percent         |
| `depth`     |        -30..30 |         6 | Frame, in internal tenths                             |
| `turns`     |    -1980..1980 |        12 | Frame degrees                                         |
| `twist`     |      -360..360 | 10 in V10 | Extended Animation/Rotation frame degrees             |
| `adjust`    |      -180..180 |         9 | Frame degrees                                         |
| `arc`       |         0..360 |         9 | Frame degrees                                         |
| `plane`     |      -180..180 |         9 | Frame degrees                                         |
| `axis`      |      -180..180 |         9 | Frame degrees                                         |
| `move`      |        -30..30 |    6 each | Animation frame in V1-V3; Motion frame in V4          |
| `aspectx`   |          0..32 |         6 | Root                                                  |
| `aspecty`   |          0..32 |         6 | Root                                                  |
| `distance`  |          4..66 |         6 | Root in V1-V4; Motion and Camera path field           |
| `thick`     |          1..15 |         4 | Root only in V1; prop-level `thick` is not serialized |

The declared range must fit while retaining the undefined code. Development builds call
`validateQueryDefinitions()`, which logs an error for an oversized definition but does not throw.

### Fields that exist in memory but are not serialized

The query configuration, rather than `VDEF` alone, determines whether a field is stored.

Notable omissions from V1 include:

- Root `speed`, `type`, `turns`, and `depth`. `rootFinal()` supplies their runtime defaults after
  decode.
- Root `smooth`, despite having a `VDEF` entry.
- Root and prop `arms`; V1 decoding supplies the root default of `false` after decode.
- Prop-level `thick`, despite `PropData` allowing it and `VDEF` defining `thick`.
- Runtime/editor fields such as prop `active` and `click`.
- Calculated UI concepts `point`, `path`, and `direct`.

Changing one of these omissions is a query-format change, not merely a TypeScript or panel change.

## Version 1 segment layout

The URL uses these keys:

```text
?r=<root>&p0=<first prop>&p1=<second prop>&...&v=1
```

Prop keys must be contiguous. Decoding begins with `p0` and stops at the first missing key, so a
URL containing `p0` and `p2` but no `p1` ignores `p2` and everything after it.

The root value contains two fixed groups:

1. Five characters: `bpm`, `color`, `prop`, and the six root booleans.
2. Four characters: `aspectx`, `aspecty`, `distance`, and `thick`.

Each prop begins with:

1. Three characters for inherited display booleans and `color`.
2. One character for `prop`.
3. A dot-separated animation-frame section.

Each frame may contain, in order:

1. Three characters: `plane`, `arc`.
2. Two characters: `turns`.
3. Two characters: `type`, `axis`.
4. One character: `beats`.
5. One character: `scale`.
6. One character: `depth`.
7. Two characters: `adjust`.
8. Three characters: `move.x`, `move.y`, `move.z`.

## Version 2 segment layout

Version 2 keeps every V1 field in the same position and uses previously unused bits for `arms`:

- The root's second four-character group appends root `arms` after `thick`.
- The prop's one-character group appends inherited prop `arms` after `prop`.
- Frame groups are unchanged.

Version 1 URLs remain supported and decode with root `arms` set to `false`; an omitted prop value
inherits that root default.

## Version 3 alphabet

Version 3 retains the Version 2 layout but swaps the last two alphabet characters. This makes `_`
the maximum-value padding character so repeated padding is less likely to be changed into
typographic punctuation by sharing platforms.

## Version 4 Motion layout

Version 4 removes the three `move` characters from every `pN` Animation frame. Each prop can have
a matching optional `mN` value containing its independent Motion frames:

```text
?r=<root>&p0=<first prop>&m0=<first Motion>&p1=<second prop>&m1=<second Motion>&...&v=4
```

Each Motion frame contains, in order:

1. Three characters: `beats`, `distance`, and indexed `shape`.
2. Three characters: signed `arc` and `plane`.
3. Three characters: `axis` and percentage `amount`.

Motion uses `Linear`, `Arc`, and `Circle` shape indices. Signed Motion Arc is normalized into the
existing unsigned Arc query range, and zero-based Motion Distance is shifted into the existing
camera Distance query range. These adaptations are reversed immediately at the v4 serialization
boundary; editable Motion data remains signed and zero-based.

Version 4 also stores the inheritable Travel rendering flag on Root and Prop data. Missing Root
Travel values from older URLs normalize to `false`, and an undefined Prop value inherits that Root
setting. Travel is not a Motion-frame property.

An `mN` value is emitted when that prop has at least one Motion frame. Empty authored frames are
retained through their dot separators so Insert Frame survives refresh and undo reconstruction. An
`mN` value is omitted for `motion: []`, so unused Motion does not lengthen the URL. Decoding still
initializes every finalized prop with a Motion array.

When a V1-V3 URL is opened by V4, legacy Cartesian Animation `move` fields are removed and converted
into chained Motion Arc, Plane, and Distance fields. Consecutive stationary Animation spans are
compacted when doing so, while retaining the outgoing boundary immediately before movement begins.

Field order, group order, group length, bit width, and the query alphabet are persisted-data
contracts. Reordering a list without changing its types still changes every encoded URL.

## Version 5 Camera layout

Version 5 removes global root `distance` from the root's second packed group and adds the root-owned
Camera value `c`:

```text
?r=<root>&p0=<first prop>&m0=<first Motion>&...&c=<Orbit>~<Center>&v=5
```

Orbit and Center are two synchronized Motion-encoded frame streams separated by `~`, with Orbit
first. Each uses the Version 4 Motion frame groups and normalization rules. Only Orbit stores the
Camera frame's `beats`; any Beats decoded from Center are discarded. A single empty frame on either
side needs no payload, so the fully empty Camera track is encoded as `c=~`. A period separates
Camera frames rather than prefixing the frame stream; two empty frames are therefore `c=.~.`.

`rootFinal()` guarantees at least one Camera frame. When decoding V1-V4, the legacy root Distance
creates a centered first frame with Center `[0, 0, 0]` and Orbit `[0, 0, -distance]`. Finalized
runtime root data no longer retains global Distance. Historical codecs derive Distance from the
first Camera Orbit when an older URL must be re-encoded, preserving published URL round trips.

## Version 6 Precision layout

Version 6 adds inheritable `precision` to prop Motion, Camera Orbit, and Camera Center frames. It
uses the two previously unused high bits in the final three-character Motion group:

```text
axis (9 bits), amount (7 bits), precision (2 bits)
```

Precision is deliberately the final packed value. Because fields are packed least-significant
first, its two bits occupy the beginning of that encoded segment without increasing Motion or
Camera frame length. `undefined`, `false`, and `true` remain distinct query values. Versions 1-5
do not serialize Precision and compile missing values from the initial `false` default.

Version 6 also removes the redundant leading `.` from standalone prop Motion (`mN`) values. A dot
separates adjacent Motion frames; it does not precede the first frame. Consequently, a single
completely empty Motion frame produces no `mN` parameter, while multiple empty frames retain the
dots needed to preserve their frame count. Versions 4 and 5 keep their historical leading-dot
format for compatibility.

## Version 7 fractional Turns layout

Version 7 stores Animation `turns` to one decimal place across the existing `-1980..1980` degree
range. A bidirectional query transform multiplies degrees by 10 before packing and divides by 10
after unpacking. The application-facing `VDEF` range remains in degrees so editor constraints do
not see the scaled integer representation.

The four spare bits distributed across the Version 6 Animation frame are recovered by repacking
the frame into four three-character groups:

1. `plane` (9 bits), `arc` (9 bits)
2. `turns` (16 bits), `type` (2 bits)
3. `axis` (9 bits), `adjust` (9 bits)
4. `beats` (6 bits), `scale` (6 bits), `depth` (6 bits)

Every group uses exactly 18 bits, so Animation frames remain 12 characters. Versions 1-6 retain
their historical field positions and whole-degree Turns representation.

## Version 10 extended Animation layout

Version 10 moves `beats`, `scale`, and `depth` out of each prop's `pN` Animation frames and adds
`twist`. The moved values use an optional parallel `xN` track with the same prop number and frame
indices:

```text
p0=<prop settings>.<base frame 0>.<base frame 1>...
x0=<extended frame 0>.<extended frame 1>...
```

The V10 `pN` frame contains three three-character groups:

1. `plane` (9 bits), `arc` (9 bits)
2. `turns` (16 bits), `type` (2 bits)
3. `axis` (9 bits), `adjust` (9 bits)

The corresponding `xN` frame contains:

1. `beats` (6 bits), `scale` (6 bits), `depth` (6 bits)
2. `twist` (10 bits), padded to two characters

An `xN` value has no leading dot because it has no prop-level prefix. Internal empty frames retain
their dot positions so indices remain aligned with `pN`. Trailing empty extended frames are
removed, and an entirely empty extended track produces no `xN` parameter. Decoding merges each
extended frame into its matching base frame before defaults and inheritance are compiled.

## Version 11 Rotation Animation layout

Version 11 moves Twist out of `xN` and introduces an optional `rN` Rotation Animation track. Each
five-character Rotation frame packs one 29-bit group:

1. `twist` (10 bits), `rotate` (10 bits), and `yaw` (9 bits)

`xN` returns to one three-character group containing `beats`, `scale`, and `depth`. Sparse-frame
alignment and trailing empty-frame removal follow the same rules as the other optional tracks.

## Version 12 Warp, Strength, and Scale layout

Version 12 adds inherited `warp` and `strength`, and changes Scale's internal unit from tenths to
hundredths. The current definitions are:

| Field      | Current range | Bits | Meaning                                      |
| ---------- | ------------: | ---: | -------------------------------------------- |
| `scale`    |   `-200..400` |   10 | Raw hundredths; `100` displays as `1.0`      |
| `strength` |     `0..1000` |   10 | Tenths of a percent; `500` displays as `50%` |
| `warp`     | `-1980..1980` |   16 | Tenths-degree auxiliary hand-path rotation   |

The `xN` values are reordered into four groups per frame:

1. Two characters: `scale` (10 bits)
2. Two characters: `beats` (6 bits), `depth` (6 bits)
3. Two characters: `strength` (10 bits)
4. Three characters: `warp` (16 bits)

Warp uses the same range, tenths-degree codec, and bit width as the current Turns definition. A
complete `xN` frame therefore occupies nine characters, while trailing undefined groups are still
omitted.

Twist remains in the Version 11 `rN` track. Warp does not appear in `pN`, so canonical Arc, Plane,
Axis, and Adjust packing is unchanged.

When the current decoder opens a Version 1-11 URL, it multiplies every authored Scale value by ten
after the historical decoder runs. This migration happens only across the version boundary;
Version 12 data and current undo history are not multiplied again.

## Low-level packing

Versions 1 and 2 use this custom URL-safe radix-64 alphabet:

```text
0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-
```

This is not standard Base64. The final character, `-`, is also the maximum radix digit used for
all-ones padding.

Versions 3 through 12 use the same characters with the final pair reversed:

```text
0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_
```

For a defined numeric value, normalization is:

```text
normalized = clamp(value - minimum, 0, maximum - minimum)
```

For `undefined`, normalization produces the field's all-ones bit pattern. Fields are packed
least-significant field first into a signed 32-bit JavaScript bit field. Versioned packed groups
must therefore remain within the documented practical maximum of 30 bits.

Unused bits up to the fixed character length are filled with ones. Entire trailing groups made
only of maximum digits are removed. On decode, the all-ones field value becomes `undefined`. A
legacy one-way definition transform such as `Boolean`, or a bidirectional numeric codec such as
Version 7 Turns, is then applied.

### Integer requirement and fractional values

Versions 1-6 have no fractional encoding. Version 7 and later explicitly support tenths for
Animation Turns through its bidirectional numeric transform. Version 12 gives Warp the same
tenths-degree transform. Other packed angle channels remain whole degrees. Scale and Strength
remain integer query values; Version 12 defines Scale as hundredths and Strength as tenths of a
percent. The
property setter's range clamp does not otherwise enforce integer or decimal precision.

Packed scalar fields pass through JavaScript bitwise operators, which coerce nonnegative
normalized fractions to integers by discarding the fractional part. This is an implementation
side effect, not a supported rounding policy. A value such as root `distance: 17.5` can therefore
decode as `17` after a query-string round trip.

The three legacy `move` coordinates in Versions 1 through 3 use direct radix encoding rather than
the packed-field path. Passing a fraction there can produce malformed or shortened output because
fractional values are not valid alphabet indices. Every legacy Cartesian value must be converted
to an integer before encoding. Version 4 Motion fields use packed integer groups.

Consequently, a feature that calculates a field without an explicit query transform should make
its rounding policy explicit at the feature boundary:

```text
derived floating-point value
        |
        v
explicit Math.round / floor / ceil chosen by domain behavior
        |
        v
  integer RootData/PropData/AnimData/MotionData value
        |
        v
query encoder
```

Do not rely on the serializer's bitwise coercion as a clamp.

## Sparse encoding

Query encoding preserves sparse raw data rather than compiled values.

- An undefined field uses its reserved all-ones code.
- Trailing all-undefined groups are removed from a root, prop, or frame.
- Frame strings are joined with `.`.
- An entirely empty frame contributes no field characters but retains its dot position.
- Undefined fields in the middle of a group remain encoded because later fields need their fixed
  bit positions.

This is why raw-frame compaction matters. Explicit inherited values make URLs longer even when
compiled playback is identical. See [`ANIMATION_FRAME_MODEL.md`](./ANIMATION_FRAME_MODEL.md) for
safe frame compaction rules.

## Decoding, defaults, and malformed input

`decodeVer()` reads `v`, defaulting to the current version. A supported historical version loads
its matching module. An unavailable version is rejected instead of being interpreted with the
wrong layout.

Current decoder tolerance includes:

- Characters outside the custom alphabet contribute a zero radix digit.
- Short fixed groups decode only the substrings that are present.
- Numeric outputs are clamped again to their definition ranges.
- Missing packed fields remain undefined.

This tolerance is compatibility behavior, not comprehensive validation of untrusted data.

After query decoding, `rootFinal()` currently supplies:

- `speed: 1`
- root `type: Spherical`
- root `turns: 0`
- root `depth: 0`
- root `arms: false` when the decoded version does not provide it
- `motion: []` on every prop when Motion is absent

Frame defaults and inheritance are applied later by `rootCompile()`. Query decoding deliberately
does not expand sparse frame objects.

## How to change the query format safely

Treat a query version as immutable once URLs have been shared. The following all require versioning
analysis and normally a new version:

- Reordering fields or groups.
- Changing a bit width.
- Changing a field minimum or its numeric meaning.
- Changing the custom alphabet.
- Adding a field into an existing fixed group.
- Starting to serialize a previously omitted field.
- Changing boolean or enum transforms.
- Changing frame separators or trailing-group stripping.

A new version should:

1. Add a new module under `src/services/query/versions/`.
2. Preserve the old module unchanged.
3. Add the version to `loadSpiroAnimQSVersion()`.
4. Advance `CURRENT_VERSION` only for newly generated URLs.
5. Define how older decoded data obtains new defaults.
6. Add fixed known-string tests for each supported version.
7. Add encode/decode tests at range boundaries, for undefined, and for every new field.
8. Test full application data through encode -> decode -> compile, not only the low-level codec.

## Regression coverage

Query-format changes should cover the applicable behavior:

- Minimum, maximum, undefined, boolean transforms, invalid characters, and bit capacity.
- Known historical root and prop strings remaining unchanged.
- Empty frames, middle undefined fields, trailing undefined groups, and `move`.
- Editable data -> query -> editable data -> compiled data round trips.
- Initial route hydration and subsequent ROOT-to-URL replacement.
- Full feature-generated patterns through encode/decode when they use changed fields.

## Current cautions

- `VDEF` currently serves both editor constraints and persisted query schema.
- Query fields assume integers unless their active version defines an explicit numeric transform;
  editor setters only clamp ranges.
- Prop-level `thick` and root `smooth` are currently outside V1 query and undo coverage.
- Unsupported query versions are rejected.
- Prop decoding stops at the first missing numbered prop key.
- Equivalent compiled animation data can have different sparse raw objects and URL lengths.
