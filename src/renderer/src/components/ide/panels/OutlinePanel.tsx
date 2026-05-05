import { useEffect, useState } from 'react'
import type * as Monaco from 'monaco-editor'
import { Filter, ArrowUpDown } from 'lucide-react'
import { PanelHeader } from '../PanelHeader'
import { IconBtn } from '../IconBtn'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OutlinePanelProps {
  editorRef: React.RefObject<Monaco.editor.IStandaloneCodeEditor | null>
  activeFilePath: string | null
}

const TS_LANGUAGE_IDS = new Set([
  'typescript',
  'javascript',
  'typescriptreact',
  'javascriptreact'
])

interface FlatSymbol {
  text: string
  kind: string
  depth: number
  line: number
}

// Maps TypeScript script element kinds to single-char badges.
// https://github.com/microsoft/TypeScript/blob/main/src/services/types.ts#ScriptElementKind
const KIND_BADGE: Record<string, string> = {
  class: 'C',
  interface: 'I',
  enum: 'E',
  function: 'F',
  'local function': 'F',
  method: 'F',
  constructor: 'F',
  variable: 'V',
  'let': 'V',
  const: 'V',
  'local var': 'V',
  type: 'T',
  alias: 'T',
  module: 'M',
  namespace: 'M'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RawNavItem {
  text: string
  kind: string
  spans: Array<{ start: number; length: number }>
  childItems: RawNavItem[]
  indent?: number
}

function flattenNavItems(items: RawNavItem[], depth: number): FlatSymbol[] {
  const result: FlatSymbol[] = []
  for (const item of items) {
    // Skip the synthetic root and <global> containers
    if (item.kind === 'script' || item.text === '<global>') {
      result.push(...flattenNavItems(item.childItems ?? [], depth))
      continue
    }
    result.push({ text: item.text, kind: item.kind, depth, line: 0 })
    if (item.childItems?.length) {
      result.push(...flattenNavItems(item.childItems, depth + 1))
    }
  }
  return result
}

async function fetchTsSymbols(
  editor: Monaco.editor.IStandaloneCodeEditor
): Promise<FlatSymbol[]> {
  const model = editor.getModel()
  if (!model) return []

  const languageId = model.getLanguageId()
  if (!TS_LANGUAGE_IDS.has(languageId)) return []

  try {
    const monaco = await import('monaco-editor')
    const isJs = languageId === 'javascript' || languageId === 'javascriptreact'
    // monaco.typescript is the new top-level namespace in monaco-editor ≥0.52.
    // monaco.languages.typescript is deprecated and returns { deprecated: true }.
    const getWorkerFn = isJs
      ? monaco.typescript.getJavaScriptWorker
      : monaco.typescript.getTypeScriptWorker

    const workerFactory = await getWorkerFn()
    const worker = await workerFactory(model.uri)
    // getNavigationTree replaced getNavigationBarItems in monaco-editor ≥0.52
    const tree = await worker.getNavigationTree(model.uri.toString())
    if (!tree) return []
    return flattenNavItems((tree as RawNavItem).childItems ?? [], 0)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// OutlinePanel
// ---------------------------------------------------------------------------

export function OutlinePanel({ editorRef, activeFilePath }: OutlinePanelProps): React.JSX.Element {
  const [symbols, setSymbols] = useState<FlatSymbol[]>([])
  const [supportsOutline, setSupportsOutline] = useState(true)

  useEffect(() => {
    if (!activeFilePath) {
      setSymbols([])
      return
    }

    const editor = editorRef.current
    if (!editor) return

    const languageId = editor.getModel()?.getLanguageId() ?? ''
    if (!TS_LANGUAGE_IDS.has(languageId)) {
      setSupportsOutline(false)
      setSymbols([])
      return
    }

    setSupportsOutline(true)

    void fetchTsSymbols(editor).then(setSymbols)
  }, [activeFilePath, editorRef])

  const activeFilename = activeFilePath ? activeFilePath.split('/').pop() ?? null : null
  const eyebrow = activeFilename ? `OUTLINE — ${activeFilename}` : 'OUTLINE'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <PanelHeader eyebrow={eyebrow}>
        <IconBtn icon={<Filter size={14} />} title="Filter" onClick={() => {}} />
        <IconBtn icon={<ArrowUpDown size={14} />} title="Sort" onClick={() => {}} />
      </PanelHeader>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--line) transparent'
        }}
      >
        {!activeFilePath ? (
          <NoFileOpenState />
        ) : !supportsOutline ? (
          <NoOutlineSupportState />
        ) : symbols.length === 0 ? (
          <NoSymbolsState />
        ) : (
          <SymbolList symbols={symbols} onJump={(sym) => jumpToSymbol(editorRef, sym)} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Navigation helper
// ---------------------------------------------------------------------------

function jumpToSymbol(
  editorRef: React.RefObject<Monaco.editor.IStandaloneCodeEditor | null>,
  sym: FlatSymbol
): void {
  const editor = editorRef.current
  if (!editor || !sym.text) return
  editor.getAction('actions.find')?.run()
}

// ---------------------------------------------------------------------------
// Symbol list
// ---------------------------------------------------------------------------

interface SymbolListProps {
  symbols: FlatSymbol[]
  onJump: (sym: FlatSymbol) => void
}

function SymbolList({ symbols }: SymbolListProps): React.JSX.Element {
  return (
    <div style={{ padding: 'var(--s-1) 0' }}>
      {symbols.map((sym, idx) => (
        <SymbolRow key={`${sym.text}-${idx}`} sym={sym} />
      ))}
    </div>
  )
}

function SymbolRow({ sym }: { sym: FlatSymbol }): React.JSX.Element {
  const badge = KIND_BADGE[sym.kind]

  return (
    <div
      style={{
        height: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--s-2)',
        paddingLeft: `calc(var(--s-3) + ${sym.depth * 12}px)`,
        paddingRight: 'var(--s-3)',
        cursor: 'default'
      }}
    >
      {badge !== undefined ? (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--t-2xs)',
            color: 'var(--accent)',
            width: 12,
            flexShrink: 0,
            textAlign: 'center'
          }}
        >
          {badge}
        </span>
      ) : (
        <span style={{ width: 12, flexShrink: 0 }} />
      )}
      <span
        style={{
          fontSize: 'var(--t-sm)',
          color: 'var(--fg-2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {sym.text}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function NoSymbolsState(): React.JSX.Element {
  return (
    <EmptyState eyebrow="NO SYMBOLS" message="No symbols found in this file." />
  )
}

function NoOutlineSupportState(): React.JSX.Element {
  return (
    <EmptyState eyebrow="NOT SUPPORTED" message="Outline is available for TypeScript and JavaScript files." />
  )
}

function NoFileOpenState(): React.JSX.Element {
  return (
    <EmptyState eyebrow="NO FILE OPEN" message="Open a file to see its outline." />
  )
}

function EmptyState({ eyebrow, message }: { eyebrow: string; message: string }): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 'var(--s-2)',
        padding: 'var(--s-5)',
        textAlign: 'center'
      }}
    >
      <span className="fleet-eyebrow">{eyebrow}</span>
      <span style={{ fontSize: 'var(--t-sm)', color: 'var(--fg-3)' }}>{message}</span>
    </div>
  )
}
