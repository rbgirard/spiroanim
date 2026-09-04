<template>
  <section
    ref="rootElement"
    class="pattern-property-controls"
    :data-role="`${context}-properties`"
    :data-context="context"
  >
    <div
      class="pattern-property-controls__tabs"
      role="tablist"
      aria-label="Pattern properties"
      @click="collapseFromTabRow"
    >
      <BaseTooltip
        v-for="property in visibleProperties"
        :key="property.key"
        class="pattern-property-controls__property-tooltip"
        :text="propertyTooltip(property)"
        :disabled="touchDevice || !propertyTooltip(property)"
      >
        <template #activator="{ props: tooltipProps }">
          <button
            v-bind="tooltipProps"
            :id="`${controlId}-${property.key}-toggle`"
            class="pattern-property-controls__toggle"
            type="button"
            role="tab"
            :aria-selected="activeProperty === property.key"
            :aria-expanded="activeProperty === property.key"
            :aria-controls="`${controlId}-${property.key}-controls`"
            :data-role="`${context}-property-${property.key}-toggle`"
            @click="toggleProperty(property.key)"
          >
            {{ propertyLabel(property) }}
          </button>
        </template>
      </BaseTooltip>
      <button
        v-if="activeProperty !== null"
        class="pattern-property-controls__collapse"
        type="button"
        aria-label="Collapse property controls"
        :data-role="`${context}-properties-collapse`"
        @click.stop="emit('update:activeProperty', null)"
      >
        -
      </button>
    </div>
    <div
      v-for="property in visibleProperties"
      v-show="activeProperty === property.key"
      :id="`${controlId}-${property.key}-controls`"
      :key="property.key"
      class="pattern-property-controls__panel"
      role="tabpanel"
      :aria-labelledby="`${controlId}-${property.key}-toggle`"
      :data-role="`${context}-property-${property.key}-controls`"
    >
      <template v-if="property.key === 'offset'">
        <div class="pattern-property-controls__twist-columns">
          <section
            v-for="(label, propIndex) in propLabels"
            :key="label"
            class="pattern-property-controls__twist-column pattern-property-controls__offset-column"
            :aria-label="`${label} Offset`"
          >
            <h3 class="pattern-property-controls__offset-heading">{{ label }}</h3>
            <div
              class="pattern-property-controls__offset-controls"
              :class="{
                'pattern-property-controls__twist-frame--inherited': !offsetIsSet(propIndex),
                'pattern-property-controls__offset-controls--set': offsetIsSet(propIndex),
                'pattern-property-controls__offset-controls--stepper': !sliders,
              }"
            >
              <input
                v-if="sliders"
                type="range"
                min="-90"
                max="90"
                step="90"
                :value="offsetSliderValue(offsetValue(propIndex))"
                :aria-valuetext="`${offsetValue(propIndex)}°`"
                :aria-label="`${label} offset`"
                :data-role="`${context}-offset-${propIndex}`"
                @input="setOffsetFromSlider(propIndex, $event)"
                @pointerdown="emit('sliderStart')"
                @pointerup="emit('sliderEnd')"
                @pointercancel="emit('sliderEnd')"
                @keydown="emit('sliderStart')"
                @keyup="emit('sliderEnd')"
                @blur="emit('sliderEnd')"
              />
              <ConceptStepper
                v-else
                :model-value="offsetValue(propIndex)"
                :min="-90"
                :max="90"
                :step="90"
                :label="`${label} offset`"
                :data-role="`${context}-offset-${propIndex}-stepper`"
                :display-value="`${offsetValue(propIndex)}°`"
                @update:model-value="setOffsetFromStepper(propIndex, $event)"
              />
              <input
                class="pattern-property-controls__offset-input"
                type="text"
                inputmode="numeric"
                :value="offsetDraftValues[propIndex]"
                :aria-label="`${label} offset value`"
                :data-role="`${context}-offset-${propIndex}-input`"
                @focus="beginOffsetText(propIndex)"
                @input="setOffsetFromText(propIndex, $event)"
                @blur="endOffsetText(propIndex)"
              />
              <button
                type="button"
                class="pattern-property-controls__delete"
                :disabled="!offsetIsSet(propIndex)"
                :aria-label="`Clear ${label} offset`"
                @click="clearOffset(propIndex)"
              >
                <BaseIcon :path="mdiTrashCanOutline" :size="18" />
              </button>
            </div>
          </section>
        </div>
      </template>
      <template v-else-if="property.key === 'scale'">
        <fieldset
          class="pattern-property-controls__option-group pattern-property-controls__twist-mode"
        >
          <legend class="pattern-property-controls__visually-hidden">Scale detail</legend>
          <label v-for="mode in scaleModes" :key="mode">
            <input
              type="radio"
              :name="`${controlId}-scale-mode`"
              :value="mode"
              :checked="scaleMode === mode"
              @change="emit('update:scaleMode', mode)"
            />
            <span>{{ mode === 'simple' ? 'Simple' : 'Advanced' }}</span>
          </label>
        </fieldset>
        <div v-if="scaleMode === 'simple'" class="pattern-property-controls__twist-columns">
          <section
            v-for="(label, propIndex) in propLabels"
            :key="label"
            class="pattern-property-controls__twist-column"
            :aria-label="`${label} Scale`"
          >
            <header class="pattern-property-controls__twist-header">
              <span>Beat</span>
              <h3>{{ label }}</h3>
              <span>Value</span>
            </header>
            <label
              class="pattern-property-controls__twist-frame"
              :class="{
                'pattern-property-controls__twist-frame--inherited': !scaleIsSet(propIndex),
                'pattern-property-controls__value-set': scaleIsSet(propIndex),
                'pattern-property-controls__twist-frame--stepper': !sliders,
              }"
            >
              <span class="pattern-property-controls__beat">
                {{ formatBeat(simpleScaleFrame(propIndex).beat) }}
              </span>
              <input
                v-if="sliders"
                type="range"
                min="0"
                max="1.4"
                step="0.1"
                :value="scaleValue(propIndex)"
                :aria-valuetext="scaleValue(propIndex).toFixed(1)"
                :aria-label="`${label} Scale`"
                :data-role="`${context}-scale-${propIndex}`"
                @input="setScaleFromSlider(propIndex, simpleScaleFrame(propIndex).beat, $event)"
                @pointerdown="emit('sliderStart')"
                @pointerup="emit('sliderEnd')"
                @pointercancel="emit('sliderEnd')"
                @keydown="emit('sliderStart')"
                @keyup="emit('sliderEnd')"
                @blur="emit('sliderEnd')"
              />
              <ConceptStepper
                v-else
                :model-value="scaleValue(propIndex)"
                :min="0"
                :max="1.4"
                :step="0.1"
                :label="`${label} Scale`"
                :data-role="`${context}-scale-${propIndex}-stepper`"
                :display-value="scaleValue(propIndex).toFixed(1)"
                @update:model-value="
                  setScaleFromStepper(propIndex, simpleScaleFrame(propIndex).beat, $event)
                "
              />
              <output v-if="sliders">{{ scaleValue(propIndex).toFixed(1) }}</output>
              <button
                type="button"
                class="pattern-property-controls__delete"
                :disabled="!scaleIsSet(propIndex)"
                :aria-label="`Clear ${label} Scale`"
                @click="clearScale(propIndex, simpleScaleFrame(propIndex).beat)"
              >
                <BaseIcon :path="mdiTrashCanOutline" :size="18" />
              </button>
            </label>
          </section>
        </div>
        <div v-else class="pattern-property-controls__twist-columns">
          <section
            v-for="(column, propIndex) in scaleColumns"
            :key="column.label"
            class="pattern-property-controls__twist-column"
            :aria-label="`${column.label} Scale`"
          >
            <header class="pattern-property-controls__twist-header">
              <span>Beat</span>
              <h3>{{ column.label }}</h3>
              <span>Value</span>
            </header>
            <label
              v-for="frame in column.frames"
              :key="frame.index"
              class="pattern-property-controls__twist-frame"
              :class="{
                'pattern-property-controls__twist-frame--inherited': !frame.isSet,
                'pattern-property-controls__value-set': frame.isSet,
                'pattern-property-controls__twist-frame--stepper': !sliders,
              }"
            >
              <span class="pattern-property-controls__beat">{{ formatBeat(frame.beat) }}</span>
              <input
                v-if="sliders"
                type="range"
                min="0"
                max="1.4"
                step="0.1"
                :value="frame.value"
                :aria-valuetext="frame.value.toFixed(1)"
                :aria-label="`${column.label} Scale at beat ${formatBeat(frame.beat)}`"
                :data-role="`${context}-scale-${propIndex}-${frame.index}`"
                @input="setScaleFromSlider(propIndex, frame.beat, $event)"
                @pointerdown="emit('sliderStart')"
                @pointerup="emit('sliderEnd')"
                @pointercancel="emit('sliderEnd')"
                @keydown="emit('sliderStart')"
                @keyup="emit('sliderEnd')"
                @blur="emit('sliderEnd')"
              />
              <ConceptStepper
                v-else
                :model-value="frame.value"
                :min="0"
                :max="1.4"
                :step="0.1"
                :label="`${column.label} Scale at beat ${formatBeat(frame.beat)}`"
                :data-role="`${context}-scale-${propIndex}-${frame.index}-stepper`"
                :display-value="frame.value.toFixed(1)"
                @update:model-value="setScaleFromStepper(propIndex, frame.beat, $event)"
              />
              <output v-if="sliders">{{ frame.value.toFixed(1) }}</output>
              <button
                type="button"
                class="pattern-property-controls__delete"
                :disabled="!frame.isSet"
                :aria-label="`Clear ${column.label} Scale at beat ${formatBeat(frame.beat)}`"
                @click="clearScale(propIndex, frame.beat)"
              >
                <BaseIcon :path="mdiTrashCanOutline" :size="18" />
              </button>
            </label>
          </section>
        </div>
      </template>
      <template v-else-if="property.key === 'axis'">
        <p
          class="pattern-property-controls__usage-note"
          :data-role="`${context}-property-axis-note`"
        >
          For Static Props, allowing off-axis turns
        </p>
        <div class="pattern-property-controls__fold-options">
          <div class="pattern-property-controls__fold-option-row">
            <fieldset class="pattern-property-controls__option-group">
              <legend class="pattern-property-controls__visually-hidden">Folds detail</legend>
              <label v-for="mode in foldModes" :key="mode">
                <input
                  type="radio"
                  :name="`${controlId}-fold-mode`"
                  :checked="foldMode === mode"
                  @change="emit('update:foldMode', mode)"
                />
                <span>{{ mode === 'simple' ? 'Simple' : 'Advanced' }}</span>
              </label>
            </fieldset>
          </div>
          <div v-if="foldMode === 'simple'" class="pattern-property-controls__fold-option-row">
            <fieldset class="pattern-property-controls__option-group">
              <legend class="pattern-property-controls__visually-hidden">Fold span</legend>
              <label v-for="span in foldSpans" :key="span">
                <input
                  type="radio"
                  :name="`${controlId}-fold-span`"
                  :checked="foldSpan === span"
                  @change="emit('update:foldSpan', span)"
                />
                <span>{{ span === 'quarter' ? 'Quarter' : 'Eighth' }}</span>
              </label>
            </fieldset>
            <fieldset class="pattern-property-controls__option-group">
              <legend class="pattern-property-controls__visually-hidden">Fold mirroring</legend>
              <label>
                <input
                  type="checkbox"
                  :checked="foldMirror"
                  aria-label="Mirror folds"
                  @change="emitFoldMirror"
                />
                <span>Mirror</span>
              </label>
            </fieldset>
          </div>
        </div>
        <div class="pattern-property-controls__twist-columns">
          <section
            v-for="(column, propIndex) in foldColumns"
            :key="column.label"
            class="pattern-property-controls__twist-column"
            :aria-label="`${column.label} Folds`"
          >
            <header class="pattern-property-controls__twist-header">
              <span>Beat</span>
              <h3>{{ foldMirror && foldMode === 'simple' ? '' : column.label }}</h3>
              <span>Value</span>
            </header>
            <div v-if="foldMode === 'simple'" class="pattern-property-controls__fold-schedule">
              <fieldset class="pattern-property-controls__option-group">
                <legend class="pattern-property-controls__visually-hidden">
                  {{ column.label }} folds repetition
                </legend>
                <label>
                  <input
                    type="checkbox"
                    :checked="foldRepeat[propIndex]"
                    @change="emitFoldRepeat(propIndex, $event)"
                  />
                  <span>Repeat</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    :checked="foldAlternate[propIndex]"
                    :disabled="!foldRepeat[propIndex]"
                    @change="emitFoldAlternate(propIndex, $event)"
                  />
                  <span>Alternate</span>
                </label>
              </fieldset>
              <div class="pattern-property-controls__fold-timing">
                <label class="pattern-property-controls__select">
                  <span>{{ foldRepeat[propIndex] ? 'Start' : 'Beat' }}</span>
                  <select
                    :value="foldBeat[propIndex]"
                    :aria-label="`${column.label} folds ${foldRepeat[propIndex] ? 'start' : 'beat'}`"
                    @change="emitFoldBeat(propIndex, $event)"
                  >
                    <option v-for="beat in foldBeatOptions" :key="beat" :value="beat">
                      {{ formatBeat(beat) }}
                    </option>
                  </select>
                </label>
                <label v-if="foldRepeat[propIndex]" class="pattern-property-controls__select">
                  <span>Every</span>
                  <select
                    :value="foldEvery[propIndex]"
                    :aria-label="`${column.label} repeat folds every`"
                    @change="emitFoldEvery(propIndex, $event)"
                  >
                    <option v-for="beat in foldEveryOptions" :key="beat" :value="beat">
                      {{ formatBeat(beat) }}
                    </option>
                  </select>
                </label>
              </div>
            </div>
            <div
              v-for="frame in column.frames"
              :key="frame.index"
              class="pattern-property-controls__fold-frame"
            >
              <span class="pattern-property-controls__beat">{{ formatBeat(frame.beat) }}</span>
              <div class="pattern-property-controls__fold-controls">
                <label
                  v-for="fold in folds"
                  :key="fold.key"
                  class="pattern-property-controls__fold-control"
                  :class="{
                    'pattern-property-controls__twist-frame--inherited':
                      frame.values[fold.key] === undefined,
                    'pattern-property-controls__value-set': frame.values[fold.key] !== undefined,
                    'pattern-property-controls__fold-control--stepper': !sliders,
                  }"
                >
                  <span>{{ fold.label }}</span>
                  <input
                    v-if="sliders"
                    type="range"
                    min="0"
                    :max="angleOptions(fold.min, fold.max).length - 1"
                    step="1"
                    :value="angleSliderIndex(frame.displayValues[fold.key], fold.min, fold.max)"
                    :aria-valuetext="`${frame.displayValues[fold.key]}°`"
                    :aria-label="`${column.label} ${fold.label} at beat ${formatBeat(frame.beat)}`"
                    @input="setFold(propIndex, frame.beat, fold.key, $event)"
                    @pointerdown="emit('sliderStart')"
                    @pointerup="emit('sliderEnd')"
                    @pointercancel="emit('sliderEnd')"
                    @keydown="emit('sliderStart')"
                    @keyup="emit('sliderEnd')"
                    @blur="emit('sliderEnd')"
                  />
                  <ConceptStepper
                    v-else
                    :model-value="frame.displayValues[fold.key]"
                    :label="`${column.label} ${fold.label} at beat ${formatBeat(frame.beat)}`"
                    :data-role="`${context}-${fold.key}-${propIndex}-${frame.index}-stepper`"
                    :min="fold.min"
                    :max="fold.max"
                    :step="90"
                    :display-value="`${frame.displayValues[fold.key]}°`"
                    @update:model-value="emitFoldValue(propIndex, frame.beat, fold.key, $event)"
                  />
                  <output v-if="sliders">{{ frame.displayValues[fold.key] }}°</output>
                  <button
                    type="button"
                    class="pattern-property-controls__delete"
                    :disabled="frame.values[fold.key] === undefined"
                    :aria-label="`Clear ${column.label} ${fold.label} at beat ${formatBeat(frame.beat)}`"
                    @click="clearFold(propIndex, frame.beat, fold.key)"
                  >
                    <BaseIcon :path="mdiTrashCanOutline" :size="18" />
                  </button>
                </label>
              </div>
            </div>
          </section>
        </div>
      </template>
      <template v-else-if="property.key === 'twist'">
        <p
          class="pattern-property-controls__usage-note"
          :data-role="`${context}-property-twist-note`"
        >
          For Roll-Sensitive Props, like Fans and Triads
        </p>
        <fieldset
          class="pattern-property-controls__option-group pattern-property-controls__twist-mode"
        >
          <legend class="pattern-property-controls__visually-hidden">Twist detail</legend>
          <label v-for="mode in twistModes" :key="mode">
            <input
              type="radio"
              :name="`${controlId}-twist-mode`"
              :value="mode"
              :checked="twistMode === mode"
              @change="emit('update:twistMode', mode)"
            />
            <span>{{ mode === 'simple' ? 'Simple' : 'Advanced' }}</span>
          </label>
        </fieldset>
        <div class="pattern-property-controls__twist-columns">
          <section
            v-for="(column, propIndex) in twistColumns"
            :key="column.label"
            class="pattern-property-controls__twist-column"
            :aria-label="`${column.label} Twist`"
          >
            <header class="pattern-property-controls__twist-header">
              <span>Beat</span>
              <h3>{{ column.label }}</h3>
              <span>Value</span>
            </header>
            <label
              v-for="frame in column.frames"
              :key="frame.index"
              class="pattern-property-controls__twist-frame"
              :class="{
                'pattern-property-controls__twist-frame--inherited': !frame.isSet,
                'pattern-property-controls__value-set': frame.isSet,
                'pattern-property-controls__twist-frame--stepper': !sliders,
              }"
            >
              <span class="pattern-property-controls__beat">{{ formatBeat(frame.beat) }}</span>
              <input
                v-if="sliders"
                type="range"
                min="0"
                :max="twistAngleOptions.length - 1"
                step="1"
                :value="angleSliderIndex(frame.value, -360, 360, allowTwistZero, 45)"
                :aria-valuetext="`${frame.value}°`"
                :aria-label="`${column.label} Twist at beat ${formatBeat(frame.beat)}`"
                :data-role="`${context}-twist-${propIndex}-${frame.index}`"
                @input="setTwist(propIndex, frame.index, $event)"
                @pointerdown="emit('sliderStart')"
                @pointerup="emit('sliderEnd')"
                @pointercancel="emit('sliderEnd')"
                @keydown="emit('sliderStart')"
                @keyup="emit('sliderEnd')"
                @blur="emit('sliderEnd')"
              />
              <ConceptStepper
                v-else
                :model-value="frame.value"
                :label="`${column.label} Twist at beat ${formatBeat(frame.beat)}`"
                :data-role="`${context}-twist-${propIndex}-${frame.index}-stepper`"
                :min="-360"
                :max="360"
                :step="45"
                :display-value="`${frame.value}°`"
                @update:model-value="emitTwistValue(propIndex, frame.beat, $event)"
              />
              <output v-if="sliders">{{ frame.value }}°</output>
              <button
                type="button"
                class="pattern-property-controls__delete"
                :disabled="!frame.isSet"
                :aria-label="`Clear ${column.label} Twist at beat ${formatBeat(frame.beat)}`"
                @click="clearTwist(propIndex, frame.index)"
              >
                <BaseIcon :path="mdiTrashCanOutline" :size="18" />
              </button>
            </label>
          </section>
        </div>
      </template>
      <template v-else-if="property.key === 'third-order'">
        <p
          class="pattern-property-controls__usage-note"
          :data-role="`${context}-property-third-order-note`"
        >
          Hand path manipulations
        </p>
        <div class="pattern-property-controls__fold-option-row">
          <fieldset class="pattern-property-controls__option-group">
            <legend class="pattern-property-controls__visually-hidden">
              Third Order mirroring
            </legend>
            <label>
              <input
                type="checkbox"
                :checked="thirdOrderMirror"
                aria-label="Mirror Third Order"
                @change="emitThirdOrderMirror"
              />
              <span>Mirror</span>
            </label>
            <label>
              <input
                type="checkbox"
                :checked="thirdOrderOpposed"
                :disabled="!thirdOrderMirror"
                aria-label="Opposed Third Order"
                @change="emitThirdOrderOpposed"
              />
              <span>Opposed</span>
            </label>
          </fieldset>
        </div>
        <div class="pattern-property-controls__twist-columns">
          <template v-for="(label, propIndex) in propLabels" :key="label">
            <section
              v-if="!thirdOrderMirror || propIndex === 0"
              class="pattern-property-controls__twist-column pattern-property-controls__third-order-column"
              :aria-label="`${label} Third Order`"
            >
              <h3>{{ label }}</h3>

              <div
                v-if="firstEditableFrameIndex === 0"
                class="pattern-property-controls__third-order-row"
                :class="{
                  'pattern-property-controls__twist-frame--inherited':
                    thirdOrderSettings[propIndex]?.initial === undefined,
                  'pattern-property-controls__value-set':
                    thirdOrderSettings[propIndex]?.initial !== undefined,
                }"
              >
                <span>Initial</span>
                <input
                  v-if="thirdOrderSettings[propIndex]?.timing !== undefined"
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  :value="thirdOrderInitialAngle(propIndex)"
                  :aria-valuetext="`${thirdOrderInitialAngle(propIndex)}°`"
                  :aria-label="`${label} Third Order Initial`"
                  :data-role="`${context}-third-order-initial-${propIndex}`"
                  @input="setThirdOrderInitialAngle(propIndex, $event)"
                  @pointerdown="emit('sliderStart')"
                  @pointerup="emit('sliderEnd')"
                  @pointercancel="emit('sliderEnd')"
                  @keydown="emit('sliderStart')"
                  @keyup="emit('sliderEnd')"
                  @blur="emit('sliderEnd')"
                />
                <select
                  v-else
                  :value="thirdOrderInitialTiming(propIndex)"
                  :aria-label="`${label} Third Order Initial`"
                  :data-role="`${context}-third-order-initial-${propIndex}`"
                  @change="setThirdOrderInitialTiming(propIndex, $event)"
                >
                  <option value="">Undefined</option>
                  <option
                    v-for="option in vtgThirdOrderTimingOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
                <output v-if="thirdOrderSettings[propIndex]?.timing !== undefined">
                  {{ thirdOrderInitialAngle(propIndex) }}°
                </output>
                <button
                  type="button"
                  class="pattern-property-controls__delete"
                  :disabled="thirdOrderSettings[propIndex]?.initial === undefined"
                  :aria-label="`Clear ${label} Third Order Initial`"
                  @click="emitThirdOrderInitial(propIndex)"
                >
                  <BaseIcon :path="mdiTrashCanOutline" :size="18" />
                </button>
              </div>

              <div
                class="pattern-property-controls__third-order-row"
                :class="{
                  'pattern-property-controls__twist-frame--inherited':
                    thirdOrderSettings[propIndex]?.strength === undefined,
                  'pattern-property-controls__value-set':
                    thirdOrderSettings[propIndex]?.strength !== undefined,
                }"
              >
                <span>Strength</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  :value="thirdOrderDisplaySettings.strength[propIndex]"
                  :aria-valuetext="`${thirdOrderDisplaySettings.strength[propIndex]}%`"
                  :aria-label="`${label} Third Order Strength`"
                  :data-role="`${context}-third-order-strength-${propIndex}`"
                  @input="setThirdOrderStrength(propIndex, $event)"
                  @pointerdown="emit('sliderStart')"
                  @pointerup="emit('sliderEnd')"
                  @pointercancel="emit('sliderEnd')"
                  @keydown="emit('sliderStart')"
                  @keyup="emit('sliderEnd')"
                  @blur="emit('sliderEnd')"
                />
                <output>{{ thirdOrderDisplaySettings.strength[propIndex] }}%</output>
                <button
                  type="button"
                  class="pattern-property-controls__delete"
                  :disabled="thirdOrderSettings[propIndex]?.strength === undefined"
                  :aria-label="`Clear ${label} Third Order Strength`"
                  @click="emitThirdOrderStrength(propIndex)"
                >
                  <BaseIcon :path="mdiTrashCanOutline" :size="18" />
                </button>
              </div>

              <div
                class="pattern-property-controls__third-order-row"
                :class="{
                  'pattern-property-controls__twist-frame--inherited':
                    thirdOrderSettings[propIndex]?.timing === undefined,
                  'pattern-property-controls__value-set':
                    thirdOrderSettings[propIndex]?.timing !== undefined,
                }"
              >
                <span>Timing</span>
                <select
                  :value="thirdOrderDisplaySettings.timing[propIndex] ?? ''"
                  :aria-label="`${label} Third Order Timing`"
                  :data-role="`${context}-third-order-timing-${propIndex}`"
                  @change="setThirdOrderTiming(propIndex, $event)"
                >
                  <option value="">Undefined</option>
                  <option
                    v-for="option in vtgThirdOrderTimingOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
                <button
                  type="button"
                  class="pattern-property-controls__delete"
                  :disabled="thirdOrderSettings[propIndex]?.timing === undefined"
                  :aria-label="`Clear ${label} Third Order Timing`"
                  @click="emitThirdOrderTiming(propIndex)"
                >
                  <BaseIcon :path="mdiTrashCanOutline" :size="18" />
                </button>
              </div>
            </section>
          </template>
        </div>
      </template>
      <p v-else>{{ propertyName(property) }} controls will go here.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { getVtgFoldRotateMaterializationFactor } from '@/features/vtg/applyVtgFoldSettings'
