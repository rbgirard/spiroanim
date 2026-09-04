# Property Controls

This document describes editor property metadata, forms, reads, writes, displayed inheritance,
range constraints, and safe slider changes. Concept-specific controls use a separate pipeline; see
[`VTG_AND_QUARTER_SPACING.md`](./VTG_AND_QUARTER_SPACING.md).

The authoritative implementations are:

- `src/features/editor/components/properties/` for property panels and form controls.
- `src/features/editor/composables/useProperties.ts` for property reads, writes, display values,
  and editor-side range constraints.
- `src/features/editor/stores/usePropertiesStore.ts` for the active prop/frame selection.
- `src/services/query/versions/SpiroAnimQSv1.ts` for the `VDEF` ranges used by editor setters.

## Property panel metadata

Panels pass an array of `DynamicVal` metadata to `PropertyPanel.vue`. The panel chooses a form by
appending `Form` to `component`, such as `Decimal` -> `DecimalForm.vue`.

The commonly used metadata fields are:

| Field        | Meaning                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `name`       | State key passed to the getter and setter.                                                     |
| `text`       | Property label displayed by the panel.                                                         |
| `component`  | Form component prefix.                                                                         |
| `undef`      | Shows a clear button and, for selects, an `Undefined` option.                                  |
| `items`      | Values displayed by an integer-backed select.                                                  |
| `label`      | Accessible/manual-input label.                                                                 |
| `min`, `max` | Slider delta range, not necessarily the final property range. Defaults to `-10` and `10`.      |
| `step`       | Slider delta increment. Defaults to `1`.                                                       |
| `mult`       | Converts one slider step into stored units. Defaults to `1`.                                   |
| `float`      | Precision factor used by decimal controls. It truncates with `floor(value * factor) / factor`. |
| `def`        | Fallback starting value when a slider cannot obtain a numeric value.                           |
| `neg`        | Allows negative manual input.                                                                  |
| `posi`       | Forces manual values below `1` up to `1`.                                                      |

`float` is a precision factor, despite its name:

| Metadata     | Effective precision                                                           |
| ------------ | ----------------------------------------------------------------------------- |
| omitted      | Integer-only manual input, but the slider does not itself quantize its result |
| `float: 1`   | Whole numbers, truncated toward negative infinity                             |
| `float: 10`  | One decimal place                                                             |
| `float: 100` | Two decimal places                                                            |

Because the implementation uses `Math.floor`, `float` is not nearest-value rounding. For example,
with `float: 1`, `2.9` becomes `2` and `-2.1` becomes `-3`.

### Decimal sliders are relative controls

`DecimalForm.vue` does not use the range input as the property's absolute value. The range starts
at zero and represents an adjustment from the value captured when interaction begins:

```text
result = captured property value + slider delta * multiplier
```

The range's `min` and `max` therefore limit the adjustment made in one interaction. They do not
define the final stored range. The setter applies the separate `VDEF` range afterward.

For example, `Turns` dynamically uses the current arc denominator as `mult`. If the denominator is
90 degrees, moving the slider by two steps adds 180 stored degrees.

At pointer-down or key-down, the form:

1. Starts a query-history group.
2. Freezes `min`, `max`, and `mult` for the interaction.
3. Captures the current effective value from the property getter.

Each input event writes a new property value. Pointer-up, pointer-cancel, key-up, or blur closes the
history group and resets the range to zero.

If the getter returned an inherited or compiled value, moving the slider writes that effective
value back as an explicit raw property. This is intentional but changes the sparsity of the frame.

### Manual decimal input

`DecimalTextForm.vue` writes on every accepted input change. It starts one history group on focus
and ends it on blur.

Important current behavior:

- Without `float`, the accepted syntax is integer-only.
- With `float`, a decimal point is accepted and the same floor-based precision factor is applied.
- `neg` permits a leading minus sign.
- Without `neg`, a negative numeric result is changed to its positive equivalent.
- An invalid or nonnumeric completed value becomes `0`.
- The setter still applies the `VDEF` range after parsing.

### Other property forms

- `BooleanForm.vue` writes a boolean immediately.
- `SelectIntForm.vue` writes an integer index, or `undefined` when the optional undefined entry is
  selected.
- `BeatsForm.vue` stages slider changes locally and writes only when `APPLY` is selected.
- `OffsetForm.vue` presents three decimal controls and writes a cloned three-coordinate `move`
  tuple. Its horizontal multiplier is reversed.
- `YawForm.vue` adds a reverse-angle action around a decimal control.
- `ArcForm.vue` adds named arc presets but otherwise delegates to the decimal control.
- Point/path/direction controls calculate underlying `arc`, `plane`, `axis`, or `turns` values from
  compiled geometry rather than storing `point`, `path`, or `direct` fields.

