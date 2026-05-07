import { describe, it, expect } from 'vitest'
import {
  isValidLayout,
  migrateLayout,
  createLeaf,
  type PanelLeafNode,
  type PanelSplitNode,
  type PanelNode
} from '../panel-tree'

describe('migrateLayout', () => {
  it("renames legacy 'memory' tabs to 'settings'", () => {
    const stale: PanelLeafNode = {
      type: 'leaf',
      panelId: 'p1',
      tabs: [{ viewKey: 'memory' as any, label: 'Memory' }],
      activeTab: 0
    }
    const migrated = migrateLayout(stale) as PanelLeafNode
    expect(migrated.tabs[0].viewKey).toBe('settings')
  })

  it("renames legacy 'cost' tabs to 'settings'", () => {
    const stale: PanelLeafNode = {
      type: 'leaf',
      panelId: 'p1',
      tabs: [{ viewKey: 'cost' as any, label: 'Cost' }],
      activeTab: 0
    }
    const migrated = migrateLayout(stale) as PanelLeafNode
    expect(migrated.tabs[0].viewKey).toBe('settings')
  })

  it("renames legacy 'pr-station' tabs to 'code-review'", () => {
    const stale: PanelLeafNode = {
      type: 'leaf',
      panelId: 'p1',
      tabs: [{ viewKey: 'pr-station' as any, label: 'PR Station' }],
      activeTab: 0
    }
    const migrated = migrateLayout(stale) as PanelLeafNode
    expect(migrated.tabs[0].viewKey).toBe('code-review')
  })

  it('recursively migrates split children', () => {
    const split: PanelSplitNode = {
      type: 'split',
      direction: 'horizontal',
      children: [
        {
          type: 'leaf',
          panelId: 'p1',
          tabs: [{ viewKey: 'memory' as any, label: 'Memory' }],
          activeTab: 0
        },
        {
          type: 'leaf',
          panelId: 'p2',
          tabs: [{ viewKey: 'pr-station' as any, label: 'PR Station' }],
          activeTab: 0
        }
      ],
      sizes: [50, 50]
    }
    const migrated = migrateLayout(split) as PanelSplitNode
    expect((migrated.children[0] as PanelLeafNode).tabs[0].viewKey).toBe('settings')
    expect((migrated.children[1] as PanelLeafNode).tabs[0].viewKey).toBe('code-review')
  })
})

describe('isValidLayout', () => {
  it('accepts a valid leaf', () => {
    expect(isValidLayout(createLeaf('dashboard'))).toBe(true)
  })

  it('accepts a valid split tree', () => {
    const split: PanelNode = {
      type: 'split',
      direction: 'vertical',
      children: [createLeaf('dashboard'), createLeaf('agents')],
      sizes: [50, 50]
    }
    expect(isValidLayout(split)).toBe(true)
  })

  it('rejects null', () => {
    expect(isValidLayout(null)).toBe(false)
  })

  it('rejects non-object values', () => {
    expect(isValidLayout('leaf')).toBe(false)
    expect(isValidLayout(42)).toBe(false)
  })

  it("rejects objects missing the 'type' field", () => {
    expect(isValidLayout({ panelId: 'p1', tabs: [] })).toBe(false)
  })

  it('rejects a leaf with no tabs', () => {
    expect(isValidLayout({ type: 'leaf', panelId: 'p1', tabs: [] })).toBe(false)
  })

  it('rejects a split with malformed children', () => {
    expect(isValidLayout({ type: 'split', children: [null, null] })).toBe(false)
  })
})