import { mdiTrashCanOutline } from '@mdi/js'
import { useId } from 'vue'

import BaseIcon from '@/components/icons/BaseIcon.vue'
import BaseTooltip from '@/components/ui/BaseTooltip.vue'
import ConceptStepper from '@/features/concepts/components/ConceptStepper.vue'
import type {
  VtgFoldValue,
  VtgFoldValues,
  VtgFoldMode,
  VtgFoldSideSettings,
  VtgFoldSpan,
  VtgPropertyKey,
  VtgTwistMode,
  VtgTwistValues,
} from '@/features/concepts/stores/useConceptsStore'
import type { VtgBuilderScaleMode, VtgBuilderScaleValues } from '@/features/builder/types'
import type { RootDataFinal } from '@/types/AnimTypes'
import { isTouchDevice } from '@/utils/device'
import type { VtgPatternSelection } from '@/features/vtg/types'
import {
  vtgThirdOrderTimingOptions,
  type VtgThirdOrderDisplaySettings,
  type VtgThirdOrderInitial,
  type VtgThirdOrderSettings,
  type VtgThirdOrderTiming,
} from '@/features/vtg/thirdOrder'

type PatternPropertyContext = 'vtg' | 'builder' | 'eight-step'
type PatternPropertyKey = VtgPropertyKey | 'scale'

