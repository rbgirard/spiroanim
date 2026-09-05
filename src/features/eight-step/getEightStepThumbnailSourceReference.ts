import type {
  EightStepCellReference,
  EightStepColumn,
  EightStepRow,
} from '@/features/eight-step/types'

const halvedSourceColumnsByRow: Readonly<Record<EightStepRow, readonly EightStepColumn[]>> = {
  AA: [1, 1, 1, 1, 1, 1, 1, 1],
  AE: [1, 1, 1, 1, 1, 1, 1, 1],
  AI: [1, 2, 1, 2, 2, 2, 2, 2],
  EA: [1, 1, 1, 1, 5, 5, 5, 5],
  EE: [1, 1, 1, 1, 5, 5, 5, 5],
  EI: [1, 2, 1, 2, 5, 5, 5, 5],
  IA: [1, 2, 2, 1, 1, 1, 2, 2],
  IE: [1, 2, 2, 1, 1, 1, 2, 2],
  II: [1, 2, 3, 4, 5, 6, 7, 8],
}

export const getEightStepThumbnailSourceReference = (
  reference: EightStepCellReference,
  halve: boolean,
): EightStepCellReference => {
  const [columnText, row] = reference.split('-') as [`${EightStepColumn}`, EightStepRow]
  if (!halve) return `1-${row}`

  const column = Number(columnText) as EightStepColumn
  const sourceColumn = halvedSourceColumnsByRow[row][column - 1] ?? column
  return `${sourceColumn}-${row}`
}
