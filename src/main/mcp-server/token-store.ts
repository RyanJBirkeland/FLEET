import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

const TOKEN_BYTES = 32
const FILE_MODE = 0o600

export function tokenFilePath(): string {
  return join(homedir(), '.bde', 'mcp-token')
}

async function generateAndWrite(filePath: string): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString('hex')
  await fs.mkdir(join(filePath, '..'), { recursive: true })
  await fs.writeFile(filePath, token + '\n', { mode: FILE_MODE, flag: 'w' })
  await fs.chmod(filePath, FILE_MODE)
  return token
}

export async function readOrCreateToken(
  filePath: string = tokenFilePath()
): Promise<string> {
  try {
    const contents = await fs.readFile(filePath, 'utf8')
    const token = contents.trim()
    if (/^[0-9a-f]{64}$/.test(token)) return token
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') throw err
  }
  return generateAndWrite(filePath)
}

export async function regenerateToken(
  filePath: string = tokenFilePath()
): Promise<string> {
  return generateAndWrite(filePath)
}