const props = withDefaults(
  defineProps<{
    context: PatternPropertyContext
    showTurns?: boolean
    showOffset?: boolean
    animation?: RootDataFinal
    offsetValues?: VtgPatternSelection['propRotationOffsets']
    scaleMode?: VtgBuilderScaleMode
    scaleValues?: VtgBuilderScaleValues
    scaleDisplayValues?: VtgBuilderScaleValues
    twistMode?: VtgTwistMode
    twistValues?: VtgTwistValues
    twistDisplayValues?: VtgTwistValues
    thirdOrderSettings?: VtgThirdOrderSettings
    thirdOrderDisplaySettings?: VtgThirdOrderDisplaySettings
    thirdOrderMirror?: boolean
    thirdOrderOpposed?: boolean
    initialYawValues?: readonly [number, number]
    firstEditableFrameIndex?: number
    allowTwistZero?: boolean
    foldValues?: VtgFoldValues
    foldValuesMaterialized?: boolean
    sliders?: boolean
    foldMode?: VtgFoldMode
    foldBeat?: VtgFoldSideSettings<number>
    foldRepeat?: VtgFoldSideSettings<boolean>
    foldEvery?: VtgFoldSideSettings<number>
    foldAlternate?: VtgFoldSideSettings<boolean>
    foldSpan?: VtgFoldSpan
    foldMirror?: boolean
    activeProperty?: PatternPropertyKey | null
  }>(),
  {
    showTurns: false,
    showOffset: true,
    scaleMode: 'simple',
    scaleValues: () => [{}, {}],
    scaleDisplayValues: () => [{}, {}],
    twistMode: 'simple',
    twistValues: () => [{}, {}],
    twistDisplayValues: () => [{}, {}],
    thirdOrderSettings: () => [{}, {}],
    thirdOrderDisplaySettings: () => ({
      initial: [undefined, undefined],
      strength: [100, 100],
      timing: [undefined, undefined],
    }),
    thirdOrderMirror: true,
    thirdOrderOpposed: false,
    initialYawValues: () => [90, 90],
    firstEditableFrameIndex: 0,
    allowTwistZero: false,
    foldValues: () => [{}, {}],
    foldValuesMaterialized: false,
    sliders: true,
    foldMode: 'simple',
    foldBeat: () => [2, 2],
    foldRepeat: () => [true, true],
    foldEvery: () => [2, 2],
    foldAlternate: () => [false, false],
    foldSpan: 'eighth',
    foldMirror: true,
    activeProperty: null,
  },
)

