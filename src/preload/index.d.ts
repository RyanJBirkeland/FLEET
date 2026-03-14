import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getGatewayConfig: () => Promise<{ url: string; token: string }>
      getGitHubToken: () => Promise<string | null>
      getRepoPaths: () => Promise<Record<string, string>>
      readSprintMd: (repoPath: string) => Promise<string>
      openExternal: (url: string) => Promise<void>
    }
  }
}
