import { selectVtgBuilderJunctionMotion } from '@/features/builder/selectVtgBuilderJunctionPlane'
import { rootCompile } from '@/math/animation/AnimFunc'
import { compactAnimationFrames } from '@/math/animation/compressFrames'
import type { VtgBuilderMotion } from '@/features/builder/describeVtgBuilderMotion'
import type { AnimData, RootDataFinal } from '@/types/AnimTypes'

/**
 * Rejoins an authored Builder suffix after a changed prefix. Inherited scalar values are
 * materialized at the new junction, then omitted wherever inheritance produces the same compiled
 * result. Plane and Axis directions are solved together so both the Anti/In spins and
 * Same/Opposite relationships remain unchanged.
 */
export const rejoinVtgBuilderJunction = (
  candidate: RootDataFinal,
  candidateStartFrameIndex: number,
  following: RootDataFinal,
  followingStartFrameIndex: number,
  expectedMotion: VtgBuilderMotion,
): RootDataFinal | undefined => {
  const followingTargetFrameIndex = followingStartFrameIndex + 1
  const compiledFollowing = rootCompile(following)
  const props: RootDataFinal['props'] = []

  for (const [propIndex, prop] of candidate.props.entries()) {
    const followingProp = following.props[propIndex]
    const relationship = followingProp?.anim[followingTargetFrameIndex]
    const compiledRelationship = compiledFollowing.props[propIndex]?.anim[followingTargetFrameIndex]
    if (!followingProp || !relationship || !compiledRelationship) return undefined

    const materializedRelationship: AnimData = {
      ...relationship,
      turns: compiledRelationship.turns,
      beats: compiledRelationship.beats,
      scale: compiledRelationship.scale,
      warp: compiledRelationship.warp,
      strength: compiledRelationship.strength,
      depth: compiledRelationship.depth,
      type: compiledRelationship.type,
      adjust: compiledRelationship.adjust,
      arc: compiledRelationship.arc,
      plane: compiledRelationship.plane,
    }
    props.push({
      ...prop,
      anim: [
        ...prop.anim.slice(0, candidateStartFrameIndex + 1).map((frame) => ({ ...frame })),
        materializedRelationship,
        ...followingProp.anim.slice(followingTargetFrameIndex + 1).map((frame) => ({ ...frame })),
      ],
    })
  }

  const relationshipFrameIndex = candidateStartFrameIndex + 1
  const aligned = selectVtgBuilderJunctionMotion(
    { ...candidate, props },
    relationshipFrameIndex,
    expectedMotion,
  )
  if (!aligned) return undefined

  return {
    ...aligned,
    props: aligned.props.map((prop) => ({
      ...prop,
      anim: compactAnimationFrames(prop.anim, {
        preserve: (frameIndex, key) => frameIndex !== relationshipFrameIndex || key === 'turns',
      }),
    })),
  }
}
