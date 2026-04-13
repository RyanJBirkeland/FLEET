/**
 * Creates a debounced persist function and a cancel function.
 *
 * When `persist(value)` is called, any pending timer is cleared and a new one
 * is started. The `onPersist` callback fires only after `delayMs` of silence.
 * Call `cancel()` to discard a pending timer (e.g. on `beforeunload` after
 * flushing synchronously, or when tearing down a store subscriber).
 *
 * Returns a tuple: [persist, cancel]
 */
export function createDebouncedPersister<T>(
  onPersist: (value: T) => void,
  delayMs: number
): [(value: T) => void, () => void] {
  let timer: ReturnType<typeof setTimeout> | null = null

  const persist = (value: T): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      onPersist(value)
    }, delayMs)
  }

  const cancel = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return [persist, cancel]
}
