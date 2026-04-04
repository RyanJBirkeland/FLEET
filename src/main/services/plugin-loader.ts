import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createLogger } from '../logger'
import type { BdePlugin } from '../../shared/plugin-types'

const logger = createLogger('plugin-loader')
const PLUGINS_DIR = join(homedir(), '.bde', 'plugins')

let loadedPlugins: BdePlugin[] = []

export function loadPlugins(): BdePlugin[] {
  if (!existsSync(PLUGINS_DIR)) {
    logger.info(`[plugin-loader] No plugins directory at ${PLUGINS_DIR}`)
    return []
  }

  const files = readdirSync(PLUGINS_DIR).filter((f) => f.endsWith('.js') || f.endsWith('.cjs'))
  loadedPlugins = []

  for (const file of files) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(join(PLUGINS_DIR, file))
      const plugin: BdePlugin = mod.default ?? mod
      if (!plugin.name) {
        logger.warn(`[plugin-loader] Skipping ${file} — missing 'name' export`)
        continue
      }
      loadedPlugins.push(plugin)
      logger.info(`[plugin-loader] Loaded plugin: ${plugin.name}`)
    } catch (err) {
      logger.error(`[plugin-loader] Failed to load ${file}: ${err}`)
    }
  }

  return loadedPlugins
}

export function getPlugins(): BdePlugin[] {
  return loadedPlugins
}

export async function emitPluginEvent<K extends keyof BdePlugin>(
  event: K,
  data: BdePlugin[K] extends (arg: infer A) => unknown ? A : never
): Promise<void> {
  for (const plugin of loadedPlugins) {
    const handler = plugin[event]
    if (typeof handler === 'function') {
      try {
        await (handler as (arg: unknown) => unknown)(data)
      } catch (err) {
        logger.error(`[plugin-loader] Plugin ${plugin.name}.${String(event)} error: ${err}`)
      }
    }
  }
}
