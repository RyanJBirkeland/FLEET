import { safeHandle } from '../ipc-utils'
import { getGatewayConfig, saveGatewayConfig } from '../config'

export function registerConfigHandlers(): void {
  safeHandle('config:getGatewayUrl', () => {
    const config = getGatewayConfig()
    if (!config) return { url: '', hasToken: false }
    return { url: config.url, hasToken: !!config.token }
  })
  safeHandle('config:saveGateway', (_e, url: string, token?: string) => {
    if (token) {
      saveGatewayConfig(url, token)
    } else {
      // Preserve existing token when only URL is updated
      const existing = getGatewayConfig()
      if (!existing) {
        throw new Error('Cannot save gateway config: no token provided and no existing token found')
      }
      saveGatewayConfig(url, existing.token)
    }
  })
}
