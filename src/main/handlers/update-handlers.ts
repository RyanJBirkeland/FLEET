import { safeHandle } from '../ipc-utils'
import type { UpdaterService } from '../services/updater-service'

export function registerUpdateHandlers(updaterService: UpdaterService): void {
  safeHandle('updates:checkForUpdates', async () => {
    updaterService.checkForUpdates()
  })

  safeHandle('updates:install', async () => {
    updaterService.quitAndInstall()
  })
}