const emit = defineEmits<{
  offsetUpdate: [propIndex: 0 | 1, value?: number]
  scaleUpdate: [propIndex: 0 | 1, beat: number, value?: number]
  'update:scaleMode': [mode: VtgBuilderScaleMode]
  twistUpdate: [propIndex: 0 | 1, beat: number, value?: number]
  thirdOrderInitialUpdate: [propIndex: 0 | 1, value?: VtgThirdOrderInitial]
  thirdOrderStrengthUpdate: [propIndex: 0 | 1, value?: number]
  thirdOrderTimingUpdate: [propIndex: 0 | 1, value?: VtgThirdOrderTiming]
  'update:thirdOrderMirror': [mirror: boolean]
  'update:thirdOrderOpposed': [opposed: boolean]
  'update:twistMode': [mode: VtgTwistMode]
  foldUpdate: [propIndex: 0 | 1, beat: number, fold: keyof VtgFoldValue, value?: number]
  'update:foldMode': [mode: VtgFoldMode]
  'update:foldBeat': [propIndex: 0 | 1, beat: number]
  'update:foldRepeat': [propIndex: 0 | 1, repeat: boolean]
  'update:foldEvery': [propIndex: 0 | 1, every: number]
  'update:foldAlternate': [propIndex: 0 | 1, alternate: boolean]
  'update:foldSpan': [span: VtgFoldSpan]
  'update:foldMirror': [mirror: boolean]
  'update:activeProperty': [property: PatternPropertyKey | null]
  sliderStart: []
  sliderEnd: []
}>()
const twistModes = ['simple', 'advanced'] as const
const scaleModes = ['simple', 'advanced'] as const
const foldModes = ['simple', 'advanced'] as const
const foldSpans = ['quarter', 'eighth'] as const
const propLabels = ['Left', 'Right'] as const
const folds = [
  { key: 'rotate', label: 'Rotate', min: -360, max: 360 },
  { key: 'yaw', label: 'Direct', min: -90, max: 90 },
] as const

