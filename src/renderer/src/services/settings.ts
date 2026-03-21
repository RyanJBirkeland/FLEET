export async function getRepoPaths(): Promise<Record<string, string>> {
  return window.api.getRepoPaths()
}

export interface AgentConfig {
  binary: string
  permissionMode: string
}

export async function getAgentConfig(): Promise<AgentConfig> {
  return window.api.getAgentConfig()
}

export async function saveAgentConfig(config: AgentConfig): Promise<void> {
  return window.api.saveAgentConfig(config)
}
