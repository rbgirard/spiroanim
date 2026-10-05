import { PRODUCTION_PWA_HOSTNAME } from '@/sys/pwaManifest'
import { isTouchDevice } from '@/utils/device'
import erudaScriptSource from 'eruda/eruda.js?url'
import type { Eruda } from 'eruda'

const ERUDA_SCRIPT_ID = 'spiroanim-eruda'

interface MobileDevToolsWindow {
  location: Pick<Location, 'hostname'>
  navigator: Pick<Navigator, 'maxTouchPoints' | 'userAgent'>
  eruda?: Pick<Eruda, 'init'>
}

export function loadMobileDevTools(
  sourceWindow: MobileDevToolsWindow = window,
  sourceDocument: Document = document,
): void {
  if (
    sourceWindow.location.hostname === PRODUCTION_PWA_HOSTNAME ||
    !isTouchDevice(sourceWindow.navigator)
  ) {
    return
  }

  if (sourceWindow.eruda) {
    sourceWindow.eruda.init()
    return
  }

  if (sourceDocument.getElementById(ERUDA_SCRIPT_ID)) return

  const script = sourceDocument.createElement('script')
  script.id = ERUDA_SCRIPT_ID
  // Emit a local asset so the existing PWA precache includes the full suite for offline use.
  script.src = erudaScriptSource
  script.onload = () => sourceWindow.eruda?.init()
  sourceDocument.body.appendChild(script)
}