const properties = [
  { key: 'offset', name: 'Offset', label: 'Offset' },
  { key: 'scale', name: 'Scale', label: 'Scale' },
  { key: 'axis', name: 'Rotate', label: 'Rotate' },
  { key: 'twist', name: 'Twist', label: 'Twist' },
  { key: 'turns', name: 'Turns', label: 'Turns' },
  { key: 'third-order', name: 'Third Order', label: 'Third Order' },
] as const satisfies readonly { key: PatternPropertyKey; name: string; label: string }[]

const controlId = `pattern-properties-${useId()}`
const touchDevice = typeof navigator !== 'undefined' && isTouchDevice()
const rootElement = ref<HTMLElement>()
const offsetDraftValues = ref<[string, string]>(['0', '0'])
const focusedOffsetProp = ref<0 | 1>()
const visibleProperties = computed(() =>
  properties.filter(
    (property) =>
      (property.key !== 'turns' || props.showTurns) &&
      (property.key !== 'offset' || props.showOffset) &&
      (property.key !== 'scale' || props.context === 'builder') &&
      (property.key !== 'third-order' || props.context !== 'eight-step'),
  ),
)
const propertyLabel = (property: (typeof properties)[number]) => property.label
const propertyName = (property: (typeof properties)[number]) => property.name
const propertyTooltip = (property: (typeof properties)[number]) =>
  property.key === 'axis'
    ? 'Set Direct and Rotate changes by beat for the left and right props.'
    : property.key === 'twist'
      ? 'Set twist changes by beat for roll-sensitive props.'
      : ''

const offsetValue = (propIndex: number) => props.offsetValues?.[propIndex] ?? 0
const offsetIsSet = (propIndex: number) => offsetValue(propIndex) !== 0
const offsetSliderValue = (value: number) => (value < 0 ? -90 : value > 0 ? 90 : 0)
const setOffsetFromSlider = (propIndex: number, event: Event) => {
  if (!isPropIndex(propIndex)) return
  emit('offsetUpdate', propIndex, Number((event.target as HTMLInputElement).value))
}
const setOffsetFromStepper = (propIndex: number, value: number) => {
  if (!isPropIndex(propIndex)) return
  emit('offsetUpdate', propIndex, value)
}
const focusOffset = (propIndex: number) => {
  if (!isPropIndex(propIndex)) return
  focusedOffsetProp.value = propIndex
}
const beginOffsetText = (propIndex: number) => {
  focusOffset(propIndex)
  emit('sliderStart')
}
const setOffsetFromText = (propIndex: number, event: Event) => {
  if (!isPropIndex(propIndex)) return
  const value = (event.target as HTMLInputElement).value
  offsetDraftValues.value[propIndex] = value
  if (!/^[+-]?\d+$/.test(value)) return
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < -180 || parsed > 180) return
  emit('offsetUpdate', propIndex, parsed)
}
const blurOffset = (propIndex: number) => {
  if (!isPropIndex(propIndex)) return
  focusedOffsetProp.value = undefined
  offsetDraftValues.value[propIndex] = String(offsetValue(propIndex))
}
const endOffsetText = (propIndex: number) => {
  blurOffset(propIndex)
  emit('sliderEnd')
}
const clearOffset = (propIndex: number) => {
  if (!isPropIndex(propIndex)) return
  emit('offsetUpdate', propIndex)
}

