import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAgentCostHistory } from '../cost'

describe('cost service', () => {
  beforeEach(() => {
    vi.mocked(window.api.cost.getAgentHistory).mockResolvedValue([])
  })

  it('getAgentCostHistory delegates to window.api.cost.getAgentHistory', async () => {
    await getAgentCostHistory()
    expect(window.api.cost.getAgentHistory).toHaveBeenCalled()
  })
})
