/**
 * turn-budget.ts — Tool policy for pipeline agents.
 *
 * The maxTurns limit is now configured via Settings → Agents → Max turns (Pipeline)
 * and defaults to 1000. Turn budget is no longer computed per-spec.
 */

/**
 * Tools blocked for pipeline agents.
 *
 * Two classes of entries:
 *
 * 1. **Reconnaissance Bash subcommands** (`git log`, `git status`, …) that
 *    burn turns without producing value when the spec already describes the
 *    target files.
 * 2. **Network and credential-reach tools** (`curl`, `wget`, `ssh`, `scp`,
 *    `nc`, `gh`, `WebFetch`, `WebSearch`) that are outside the pipeline
 *    agent's legitimate responsibilities (edit code inside the worktree, run
 *    tests) and provide direct exfiltration / lateral-movement primitives if
 *    a spec contains a prompt-injection payload. The Code Review Station
 *    drives PR creation and pushing, not the agent itself.
 *
 * The SDK's `disallowedTools` uses tool-name + pattern strings matching
 * Claude Code's permission rule syntax: `Bash(<command>:*)` matches any
 * Bash invocation whose command line starts with `<command>`; a bare tool
 * name (e.g. `WebFetch`) disables the tool entirely.
 *
 * Confirmed against `@anthropic-ai/claude-agent-sdk` Options.disallowedTools
 * (string[]).
 */
export const PIPELINE_DISALLOWED_TOOLS: readonly string[] = [
  'Bash(git log:*)',
  'Bash(git status:*)',
  'Bash(git ls-remote:*)',
  'Bash(git diff:*)',
  'Bash(git reflog:*)',
  'Bash(git log --grep:*)',
  'Bash(curl:*)',
  'Bash(wget:*)',
  'Bash(ssh:*)',
  'Bash(scp:*)',
  'Bash(nc:*)',
  'Bash(gh:*)',
  'WebFetch',
  'WebSearch'
]
