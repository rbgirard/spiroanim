// --- Aspect Ratio Utilities (Composable) ---
// Sloppily slapped together with AI, so likely needs more work... One day.

// Result structure returned by getAspectLabelData
export interface AspectRatioLabel {
  str: string // Full label: "21:9 (2.389) [7:3]" or "16:9 (1.778)"
  level: 0 | 1 | 2 | 3 // 0 = exact, 1 = near, 2 = approx, 3 = unmatched
  ratio: number // Decimal width / height
  reduced: string // Simplified string ratio like "16:9"
  match?: string // Matching standard label (e.g. "21:9")
  nearby?: string[] // List of nearby standard ratios (for level 1)
  approx?: string // Approximate fallback ratio (for level 2)
}

// Color and confidence information for each match level
export const aspectRatioLevelMap: Record<
  0 | 1 | 2 | 3,
  {
    label: string
    color: string
    confidence: string
  }
> = {
  0: {
    label: 'Exact Match',
    color: 'var(--color-aspect-exact)', // Theme-aware green
    confidence: 'Perfect',
  },
  1: {
    label: 'Near Standard',
    color: 'var(--color-aspect-near)', // Theme-aware goldenrod
    confidence: 'High',
  },
  2: {
    label: 'Approximate',
    color: 'var(--color-aspect-approximate)', // Theme-aware orange-brown
    confidence: 'Medium',
  },
  3: {
    label: 'Unmatched',
    color: 'var(--color-aspect-unmatched)', // Theme-aware error red
    confidence: 'Low',
  },
}

// Horizontal aspect ratios
export const HORIZONTAL_ASPECT_RATIOS: Record<string, number> = {
  '5:4': 5 / 4,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '16:10': 16 / 10,
  '16:9': 16 / 9,
  '18:9': 18 / 9,
  '20:9': 20 / 9,
  '21:9': 21 / 9,
  '32:9': 32 / 9,
  '1:1': 1,
}

// Vertical aspect ratios
export const VERTICAL_ASPECT_RATIOS: Record<string, number> = {
  '4:5': 4 / 5,
  '3:4': 3 / 4,
  '2:3': 2 / 3,
  '10:16': 10 / 16,
  '9:16': 9 / 16,
  '9:18': 9 / 18,
  '9:20': 9 / 20,
  '9:21': 9 / 21,
  '9:32': 9 / 32,
  // no '1:1' here since it's in horizontal
}

// Merge both for convenience
export const COMMON_ASPECT_RATIOS: Record<string, number> = {
  ...HORIZONTAL_ASPECT_RATIOS,
  ...VERTICAL_ASPECT_RATIOS,
}

//console.log(COMMON_ASPECT_RATIOS)

// Horizontal aspect ratio descriptions
export const HORIZONTAL_ASPECT_DESCRIPTIONS: Record<string, string> = {
  '5:4': 'Old square LCDs (1280×1024)',
  '4:3': 'Old standard (CRT, early digital cameras)',
  '3:2': 'DSLR photography, some tablets',
  '16:10': 'Widescreen (16:10), common in older laptops',
  '16:9': 'Widescreen HD (TV, most monitors, YouTube)',
  '18:9': 'Mobile screen ratio (2:1), tall phones',
  '20:9': 'Modern phone screens (very tall)',
  '21:9': 'Ultrawide monitors, cinematic film',
  '32:9': 'Super ultrawide monitors (dual-screen width)',
  '1:1': 'Square (Instagram, profile photos)',
}

// Vertical aspect ratio descriptions
export const VERTICAL_ASPECT_DESCRIPTIONS: Record<string, string> = {
  '4:5': 'Portrait-friendly social media posts',
  '3:4': 'Classic portrait monitors',
  '2:3': 'Vertical DSLR photography',
  '10:16': 'Vertical widescreen (16:10)',
  '9:16': 'Vertical HD (TikTok, Instagram Reels)',
  '9:18': 'Mobile screen ratio (2:1), tall phones',
  '9:20': 'Modern phone screens (very tall)',
  '9:21': 'Vertical cinematic-style aspect',
  '9:32': 'Super tall vertical format (creative uses)',
}

// Optional tooltip/label text for each standard ratio
export const ASPECT_RATIO_DESCRIPTIONS: Record<string, string> = {
  ...HORIZONTAL_ASPECT_DESCRIPTIONS,
  ...VERTICAL_ASPECT_DESCRIPTIONS,
}

// --- Utility to compute Greatest Common Divisor (Euclidean algorithm) ---
// Used to simplify ratios like 3440:1440 into lowest terms (e.g., 43:18)
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