const thirdOrderInitialTiming = (propIndex: number) => {
  const value = props.thirdOrderDisplaySettings.initial[propIndex]
  return typeof value === 'string' ? value : ''
}
const thirdOrderInitialAngle = (propIndex: number) => {
  const value = props.thirdOrderDisplaySettings.initial[propIndex]
  return typeof value === 'number' ? value : 0
}
const emitThirdOrderInitial = (propIndex: number, value?: VtgThirdOrderInitial) => {
  if (!isPropIndex(propIndex)) return
  emit('thirdOrderInitialUpdate', propIndex, value)
}
const setThirdOrderInitialTiming = (propIndex: number, event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  emitThirdOrderInitial(propIndex, value === '' ? undefined : (value as VtgThirdOrderTiming))
}
const setThirdOrderInitialAngle = (propIndex: number, event: Event) => {
  emitThirdOrderInitial(propIndex, Number((event.target as HTMLInputElement).value))
}
const emitThirdOrderStrength = (propIndex: number, value?: number) => {
  if (!isPropIndex(propIndex)) return
  emit('thirdOrderStrengthUpdate', propIndex, value)
}
const setThirdOrderStrength = (propIndex: number, event: Event) => {
  emitThirdOrderStrength(propIndex, Number((event.target as HTMLInputElement).value))
}
const emitThirdOrderTiming = (propIndex: number, value?: VtgThirdOrderTiming) => {
  if (!isPropIndex(propIndex)) return
  emit('thirdOrderTimingUpdate', propIndex, value)
}
const setThirdOrderTiming = (propIndex: number, event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  emitThirdOrderTiming(propIndex, value === '' ? undefined : (value as VtgThirdOrderTiming))
}
const emitThirdOrderMirror = (event: Event) => {
  emit('update:thirdOrderMirror', (event.target as HTMLInputElement).checked)
}
const emitThirdOrderOpposed = (event: Event) => {
  if (!props.thirdOrderMirror) return
  emit('update:thirdOrderOpposed', (event.target as HTMLInputElement).checked)
}

const scaleColumns = computed(() =>
  propLabels.map((label, propIndex) => {
    const frames = props.animation?.props[propIndex]?.anim ?? []
    let beat = 0
    return {
      label,
      frames: frames
        .map((frame, index) => {
          const authoredValue = props.scaleValues[propIndex]?.[String(beat)]
          const isSet = authoredValue !== undefined
          const inheritedValue = props.scaleDisplayValues[propIndex]?.[String(beat)]
          const result = { index, beat, isSet, value: authoredValue ?? inheritedValue ?? 1 }
          beat += frame.beats ?? 0.5
          return result
        })
        .filter((frame) => frame.index >= props.firstEditableFrameIndex),
    }
  }),
)
const simpleScaleFrame = (propIndex: number) =>
  scaleColumns.value[propIndex]?.frames[0] ?? {
    index: props.firstEditableFrameIndex,
    beat: 0,
    isSet: props.scaleValues[propIndex]?.['0'] !== undefined,
    value: props.scaleValues[propIndex]?.['0'] ?? props.scaleDisplayValues[propIndex]?.['0'] ?? 1,
  }
const scaleValue = (propIndex: number) => simpleScaleFrame(propIndex).value
const scaleIsSet = (propIndex: number) => simpleScaleFrame(propIndex).isSet
const setScaleFromSlider = (propIndex: number, beat: number, event: Event) => {
  if (!isPropIndex(propIndex)) return
  emit('scaleUpdate', propIndex, beat, Number((event.target as HTMLInputElement).value))
}
const setScaleFromStepper = (propIndex: number, beat: number, value: number) => {
  if (!isPropIndex(propIndex)) return
  emit('scaleUpdate', propIndex, beat, value)
}
const clearScale = (propIndex: number, beat: number) => {
  if (!isPropIndex(propIndex)) return
  emit('scaleUpdate', propIndex, beat)
}

const twistColumns = computed(() =>
  ['Left', 'Right'].map((label, propIndex) => {
    const frames = props.animation?.props[propIndex]?.anim ?? []
    let beat = 0
    return {
      label,
      frames: frames
        .map((frame, index) => {
          const authoredValue = props.twistValues[propIndex]?.[String(beat)]
          const isSet = authoredValue !== undefined
          const inheritedValue = props.twistDisplayValues[propIndex]?.[String(beat)]
          const result = { index, beat, isSet, value: authoredValue ?? inheritedValue ?? 0 }
          beat += frame.beats ?? 0.5
          return result
        })
        .filter(
          (frame) =>
            frame.index >= props.firstEditableFrameIndex &&
            (props.twistMode === 'advanced' || frame.beat === 0.5),
        ),
    }
  }),
)
const foldColumnsUnfiltered = computed(() =>
  ['Left', 'Right'].map((label, propIndex) => {
    const frames = props.animation?.props[propIndex]?.anim ?? []
    const minimumFrameBeat = frames
      .slice(0, props.firstEditableFrameIndex)
      .reduce((total, frame) => total + (frame.beats ?? 0.5), 0)
    let beat = 0
    let inheritedYaw = props.initialYawValues[propIndex] ?? 90
    return {
      label,
      frames: frames.map((frame, index) => {
        const storedValues = props.foldValues[propIndex]?.[String(beat)] ?? {}
        const values = {
          ...storedValues,
          ...(props.foldMode === 'simple' &&
          props.foldSpan === 'quarter' &&
          props.foldValuesMaterialized &&
          storedValues.rotate !== undefined
            ? {
                rotate:
                  storedValues.rotate *
                  getVtgFoldRotateMaterializationFactor(props.foldSpan, beat, minimumFrameBeat),
              }
            : {}),
        }
        const result = {
          index,
          beat,
          values,
          displayValues: { yaw: values.yaw ?? inheritedYaw, rotate: values.rotate ?? 0 },
        }
        if (values.yaw !== undefined) inheritedYaw = values.yaw
        beat += frame.beats ?? 0.5
        return result
      }),
    }
  }),
)
const foldColumns = computed(() =>
  foldColumnsUnfiltered.value
    .filter((_, propIndex) => props.foldMode !== 'simple' || !props.foldMirror || propIndex === 0)
    .map((column, propIndex) => ({
      ...column,
      frames: column.frames.filter(
        (frame) =>
          frame.index >= props.firstEditableFrameIndex &&
          (props.foldMode === 'advanced' || frame.beat === props.foldBeat[propIndex]),
      ),
    })),
)
const availableFoldBeats = computed(() => {
  const beats = new Set<number>()
  for (const column of foldColumnsUnfiltered.value) {
    for (const frame of column.frames) {
      if (
        frame.index >= props.firstEditableFrameIndex &&
        (props.context !== 'builder' || frame.beat > 0)
      ) {
        beats.add(frame.beat)
      }
    }
  }
  return [...beats].sort((first, second) => first - second)
})
const foldBeatOptions = computed(() => availableFoldBeats.value)
const foldEveryOptions = computed(() =>
  foldBeatOptions.value.filter((beat) => beat > (props.foldSpan === 'quarter' ? 0.5 : 0)),
)

const angleOptions = (min: number, max: number, includeZero = false, increment = 90) => {
  const values: number[] = []
  for (let value = Math.ceil(min / increment) * increment; value <= max; value += increment) {
    if (includeZero || value !== 0) values.push(value)
  }
  return values
}
const twistAngleOptions = computed(() => angleOptions(-360, 360, props.allowTwistZero, 45))
const angleSliderIndex = (
  value: number,
  min: number,
  max: number,
  includeZero = false,
  increment = 90,
) => {
  const options = angleOptions(min, max, includeZero, increment)
  const exact = options.indexOf(value)
  if (exact >= 0) return exact
  return options.reduce(
    (closest, option, index) =>
      Math.abs(option - value) < Math.abs(options[closest]! - value) ? index : closest,
    0,
  )
}
const angleFromSlider = (
  event: Event,
  min: number,
  max: number,
  includeZero = false,
  increment = 90,
) => {
  const options = angleOptions(min, max, includeZero, increment)
  return options[Number((event.target as HTMLInputElement).value)] ?? options[0]!
}
const skipZero = (value: number, previous: number, increment = 90) =>
  value === 0 ? (previous < 0 ? increment : -increment) : value

