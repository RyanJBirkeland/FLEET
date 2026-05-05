import { useRef, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, Loader } from 'lucide-react'
import type { ChatBlock } from '../../lib/pair-events'
import { ConsoleCard } from './cards/ConsoleCard'
import type { PlaygroundContentType } from '../../../../shared/types'

interface PlaygroundBlock {
  filename: string
  html: string
  contentType: PlaygroundContentType
  sizeBytes: number
}

interface AgentConsoleStreamProps {
  blocks: ChatBlock[]
  matchingIndicesSet: Set<number>
  matchingIndicesArray: number[]
  activeMatchIndex: number
  onPlaygroundClick: (block: PlaygroundBlock) => void
  isRunning: boolean
}

export function AgentConsoleStream({
  blocks,
  matchingIndicesSet,
  matchingIndicesArray,
  activeMatchIndex,
  onPlaygroundClick,
  isRunning,
}: AgentConsoleStreamProps): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [showJumpButton, setShowJumpButton] = useState(false)

  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  })

  // Auto-scroll to bottom when new blocks arrive (if already at bottom)
  useEffect(() => {
    if (isAtBottomRef.current && blocks.length > 0) {
      virtualizer.scrollToIndex(blocks.length - 1, { align: 'end' })
    }
  }, [blocks.length, virtualizer])

  // Scroll to active search match
  useEffect(() => {
    const target = matchingIndicesArray[activeMatchIndex]
    if (target !== undefined) {
      virtualizer.scrollToIndex(target, { align: 'center' })
    }
  }, [activeMatchIndex, matchingIndicesArray, virtualizer])

  const handleScroll = (): void => {
    const el = parentRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    isAtBottomRef.current = atBottom
    setShowJumpButton(!atBottom && blocks.length > 0)
  }

  const handleJumpToLatest = (): void => {
    if (blocks.length > 0) {
      virtualizer.scrollToIndex(blocks.length - 1, { align: 'end' })
      isAtBottomRef.current = true
      setShowJumpButton(false)
    }
  }

  return (
    <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="console-body"
        role="log"
        aria-label="Agent console output"
      >
        {blocks.length > 0 ? (
          <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const blockIndex = virtualRow.index
              const isMatch = matchingIndicesSet.has(blockIndex)
              const isActiveMatch = isMatch && matchingIndicesArray[activeMatchIndex] === blockIndex
              const searchHighlight = isActiveMatch ? 'active' : isMatch ? 'match' : undefined
              const block = blocks[blockIndex]
              if (!block) return null
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ConsoleCard
                    block={block}
                    onPlaygroundClick={onPlaygroundClick}
                    searchHighlight={searchHighlight}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="console-empty-state" role="status">
            {isRunning ? (
              <>
                <Loader size={20} className="console-empty-state__spinner" aria-hidden="true" />
                <span>Waiting for agent output…</span>
              </>
            ) : (
              <span>No events recorded for this agent</span>
            )}
          </div>
        )}
      </div>

      {showJumpButton && (
        <button onClick={handleJumpToLatest} className="console-jump-to-latest">
          Jump to latest
          <ChevronDown size={16} />
        </button>
      )}
    </div>
  )
}
