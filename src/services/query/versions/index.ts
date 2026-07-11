import type { AllVars } from '@/types/AnimTypes'
import type { VDefEntry } from '@/services/query/types/BaseQSTypes'
import type { ConfigData } from '@/services/query/types/SpiroAnimQSTypes'

export interface SpiroAnimQSVersion {
  VDEF: Record<AllVars, VDefEntry>
  createRootConfig(): ConfigData<AllVars>
  createPropConfig(): ConfigData<AllVars>
}

/**
 * Explicit version loading keeps supported formats discoverable by Vite while retaining the legacy
 * contract that older shared URLs can select their matching decoder.
 */
export async function loadSpiroAnimQSVersion(version: number): Promise<SpiroAnimQSVersion> {
  switch (version) {
    case 1:
      return import('@/services/query/versions/SpiroAnimQSv1')
    default:
      throw new RangeError(`Unsupported SpiroAnim query-string version: ${version}`)
  }
}
