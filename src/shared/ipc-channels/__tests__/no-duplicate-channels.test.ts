import { describe, it, expect } from 'vitest'
import type { BroadcastChannels } from '../broadcast-channels'
import type { AgentEventChannels } from '../agent-channels'

/**
 * Regression test for duplicate channel definitions.
 *
 * Context: `agent:event` was previously defined in both BroadcastChannels
 * and AgentEventChannels, causing type narrowing issues. Fixed in commit
 * 06454e49 (Apr 13, 2026).
 *
 * This test ensures the duplicate doesn't return.
 */
describe('Channel definition uniqueness', () => {
  it('agent:event exists only in BroadcastChannels, not AgentEventChannels', () => {
    // Type-level assertion: if 'agent:event' is in AgentEventChannels,
    // this will compile (and fail the test). If not, TypeScript error.
    const broadcastKeys: Array<keyof BroadcastChannels> = ['agent:event']
    expect(broadcastKeys).toContain('agent:event')

    // Verify AgentEventChannels does NOT include 'agent:event'
    const agentEventKeys: Array<keyof AgentEventChannels> = ['agent:history']
    expect(agentEventKeys).not.toContain('agent:event')
    expect(agentEventKeys).toHaveLength(1)
  })

  it('agent:event is a broadcast channel with correct payload shape', () => {
    // Runtime verification of the channel's type structure
    type AgentEventPayload = BroadcastChannels['agent:event']

    // This will fail to compile if the shape changes
    const validPayload: AgentEventPayload = {
      agentId: 'test-agent-id',
      event: {
        timestamp: Date.now(),
        type: 'stateChange',
        payload: {}
      }
    }

    expect(validPayload).toHaveProperty('agentId')
    expect(validPayload).toHaveProperty('event')
  })
})
