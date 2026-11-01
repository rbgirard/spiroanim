import type { AllVars, MotionData } from '@/types/AnimTypes'
import type { VDefEntry } from '@/services/query/types/BaseQSTypes'
import type { ConfigData } from '@/services/query/types/SpiroAnimQSTypes'

export const CURRENT_SPIRO_ANIM_QS_VERSION = 12

export interface SpiroAnimQSVersion {
  CHARSET: string
  VDEF: Record<AllVars, VDefEntry>
  createRootConfig(): ConfigData<AllVars>
  createPropConfig(): ConfigData<AllVars>
  createExtendedAnimationConfig?(): ConfigData<AllVars>
  createRotationAnimationConfig?(): ConfigData<AllVars>
  createMotionConfig?(): ConfigData<AllVars>
  createCameraConfig?(): ConfigData<AllVars>
  encodeMotionFrame?(frame: MotionData): MotionData
  decodeMotionFrame?(frame: MotionData): MotionData
  omitStandaloneMotionPrefix?: boolean
  omitEmptyCameraCenter?: boolean
}

export class UnsupportedSpiroAnimQSVersionError extends RangeError {
  readonly version: number

  constructor(version: number) {
    super(`Unsupported SpiroAnim query-string version: ${version}`)
    this.name = 'UnsupportedSpiroAnimQSVersionError'
    this.version = version
  }
}

/**
 * Explicit version loading keeps supported formats discoverable by Vite while retaining the legacy
 * contract that older shared URLs can select their matching decoder.
 */
export async function loadSpiroAnimQSVersion(version: number): Promise<SpiroAnimQSVersion> {
  switch (version) {
    case 1:
      return import('@/services/query/versions/SpiroAnimQSv1')
    case 2:
      return import('@/services/query/versions/SpiroAnimQSv2')
    case 3:
      return import('@/services/query/versions/SpiroAnimQSv3')
    case 4:
      return import('@/services/query/versions/SpiroAnimQSv4')
    case 5:
      return import('@/services/query/versions/SpiroAnimQSv5')
    case 6:
      return import('@/services/query/versions/SpiroAnimQSv6')
    case 7:
      return import('@/services/query/versions/SpiroAnimQSv7')
    case 8:
      return import('@/services/query/versions/SpiroAnimQSv8')
    case 9:
      return import('@/services/query/versions/SpiroAnimQSv9')
    case 10:
      return import('@/services/query/versions/SpiroAnimQSv10')
    case 11:
      return import('@/services/query/versions/SpiroAnimQSv11')
    case 12:
      return import('@/services/query/versions/SpiroAnimQSv12')
    default:
      throw new UnsupportedSpiroAnimQSVersionError(version)
  }
}