const formatBeat = (beat: number) => (Number.isInteger(beat) ? String(beat) : String(beat))
const isPropIndex = (propIndex: number): propIndex is 0 | 1 => propIndex === 0 || propIndex === 1
watch(
  () => props.offsetValues,
  (values) => {
    for (const propIndex of [0, 1] as const) {
      if (focusedOffsetProp.value !== propIndex) {
        offsetDraftValues.value[propIndex] = String(values?.[propIndex] ?? 0)
      }
    }
  },
  { immediate: true },
)
const emitFoldRepeat = (propIndex: number, event: Event) => {
  if (!isPropIndex(propIndex)) return
  emit('update:foldRepeat', propIndex, (event.target as HTMLInputElement).checked)
}
const emitFoldAlternate = (propIndex: number, event: Event) => {
  if (!isPropIndex(propIndex)) return
  emit('update:foldAlternate', propIndex, (event.target as HTMLInputElement).checked)
}
const emitFoldBeat = (propIndex: number, event: Event) => {
  if (!isPropIndex(propIndex)) return
  emit('update:foldBeat', propIndex, Number((event.target as HTMLSelectElement).value))
}
const emitFoldEvery = (propIndex: number, event: Event) => {
  if (!isPropIndex(propIndex)) return
  emit('update:foldEvery', propIndex, Number((event.target as HTMLSelectElement).value))
}
const emitFoldMirror = (event: Event) => {
  emit('update:foldMirror', (event.target as HTMLInputElement).checked)
}

const setTwist = (propIndex: number, frameIndex: number, event: Event) => {
  const frame = twistColumns.value[propIndex]?.frames.find(
    (candidate) => candidate.index === frameIndex,
  )
  if (!frame || (propIndex !== 0 && propIndex !== 1)) return
  emit(
    'twistUpdate',
    propIndex,
    frame.beat,
    angleFromSlider(event, -360, 360, props.allowTwistZero, 45),
  )
}
const emitTwistValue = (propIndex: number, beat: number, value: number) => {
  if (propIndex !== 0 && propIndex !== 1) return
  const previous =
    twistColumns.value[propIndex]?.frames.find((frame) => frame.beat === beat)?.value ?? 0
  emit('twistUpdate', propIndex, beat, props.allowTwistZero ? value : skipZero(value, previous, 45))
}

const clearTwist = (propIndex: number, frameIndex: number) => {
  const frame = twistColumns.value[propIndex]?.frames.find(
    (candidate) => candidate.index === frameIndex,
  )
  if (!frame || (propIndex !== 0 && propIndex !== 1)) return
  emit('twistUpdate', propIndex, frame.beat)
}

const setFold = (propIndex: number, beat: number, fold: keyof VtgFoldValue, event: Event) => {
  if (propIndex !== 0 && propIndex !== 1) return
  const limits = folds.find(({ key }) => key === fold)
  if (!limits) return
  emit('foldUpdate', propIndex, beat, fold, angleFromSlider(event, limits.min, limits.max))
}
const emitFoldValue = (
  propIndex: number,
  beat: number,
  fold: keyof VtgFoldValue,
  value: number,
) => {
  if (propIndex !== 0 && propIndex !== 1) return
  const previous =
    foldColumns.value[propIndex]?.frames.find((frame) => frame.beat === beat)?.displayValues[
      fold
    ] ?? 0
  emit('foldUpdate', propIndex, beat, fold, skipZero(value, previous))
}

const clearFold = (propIndex: number, beat: number, fold: keyof VtgFoldValue) => {
  if (propIndex !== 0 && propIndex !== 1) return
  emit('foldUpdate', propIndex, beat, fold)
}

const toggleProperty = (property: PatternPropertyKey) => {
  emit('update:activeProperty', props.activeProperty === property ? null : property)
}

const collapseFromTabRow = (event: MouseEvent) => {
  if ((event.target as Element).closest('[role="tab"]')) return
  emit('update:activeProperty', null)
}

const revealOpenedProperty = async (property: PatternPropertyKey | null) => {
  if (
    property !== 'offset' &&
    property !== 'scale' &&
    property !== 'axis' &&
    property !== 'twist' &&
    property !== 'third-order'
  )
    return
  await nextTick()
  const root = rootElement.value
  const target = root?.querySelector<HTMLElement>(
    `[data-role="${props.context}-property-${property}-toggle"]`,
  )
  if (!root || !target) return

  let scrollParent: HTMLElement | null = root.parentElement
  while (scrollParent) {
    const style = getComputedStyle(scrollParent)
    if (/(auto|scroll)/.test(style.overflowY)) break
    scrollParent = scrollParent.parentElement
  }
  if (!scrollParent) return

  const parentRect = scrollParent.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  if (targetRect.top >= parentRect.top && targetRect.top <= parentRect.bottom) return
  scrollParent.scrollTo({
    top: scrollParent.scrollTop + targetRect.top - parentRect.top,
    behavior: 'auto',
  })
}
watch(() => props.activeProperty, revealOpenedProperty)
</script>

<style scoped>
.pattern-property-controls {
  box-sizing: border-box;
  width: min(calc(100% - var(--space-2)), 68rem);
  min-width: var(--size-concept-content-min-width);
  margin: var(--space-1) auto 0;
  overflow: hidden;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  container-type: inline-size;
}

.pattern-property-controls__tabs {
  display: flex;
  padding: var(--space-1);
  color: var(--color-action-primary);
  font-size: 0.8125rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  background: color-mix(in srgb, var(--color-action-primary) 7%, var(--color-surface));
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-1);
}

.pattern-property-controls__toggle:focus-visible,
.pattern-property-controls__collapse:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: -2px;
}

.pattern-property-controls__toggle {
  width: auto;
  padding: var(--space-2) var(--space-3);
  color: var(--color-action-primary);
  font-size: 0.8125rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-align: start;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.pattern-property-controls__property-tooltip {
  display: flex;
  width: auto;
}

.pattern-property-controls__toggle:hover {
  background: color-mix(in srgb, var(--color-action-primary) 13%, var(--color-surface));
}

.pattern-property-controls__toggle[aria-expanded='true'] {
  color: var(--color-action-primary);
  background: color-mix(in srgb, var(--color-action-primary) 13%, var(--color-surface));
}

.pattern-property-controls__collapse {
  padding: var(--space-2) var(--space-3);
  margin-inline-start: auto;
  color: var(--color-action-primary);
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
}

.pattern-property-controls__collapse:hover {
  background: color-mix(in srgb, var(--color-action-primary) 13%, var(--color-surface));
}

.pattern-property-controls__panel {
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-muted);
  border-block-start: 1px solid var(--color-border);
}

.pattern-property-controls__panel p {
  margin: 0;
}

.pattern-property-controls__panel .pattern-property-controls__usage-note {
  margin-block-end: var(--space-2);
  font-size: 0.8125rem;
  font-weight: 700;
  text-align: center;
}

.pattern-property-controls__twist-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.pattern-property-controls__offset-column {
  display: grid;
  gap: var(--space-2);
}

.pattern-property-controls__offset-heading {
  margin: 0;
  color: var(--color-text);
  font-size: 0.875rem;
  text-align: center;
}

