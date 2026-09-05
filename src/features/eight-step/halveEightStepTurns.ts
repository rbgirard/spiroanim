import type { RootDataFinal } from '@/types/AnimTypes'

/** Halves authored Eight Step Turns while preserving inheritance and canonical positive zero. */
export const halveEightStepTurns = (animation: RootDataFinal): RootDataFinal => ({
  ...animation,
  props: animation.props.map((prop) => ({
    ...prop,
    anim: prop.anim.map((frame) =>
      frame.turns === undefined
        ? frame
        : { ...frame, turns: frame.turns === 0 ? 0 : frame.turns / 2 },
    ),
  })),
})