Motion, Camera Orbit, and Camera Center expose the shared inheritable Precision boolean. It defaults
to Disabled and renders authored Move and Distance at one tenth scale without changing their raw
editor or query values.

## Property getters, selection, and inheritance display

`usePropertiesStore.ts` derives the currently active raw frames, compiled frames, and props from
the timeline position or selected range. The property getters return a four-item `ValRetType`:

```text
[value, all selected values equal, display string, value is inherited/fallback]
```

The UI styles this state as:

- `val-def`: an explicit value is present and selected values agree.
- `val-fall`: the displayed value comes from compiled data, a prop, or the root.
- `val-undef`: no explicit or fallback value was found.
- `val-mism`: selected items do not agree.

Frame reads look in this order:

1. Raw selected frames.
2. Compiled selected frames when the raw value is undefined.
3. Selected prop values.
4. Root values.

Prop reads look at selected props and then the root. Root reads use the root directly.

The compiler, not the query decoder or property UI, owns the detailed frame inheritance rules.
See [`ANIMATION_FRAME_MODEL.md`](./ANIMATION_FRAME_MODEL.md) before deciding whether an undefined
raw field is equivalent to an explicit value.

## Editor-side constraints

All three normal property setters call `constraints(key, value)` before writing:

- `rootSet` writes or deletes a root field.
- `propSet` writes or deletes the field on every selected prop.
- `animSet` writes or deletes the field on every selected frame, except for calculated geometry
  controls.

`constraints()` reads the active query version's `VDEF` entry and clamps numeric values to its declared
minimum and maximum. For `move`, it clamps each coordinate and mutates the passed array. Booleans
are not numerically clamped. Keys absent from `VDEF` pass through unchanged.

The constraint function does **not**:

- Round or truncate fractional numbers.
- Apply slider `min`, `max`, `step`, `mult`, or `float` metadata.
- Supply defaults or inheritance.
- Validate enum indices beyond their numeric `VDEF` range.
- Run for direct programmatic assignments to `ROOT`.

After a setter mutates the shallow root object, it calls `triggerRef(ROOT)`. This is required to
run compilation and URL watchers after nested mutations.

## How to change a slider safely

Before changing a slider, answer these questions in order:

1. **What value is the user controlling?** Is it the stored property itself, a relative delta, or
   a feature-level input that derives several stored properties?
2. **Which UI owns it?** Editor property controls and concept controls use different pipelines.
3. **What are the stored units?** Scale is displayed in ordinary units but stored as integer
   hundredths; Strength and Depth support one displayed decimal place but are stored as integers.
   Strength stores tenths of a percent, Depth stores tenths of a distance unit, and angles are
   stored in degrees.
4. **Should the control round, floor, or preserve fractions?** Make this explicit before the query
   boundary.
5. **Does the active query version encode the field and scope?** A root field and a same-named prop
   field are not necessarily both serialized.
6. **Does the desired range fit the existing bit width while reserving undefined?** If not, create
   a new query version.
7. **Does undefined inherit, default, or mean zero?** Consult the frame model.
8. **Should a continuous gesture be one undo step?** Use query history grouping when needed.
9. **Can the change affect canonical URLs or old shared links?** Add round-trip and fixed-string
   regression tests.

### Common slider modifications

| Goal                                | Correct place                                                             |
| ----------------------------------- | ------------------------------------------------------------------------- |
| Change how far one drag can adjust  | Metadata `min` / `max`                                                    |
| Change slider granularity           | Metadata `step`                                                           |
| Change stored units per step        | Metadata `mult`                                                           |
| Quantize an editor decimal control  | Metadata `float`, while accounting for floor semantics                    |
| Change the legal persisted range    | New or intentionally revised query schema plus migration/version analysis |
| Round a derived VTG value           | VTG transform function before assigning animation data                    |
| Change inheritance/default behavior | Compiler/frame model, not query packing                                   |

## Regression coverage

Property-control changes should cover the applicable behavior:

- Slider step, multiplier, precision, text parsing, and final setter calls.
- Below-minimum, maximum, above-maximum, array coordinates, and fractions.
- Inherited, fallback, undefined, and mismatched display states.
- Gesture grouping when a continuous interaction should be one undo step.
- Query round trips when a control changes serialized state.

## Current cautions

- `VDEF` is both the source for editor range constraints and part of the persisted query schema.
  Changing it for UI convenience can silently change shared-URL compatibility.
- Slider bounds describe relative adjustment, while query bounds describe stored values.
- `float` truncates; it does not round.
- Query V1 assumes integers, but editor setters only clamp ranges.
- Direct state assignments bypass `constraints()` and must enforce their own normalization.
