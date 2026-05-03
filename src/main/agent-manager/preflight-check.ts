import * as nodeFs from 'node:fs'
import { join } from 'node:path'
import { execFileAsync } from '../lib/async-utils'
import { createLogger } from '../logger'

const log = createLogger('preflight-check')

export interface ToolchainSignal {
  binary: string
  /** When true, probe via existsSync at localPath instead of `which`. */
  local?: boolean
  localPath?: string
}

/**
 * Inspects the repo root for known toolchain signals and returns the binaries
 * that need to be present for agents to function. Plain npm projects return
 * an empty list — node and npm are already guaranteed by buildAgentEnv.
 */
export function detectToolchain(repoPath: string): ToolchainSignal[] {
  try {
    return gatherSignals(repoPath)
  } catch (err) {
    log.warn(`[preflight-check] detectToolchain failed (fail-open): ${err}`)
    return []
  }
}

function gatherSignals(repoPath: string): ToolchainSignal[] {
  const signals: ToolchainSignal[] = []
  const has = (file: string): boolean => nodeFs.existsSync(join(repoPath, file))

  const hasTurboJson = has('turbo.json')
  const hasTurboScript = !hasTurboJson && packageScriptsReferenceTurbo(repoPath)
  if (hasTurboJson || hasTurboScript) {
    const localTurbo = join(repoPath, 'node_modules', '.bin', 'turbo')
    signals.push({ binary: 'turbo', local: true, localPath: localTurbo })
  }

  if (has('pnpm-workspace.yaml') || has('pnpm-lock.yaml')) {
    signals.push({ binary: 'pnpm' })
  }

  if (has('.yarnrc.yml')) {
    signals.push({ binary: 'yarn' })
  }

  if (has('gradlew')) {
    signals.push({ binary: 'java' })
    signals.push({ binary: 'gradlew', local: true, localPath: join(repoPath, 'gradlew') })
  } else if (has('pom.xml')) {
    signals.push({ binary: 'mvn' })
  }

  if (has('pyproject.toml') || has('poetry.lock')) {
    signals.push({ binary: 'python' })
    signals.push({ binary: 'poetry' })
  }

  if (has('Cargo.toml')) {
    signals.push({ binary: 'cargo' })
  }

  return signals
}

function packageScriptsReferenceTurbo(repoPath: string): boolean {
  try {
    const raw = nodeFs.readFileSync(join(repoPath, 'package.json'), 'utf-8')
    const pkg = JSON.parse(raw) as Record<string, unknown>
    const scripts = pkg.scripts as Record<string, string> | undefined
    return !!scripts && Object.values(scripts).some((v) => v.includes('turbo'))
  } catch {
    return false
  }
}

export type PreflightResult =
  | { ok: true }
  | { ok: false; missing: string[]; missingEnvVars: string[] }

/**
 * Reads the repo's .npmrc and returns the names of ${VAR_NAME} references
 * that are not present in the supplied env. Returns an empty array when .npmrc
 * is absent or cannot be read (fail-open — a broken scanner must not block spawning).
 */
export function detectNpmrcMissingVars(
  repoPath: string,
  env: Record<string, string | undefined>
): string[] {
  try {
    const npmrcPath = join(repoPath, '.npmrc')
    if (!nodeFs.existsSync(npmrcPath)) return []
    const content = nodeFs.readFileSync(npmrcPath, 'utf-8')
    const matches = [...content.matchAll(/\$\{([A-Z_][A-Z0-9_]*)\}/g)]
    const referenced = new Set(matches.map((m) => m[1]).filter((n): n is string => n != null))
    return [...referenced].filter((name) => !env[name])
  } catch {
    return []
  }
}

/**
 * Runs toolchain detection and probes each required binary, and scans .npmrc
 * for env vars that are missing from the agent environment.
 * Returns ok:true if all checks pass, ok:false with missing lists otherwise.
 * Returns ok:true on any detection error — a broken detector must not block spawning.
 */
export async function runPreflightChecks(
  repoPath: string,
  env: Record<string, string | undefined>
): Promise<PreflightResult> {
  const signals = detectToolchain(repoPath)
  const missingEnvVars = detectNpmrcMissingVars(repoPath, env)

  if (signals.length === 0 && missingEnvVars.length === 0) return { ok: true }

  const missing: string[] = []
  for (const signal of signals) {
    const found = await probeBinary(signal, env)
    if (!found) missing.push(signal.binary)
  }

  return missing.length === 0 && missingEnvVars.length === 0
    ? { ok: true }
    : { ok: false, missing, missingEnvVars }
}

async function probeBinary(
  signal: ToolchainSignal,
  env: Record<string, string | undefined>
): Promise<boolean> {
  if (signal.local && signal.localPath) {
    return nodeFs.existsSync(signal.localPath)
  }
  try {
    await execFileAsync('which', [signal.binary], { env, timeout: 5000 })
    return true
  } catch {
    return false
  }
}
