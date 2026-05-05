import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

/**
 * Reads file-based MCP server names from ~/.claude/settings.json.
 * Returns an empty array if the file is absent or unparseable.
 * Does NOT include claude.ai managed connectors — those are resolved by the
 * CLI's authenticated session and are not accessible via the Agent SDK query() API.
 */
export async function readFileMcpServerNames(): Promise<string[]> {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
  try {
    const raw = await fs.promises.readFile(settingsPath, 'utf8')
    const settings = JSON.parse(raw) as unknown
    if (!settings || typeof settings !== 'object') return []
    const mcpServers = (settings as Record<string, unknown>).mcpServers
    if (!mcpServers || typeof mcpServers !== 'object') return []
    return Object.keys(mcpServers)
  } catch {
    return []
  }
}
