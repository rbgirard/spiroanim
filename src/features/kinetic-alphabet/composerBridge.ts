/**
 * Cell-identity bridge into the Flow Arts Composer.
 *
 * The Composer resolves a catalog cell from a key:
 * `<concept>.<reference>.<ratio>.<shape>.<variant>[.o<degrees>]`, all lowercase. `x` replaces the
 * `:` in a speed ratio because a colon is not safe in a path segment. Eight Step has no
 * speed-ratio axis, so its key always carries `1x1`. The optional `o<degrees>` field carries the
 * pattern orientation the viewer is looking at, so the Composer renders the same view rather than
 * its own default; Eight Step has no orientation axis and never emits it. The Composer ignores
 * unrecognised dot-separated fields beyond the fifth, which keeps older SpiroAnim builds working
 * if the grammar ever grows.
 */

export type ComposerConcept = 'vtg' | 'qtr' | '8stp'

/**
 * Speed ratios the Composer's transcription covers: every picker ratio except 2:1, whose prop
 * turns 45° per 90° hand arc and has no Kinetic Alphabet reading.
 */
export type ComposerSpeedRatio = '1:1' | '1:2' | '1:3' | '1:4' | '1:5' | '2:3' | '2:5'

/** Pattern orientations the Composer's key grammar accepts. */
export const composerPatternOrientations = [-90, -45, 0, 45, 90, 180] as const

export type ComposerPatternOrientation = (typeof composerPatternOrientations)[number]

export interface ComposerCell {
  concept: ComposerConcept
  /** Catalog reference such as `1-1` or `1-AA`. Lowercased into the key. */
  reference: string
  /** Absent for Eight Step, which has no speed-ratio axis. */
  speedRatio?: ComposerSpeedRatio
  shape?: 'diamond' | 'box'
  isAnti?: boolean
  /**
   * The pattern orientation currently displayed. Emitted for vtg/qtr so the Composer shows the
   * flower the viewer is looking at; ignored for Eight Step, which has no orientation axis. A
   * key without the field means "the SpiroAnim default view" on the Composer side, so senders
   * should pass the displayed orientation even when it equals the default.
   */
  orientation?: ComposerPatternOrientation
}

const COMPOSER_ORIGIN = 'https://tkaflowarts.com'

export const composerSpeedRatios = [
  '1:1',
  '1:2',
  '1:3',
  '1:4',
  '1:5',
  '2:3',
  '2:5',
] as const satisfies readonly ComposerSpeedRatio[]

export const isComposerSpeedRatio = (value: string): value is ComposerSpeedRatio =>
  (composerSpeedRatios as readonly string[]).includes(value)

export const isComposerPatternOrientation = (value: number): value is ComposerPatternOrientation =>
  (composerPatternOrientations as readonly number[]).includes(value)

export const buildComposerUrl = (cell: ComposerCell): string => {
  const ratio = cell.concept === '8stp' ? '1x1' : (cell.speedRatio ?? '1:1').replace(':', 'x')
  const fields = [
    cell.concept,
    cell.reference.toLowerCase(),
    ratio,
    cell.shape ?? 'diamond',
    cell.isAnti ? 'anti' : 'base',
  ]
  if (cell.concept !== '8stp' && cell.orientation !== undefined) {
    fields.push(`o${cell.orientation}`)
  }
  return `${COMPOSER_ORIGIN}/from/spiroanim/${fields.join('.')}`
}