.pattern-property-controls__offset-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 4.5rem 2rem;
  min-height: 2rem;
  align-items: center;
  gap: var(--space-2);
}

.pattern-property-controls__offset-controls--stepper {
  grid-template-columns: minmax(7.5rem, 1fr) 4.5rem 2rem;
}

.pattern-property-controls__offset-controls input[type='range'],
.pattern-property-controls__twist-frame input[type='range'],
.pattern-property-controls__fold-control input[type='range'] {
  width: 100%;
  min-width: 0;
  accent-color: var(--color-action-primary);
}

.pattern-property-controls__offset-input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: var(--space-1) var(--space-2);
  color: var(--color-text);
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: end;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.pattern-property-controls__offset-input:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.pattern-property-controls__offset-controls--set .pattern-property-controls__delete {
  color: var(--color-property-value-defined);
}

.pattern-property-controls__fold-options {
  display: grid;
  margin: 0 0 var(--space-3);
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--space-2);
}

.pattern-property-controls__fold-option-row {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
}

.pattern-property-controls__option-group.pattern-property-controls__twist-mode {
  margin: 0 0 var(--space-3);
  justify-content: center;
}

.pattern-property-controls__option-group {
  display: grid;
  grid-auto-columns: max-content;
  grid-auto-flow: column;
  padding: 0;
  margin: 0;
  border: 0;
  gap: var(--space-1);
}

.pattern-property-controls__option-group label {
  position: relative;
  cursor: pointer;
}

.pattern-property-controls__option-group input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.pattern-property-controls__option-group label > span {
  display: grid;
  padding-block: var(--space-1);
  padding-inline: var(--space-concept-control-inline);
  color: var(--color-text);
  font-size: var(--font-size-concept-control);
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  place-items: center;
}

.pattern-property-controls__option-group input:checked + span {
  color: var(--color-action-primary);
  background: color-mix(in srgb, var(--color-action-primary) 12%, var(--color-surface));
  border-color: var(--color-action-primary);
}

.pattern-property-controls__option-group input:disabled + span {
  color: var(--color-text-muted);
  cursor: not-allowed;
  opacity: 0.5;
}

.pattern-property-controls__option-group input:focus-visible + span,
.pattern-property-controls__select select:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.pattern-property-controls__select {
  display: inline-flex;
  color: var(--color-text-muted);
  font-size: var(--font-size-concept-control);
  align-items: center;
  gap: var(--space-1);
}

.pattern-property-controls__select select {
  padding: var(--space-1) var(--space-2);
  color: var(--color-text);
  font-weight: 700;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.pattern-property-controls__visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
}

.pattern-property-controls__twist-column {
  min-width: 0;
  padding-inline: var(--space-3);
}

.pattern-property-controls__twist-column + .pattern-property-controls__twist-column {
  border-inline-start: 1px solid var(--color-border);
}

.pattern-property-controls__third-order-column > h3 {
  margin: 0 0 var(--space-2);
  color: var(--color-text);
  font-size: 0.875rem;
  text-align: center;
}

.pattern-property-controls__third-order-row {
  display: grid;
  grid-template-columns: 4.25rem minmax(0, 1fr) 3.25rem 2rem;
  min-height: 2.25rem;
  color: var(--color-text);
  align-items: center;
  gap: var(--space-1);
}

.pattern-property-controls__third-order-row + .pattern-property-controls__third-order-row {
  border-block-start: 1px solid var(--color-border);
}

.pattern-property-controls__third-order-row input[type='range'] {
  width: 100%;
  min-width: 0;
  accent-color: var(--color-action-primary);
}

.pattern-property-controls__third-order-row select {
  grid-column: 2 / 4;
  min-width: 0;
  padding: var(--space-1) var(--space-2);
  color: var(--color-text);
  font-weight: 700;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.pattern-property-controls__third-order-row select:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.pattern-property-controls__third-order-row output {
  font-size: 0.75rem;
  text-align: end;
  white-space: nowrap;
}

.pattern-property-controls__fold-schedule {
  display: grid;
  margin-block-end: var(--space-3);
  justify-items: center;
  gap: var(--space-2);
}

.pattern-property-controls__fold-timing {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
}

.pattern-property-controls__twist-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  margin-block-end: var(--space-2);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  align-items: center;
}

.pattern-property-controls__twist-header h3 {
  margin: 0;
  color: var(--color-text);
  font-size: 0.875rem;
  text-align: center;
}

.pattern-property-controls__twist-header span:last-child {
  text-align: end;
}

.pattern-property-controls__twist-frame {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr) 3.25rem 2rem;
  min-height: 2rem;
  color: var(--color-text);
  align-items: center;
  gap: var(--space-1);
}

.pattern-property-controls__twist-frame + .pattern-property-controls__twist-frame {
  border-block-start: 1px solid var(--color-border);
}

.pattern-property-controls__fold-frame {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr);
  padding-block: var(--space-1);
  align-items: center;
  gap: var(--space-1);
}

.pattern-property-controls__fold-frame + .pattern-property-controls__fold-frame {
  border-block-start: 1px solid var(--color-border);
}

.pattern-property-controls__fold-control {
  display: grid;
  grid-template-columns: 3.25rem minmax(0, 1fr) 3.25rem 2rem;
  min-height: 2rem;
  align-items: center;
  gap: var(--space-1);
}

.pattern-property-controls__fold-control output {
  font-size: 0.75rem;
  text-align: end;
}

.pattern-property-controls__fold-control--stepper {
  grid-template-columns: 3.25rem minmax(7.5rem, 1fr) 2rem;
}

.pattern-property-controls__twist-frame--stepper {
  grid-template-columns: 2.25rem minmax(7.5rem, 1fr) 2rem;
}

.pattern-property-controls__twist-frame--inherited {
  color: var(--color-text-muted);
}

.pattern-property-controls__twist-frame--inherited input[type='range'] {
  opacity: 0.55;
}

.pattern-property-controls__value-set {
  --concept-stepper-value-color: var(--color-property-value-defined);
}

.pattern-property-controls__value-set > output {
  color: var(--color-property-value-defined);
}

.pattern-property-controls__beat {
  font-variant-numeric: tabular-nums;
}

.pattern-property-controls__twist-frame output {
  font-size: 0.75rem;
  text-align: end;
  white-space: nowrap;
}

.pattern-property-controls__delete {
  display: inline-grid;
  padding: var(--space-1);
  color: var(--color-text-muted);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  place-items: center;
}

.pattern-property-controls__delete:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.pattern-property-controls__delete:not(:disabled):hover {
  color: var(--color-action-primary);
}

@container (max-width: 36rem) {
  .pattern-property-controls__twist-columns {
    grid-template-columns: 1fr;
  }

  .pattern-property-controls__twist-column + .pattern-property-controls__twist-column {
    margin-block-start: var(--space-2);
    padding-block-start: var(--space-3);
    border-block-start: 1px solid var(--color-border);
    border-inline-start: 0;
  }
}

@container (max-width: 22rem) {
  .pattern-property-controls__twist-column {
    padding-inline: var(--space-1);
  }

  .pattern-property-controls__twist-frame {
    grid-template-columns: 2rem minmax(0, 1fr) 3rem 1.75rem;
  }
}
</style>
