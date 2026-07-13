// src\stores\panes\useSplitterStore.ts

export const useSplitterStore = <L extends string = 'left', R extends string = 'right'>(
  id: string,
  leftStr: L = 'left' as L,
  rightStr: R = 'right' as R,
) => {
  return defineStore(
    `sa-splitter-${id}`,
    () => {
      const perc = ref(50)
      const leftElement = ref<HTMLElementUndef>(null)
      const rightElement = ref<HTMLElementUndef>(null)

      const { width: leftWidth, height: leftHeight } = useElementSize(leftElement)
      const { width: rightWidth, height: rightHeight } = useElementSize(rightElement)

      const trackElements = (eLeft: HTMLElementUndef, eRight: HTMLElementUndef) => {
        leftElement.value = eLeft
        rightElement.value = eRight
      }

      const dynamicReturn = {
        trackElements,
        [`${leftStr}Perc`]: perc,
        [`${leftStr}Width`]: readonly(leftWidth),
        [`${leftStr}Height`]: readonly(leftHeight),
        [`${rightStr}Width`]: readonly(rightWidth),
        [`${rightStr}Height`]: readonly(rightHeight),
      }

      return dynamicReturn as {
        trackElements: typeof trackElements
      } & {
        [K in `${L}Perc`]: Ref<number>
      } & {
        [K in `${L | R}${'Width' | 'Height'}`]: Ref<number>
      }
    },
    {
      persist: {
        pick: [`${leftStr}Perc`],
      },
    },
  )()
}