// --- Simplify width/height to lowest aspect ratio string ---
// Example: getAspectRatioString(3440, 1440) → "43:18"
function getAspectRatioString(width: number, height: number): string {
  const divisor = gcd(width, height)
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`
}

// --- Find all common aspect ratios that are within a margin of error ---
// Used to detect if a resolution is "near" a known standard (e.g., 43:18 ≈ 21:9)
function findNearbyAspects(width: number, height: number, tolerance = 0.03): string[] {
  const actual = width / height
  const matches: string[] = []
  for (const [label, ratio] of Object.entries(COMMON_ASPECT_RATIOS)) {
    const diff = Math.abs(actual - ratio)
    if (diff / ratio <= tolerance) {
      matches.push(label)
    }
  }
  return matches
}

// --- Brute-force approximation of a decimal ratio to a simplified fraction ---
// Used when no near match is found. Tries to find a clean fraction like 3:2 for 1.5
function approximateRatio(value: number, maxDenominator = 50): [number, number] {
  let bestNumerator = 1
  let bestDenominator = 1
  let minError = Math.abs(value - bestNumerator / bestDenominator)

  for (let denominator = 1; denominator <= maxDenominator; denominator++) {
    const numerator = Math.round(value * denominator)
    const error = Math.abs(value - numerator / denominator)
    if (error < minError) {
      bestNumerator = numerator
      bestDenominator = denominator
      minError = error
    }
    if (error < 1e-4) break // early exit if error is good enough
  }

  const divisor = gcd(bestNumerator, bestDenominator)
  return [Math.round(bestNumerator / divisor), Math.round(bestDenominator / divisor)]
}

// --- Generate full aspect ratio label metadata from width/height ---
// Determines how closely the resolution matches standard ratios (exact, near, or approximate)
export function getAspectLabelData(width: number, height: number): AspectRatioLabel {
  const ratio = width / height
  const reduced = getAspectRatioString(width, height) // e.g., 43:18
  const decimal = ratio.toFixed(3) // e.g., 2.389

  let level: 0 | 1 | 2 | 3 = 3 // Default: unmatched
  let str = `${reduced} (${decimal})`
  let nearby: string[] | undefined = undefined
  let approx: string | undefined = undefined
  let match: string | undefined = undefined

  // Look for an exact match in the known list (within 1% tolerance)
  const exactEntry = Object.entries(COMMON_ASPECT_RATIOS).find(
    ([, val]) => Math.abs(val - ratio) < 0.01,
  )

  if (exactEntry) {
    match = exactEntry[0]
    level = 0
    str = `${match} (${decimal})${match !== reduced ? ` [${reduced}]` : ''}`
  } else {
    const rawNearby = findNearbyAspects(width, height)
    if (rawNearby.length > 0) {
      nearby = rawNearby
      level = 1
      str += ` ≈ ${rawNearby.join(', ')}`
    } else {
      const [n, d] = approximateRatio(ratio, 50)
      const approxCandidate = `${n}:${d}`
      if (approxCandidate !== reduced) {
        approx = approxCandidate
        level = 2
        str += ` ≈ ${approx}`
      } else {
        level = 3 // fallback: nothing close or approximate found
      }
    }
  }

  return {
    str, // Full formatted label (e.g., "21:9 (2.333) [43:18]")
    level, // Confidence level
    ratio, // Actual decimal ratio
    reduced, // Reduced string (e.g., 43:18)
    match, // Optional: matched known label (e.g., "21:9")
    nearby, // Optional: other close ratios
    approx, // Optional: fallback approximation
  }
}

// --- Vue composable to track and annotate aspect ratio from reactive width/height ---
export function useAspectRatio(width: Ref<number>, height: Ref<number>) {
  // Live calculation of label data
  const data = computed(() => getAspectLabelData(width.value, height.value))

  // Style info based on confidence level
  const color = computed(() => aspectRatioLevelMap[data.value.level].color)
  const label = computed(() => aspectRatioLevelMap[data.value.level].label)
  const confidence = computed(() => aspectRatioLevelMap[data.value.level].confidence)

  // Provide a human-readable description if known (e.g., "Ultrawide monitor")
  const description = computed(() => {
    const key = data.value.match ?? data.value.nearby?.[0] ?? data.value.reduced
    return ASPECT_RATIO_DESCRIPTIONS[key] || `${key} aspect ratio`
  })

  return {
    data, // Full AspectRatioLabel metadata
    color, // CSS-friendly color based on match level
    label, // "Exact Match", "Near Standard", etc.
    confidence, // "perfect", "high", etc.
    description, // e.g., "Widescreen HD (TV, most monitors, YouTube)"
  }
}
