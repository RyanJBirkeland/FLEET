/**
 * Prepares an opencode worktree for an agent session.
 *
 * Two responsibilities:
 *   1. Write `.opencode/opencode.json` into the worktree with the BDE MCP
 *      server wired up, so the model can create/update tasks and epics via
 *      the same MCP tools the Claude path provides.
 *   2. Build the opencode-specific first-turn prompt — a concise context
 *      prefix (branch name, commit format, pre-commit rules) prepended to
 *      the user's raw task, replacing the Claude-optimized assembled prompt
 *      which local models echo instead of processing.
 *
 * opencode reads CLAUDE.md from the --dir path automatically, so BDE
 * conventions, architecture notes, and key file locations don't need to be
 * injected here — they're already in the repo.
 */
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { readOrCreateToken } from '../mcp-server/token-store'
import { getMcpEnabled, getMcpPort } from '../settings'
import type { Logger } from '../logger'

const OPENCODE_CONFIG_DIR = '.opencode'
const OPENCODE_CONFIG_FILE = 'opencode.json'
const OPENCODE_SCHEMA = 'https://opencode.ai/config.json'

interface OpencodeRemoteMcpServer {
  type: 'remote'
  url: string
  headers: Record<string, string>
}

interface OpencodeWorktreeConfig {
  $schema: string
  mcp?: Record<string, OpencodeRemoteMcpServer>
}

/**
 * Writes `.opencode/opencode.json` into the worktree.
 *
 * If the BDE MCP server is enabled, the config includes a `bde` MCP entry
 * pointing at the running HTTP server with the current bearer token. This
 * gives the opencode agent the same task/epic CRUD tools as the Claude path.
 *
 * Safe to call on every spawn — the file is overwritten, not accumulated.
 */
export async function writeOpencodeWorktreeConfig(
  worktreePath: string,
  logger?: Logger
): Promise<void> {
  const config: OpencodeWorktreeConfig = { $schema: OPENCODE_SCHEMA }

  if (getMcpEnabled()) {
    try {
      const { token } = await readOrCreateToken()
      const port = getMcpPort()
      config.mcp = {
        bde: {
          type: 'remote',
          url: `http://127.0.0.1:${port}/mcp`,
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    } catch (err) {
      logger?.warn(
        `[opencode-worktree] Could not read MCP token — spawning without BDE MCP tools: ${err}`
      )
    }
  }

  const configDir = join(worktreePath, OPENCODE_CONFIG_DIR)
  await fs.mkdir(configDir, { recursive: true })
  await fs.writeFile(
    join(configDir, OPENCODE_CONFIG_FILE),
    JSON.stringify(config, null, 2) + '\n',
    'utf8'
  )
}

/**
 * Builds the first-turn prompt for opencode sessions.
 *
 * opencode auto-reads CLAUDE.md from the working directory, so BDE
 * conventions don't need to be re-injected. Only the pieces that CLAUDE.md
 * can't provide — the current branch name and user task — are added here.
 */
export function buildOpencodeFirstTurnPrompt(task: string, branch: string): string {
  return [
    `You are working on branch \`${branch}\`.`,
    `Commit format: \`{type}({scope}): {description}\`. Run \`npm run typecheck && npm test\` before every commit.`,
    '',
    task
  ].join('\n')
}
