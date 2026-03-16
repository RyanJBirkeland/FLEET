export interface LogPollerState {
  logContent: string
  logNextByte: number
  _logInterval: ReturnType<typeof setInterval> | null
}

export function createLogPollerActions(
  get: () => LogPollerState,
  set: (s: Partial<LogPollerState>) => void
): {
  startLogPolling: (readFn: (fromByte: number) => Promise<{ content: string; nextByte: number }>) => void
  stopLogPolling: () => void
} {
  return {
    startLogPolling: (readFn): void => {
      const prev = get()
      if (prev._logInterval) clearInterval(prev._logInterval)

      const poll = async (): Promise<void> => {
        try {
          const result = await readFn(get().logNextByte)
          if (result.content) {
            set({
              logContent: get().logContent + result.content,
              logNextByte: result.nextByte
            })
          }
        } catch {
          // Log may not exist yet
        }
      }

      poll()
      const interval = setInterval(poll, 1000)
      set({ _logInterval: interval })
    },

    stopLogPolling: (): void => {
      const { _logInterval } = get()
      if (_logInterval) {
        clearInterval(_logInterval)
        set({ _logInterval: null })
      }
    }
  }
}
