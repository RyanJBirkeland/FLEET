import { useGatewayStore } from '../stores/gateway'

let rpcId = 0

export async function invokeTool(tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const client = useGatewayStore.getState().client
  if (!client) throw new Error('Gateway not connected')

  const id = ++rpcId

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub()
      reject(new Error(`RPC timeout: ${tool}`))
    }, 30_000)

    const unsub = client.onMessage((data) => {
      const msg = data as { id?: number; result?: unknown; error?: string }
      if (msg.id !== id) return
      unsub()
      clearTimeout(timeout)
      if (msg.error) {
        reject(new Error(msg.error))
      } else {
        resolve(msg.result)
      }
    })

    client.send({ id, tool, args })
  })
}
