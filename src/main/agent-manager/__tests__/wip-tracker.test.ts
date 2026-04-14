import { describe, it, expect } from 'vitest'
import { createConcurrencyState, getAvailableSlots, updateMaxSlots } from '../wip-tracker'
import { makeConcurrencyState, applyBackpressure } from '../concurrency'

describe('createConcurrencyState', () => {
  it('creates state with the given maxSlots', () => {
    const state = createConcurrencyState(4)
    expect(state.maxSlots).toBe(4)
    expect(state.capacityAfterBackpressure).toBe(4)
  })

  it('starts with zero activeCount', () => {
    const state = createConcurrencyState(2)
    expect(state.activeCount).toBe(0)
  })
})

describe('getAvailableSlots', () => {
  it('returns maxSlots when no agents are active', () => {
    const state = createConcurrencyState(3)
    const deps = { activeAgentCount: () => 0 }
    expect(getAvailableSlots(state, deps)).toBe(3)
  })

  it('subtracts active agents from capacity', () => {
    const state = createConcurrencyState(3)
    const deps = { activeAgentCount: () => 2 }
    expect(getAvailableSlots(state, deps)).toBe(1)
  })

  it('returns 0 when at capacity', () => {
    const state = createConcurrencyState(2)
    const deps = { activeAgentCount: () => 2 }
    expect(getAvailableSlots(state, deps)).toBe(0)
  })

  it('returns 0 when over capacity (hot-reload lowered cap)', () => {
    const state = createConcurrencyState(2)
    const deps = { activeAgentCount: () => 5 }
    expect(getAvailableSlots(state, deps)).toBe(0)
  })

  it('reflects backpressure-reduced capacity', () => {
    let state = makeConcurrencyState(4)
    state = applyBackpressure(state, 0)
    const deps = { activeAgentCount: () => 0 }
    expect(getAvailableSlots(state, deps)).toBe(3)
  })
})

describe('updateMaxSlots', () => {
  it('raises maxSlots and immediately increases available slots', () => {
    const state = createConcurrencyState(2)
    updateMaxSlots(state, 5)
    expect(state.maxSlots).toBe(5)
    const deps = { activeAgentCount: () => 0 }
    expect(getAvailableSlots(state, deps)).toBe(5)
  })

  it('lowers maxSlots below active count yields zero available slots', () => {
    const state = createConcurrencyState(8)
    state.activeCount = 4
    updateMaxSlots(state, 2)
    expect(state.maxSlots).toBe(2)
    const deps = { activeAgentCount: () => 4 }
    expect(getAvailableSlots(state, deps)).toBe(0)
  })

  it('slots free up as agents drain after lowering cap', () => {
    const state = createConcurrencyState(8)
    state.activeCount = 4
    updateMaxSlots(state, 2)
    // 3 agents finish
    const deps = { activeAgentCount: () => 1 }
    expect(getAvailableSlots(state, deps)).toBe(1)
  })
})
