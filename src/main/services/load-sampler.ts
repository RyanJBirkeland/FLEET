import os from 'node:os'

export interface LoadSample {
  t: number
  load1: number
  load5: number
  load15: number
}

export const SAMPLE_INTERVAL_MS = 5_000
export const BUFFER_SIZE = 120 // 10 minutes at 5s

/**
 * Samples `os.loadavg()` on a fixed cadence and exposes the most recent
 * 10-minute window. Uses a ring buffer (Float64Array per metric + a shared
 * timestamp array) for O(1) push and eviction — the previous `Array.shift()`
 * approach was O(n) on every sample. Lifetime is owned by the caller.
 */
export class LoadSampler {
  private readonly timestamps: Float64Array
  private readonly load1Values: Float64Array
  private readonly load5Values: Float64Array
  private readonly load15Values: Float64Array
  private head = 0
  private count = 0
  private timer: NodeJS.Timeout | null = null
  private cpuCount = os.cpus().length

  constructor(size: number = BUFFER_SIZE) {
    this.timestamps = new Float64Array(size)
    this.load1Values = new Float64Array(size)
    this.load5Values = new Float64Array(size)
    this.load15Values = new Float64Array(size)
  }

  start(): void {
    if (this.timer) return
    this.cpuCount = os.cpus().length
    this.sample()
    this.timer = setInterval(() => this.sample(), SAMPLE_INTERVAL_MS)
    this.timer.unref?.()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  snapshot(): { samples: LoadSample[]; cpuCount: number } {
    return { samples: this.getValues(), cpuCount: this.cpuCount }
  }

  /** Test-only — wipe buffer and timer. */
  reset(): void {
    this.stop()
    this.head = 0
    this.count = 0
    this.cpuCount = os.cpus().length
  }

  private push(t: number, load1: number, load5: number, load15: number): void {
    this.timestamps[this.head] = t
    this.load1Values[this.head] = load1
    this.load5Values[this.head] = load5
    this.load15Values[this.head] = load15
    this.head = (this.head + 1) % this.timestamps.length
    if (this.count < this.timestamps.length) this.count++
  }

  /** Returns samples in insertion order (oldest first). */
  private getValues(): LoadSample[] {
    const size = this.timestamps.length
    const result: LoadSample[] = []
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + size) % size
      result.push({
        t: this.timestamps[idx] ?? 0,
        load1: this.load1Values[idx] ?? 0,
        load5: this.load5Values[idx] ?? 0,
        load15: this.load15Values[idx] ?? 0
      })
    }
    return result
  }

  private sample(): void {
    const [load1 = 0, load5 = 0, load15 = 0] = os.loadavg()
    this.push(Date.now(), load1, load5, load15)
  }
}

const defaultSampler = new LoadSampler()

export function startLoadSampler(): void {
  defaultSampler.start()
}

export function stopLoadSampler(): void {
  defaultSampler.stop()
}

export function getLoadSnapshot(): { samples: LoadSample[]; cpuCount: number } {
  return defaultSampler.snapshot()
}

/** @internal Test-only: wipe buffer + timer. */
export function _resetForTests(): void {
  defaultSampler.reset()
}
