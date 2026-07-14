export const DEFAULT_TOOLTIP_DELAY = 0

export type TooltipPlacement = 'top' | 'bottom'

type TooltipHide = () => void

let activeTooltipHide: TooltipHide | undefined

export function activateTooltip(hide: TooltipHide): void {
  if (activeTooltipHide !== hide) activeTooltipHide?.()
  activeTooltipHide = hide
}

export function deactivateTooltip(hide: TooltipHide): void {
  if (activeTooltipHide === hide) activeTooltipHide = undefined
}
