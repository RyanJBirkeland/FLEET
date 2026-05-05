import { useEffect, useRef } from 'react'
import MonacoEditor, { loader } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useThemeStore } from '../../stores/theme'
import { getMonacoTheme, getLightMonacoTheme } from '../../lib/monaco-theme'
import { getMonacoV2Theme, V2_THEME_DARK, V2_THEME_LIGHT } from '../../lib/monaco-theme-v2'
import './EditorPane.css'

// Pre-load Monaco via dynamic ESM import so it works in Electron without CDN.
// Vite pre-bundles monaco-editor (see optimizeDeps.include in electron.vite.config.ts).
const monacoPromise = import('monaco-editor')
monacoPromise.then((monaco) => {
  loader.config({ monaco })
})

export interface EditorPaneProps {
  filePath: string | null
  content: string | null
  language: string
  onContentChange?: ((content: string) => void) | undefined
  onSave?: (() => void) | undefined
  minimapEnabled?: boolean | undefined
  wordWrapEnabled?: boolean | undefined
  fontSize?: number | undefined
  /**
   * Optional ref the parent can hold onto for things like programmatic
   * scrolling, focus, or theming hooks. EditorColumn passes this so the
   * V2 chrome theme (gutter, selection, current-line) can be re-applied
   * when the workspace theme flips.
   */
  editorRef?: React.RefObject<Monaco.editor.IStandaloneCodeEditor | null> | undefined
}

export function EditorPane({
  filePath,
  content,
  language,
  onContentChange,
  onSave,
  minimapEnabled = true,
  wordWrapEnabled = false,
  fontSize = 13,
  editorRef
}: EditorPaneProps): React.JSX.Element {
  const theme = useThemeStore((s) => s.theme)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const localEditorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    const monaco = monacoRef.current
    if (!monaco) return
    applyAllThemes(monaco, theme)
  }, [theme])

  if (!filePath || content === null) {
    return <div className="ide-editor-empty">Open a file from the sidebar to start editing</div>
  }

  function handleBeforeMount(monaco: typeof Monaco): void {
    monacoRef.current = monaco
    monaco.editor.defineTheme('fleet-dark', getMonacoTheme())
    monaco.editor.defineTheme('fleet-light', getLightMonacoTheme())
  }

  function handleMount(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco): void {
    monacoRef.current = monaco
    localEditorRef.current = editor
    if (editorRef) editorRef.current = editor

    applyAllThemes(monaco, theme)
    bindEditorShortcuts(editor, monaco, onSave)
  }

  function handleChange(value: string | undefined): void {
    if (value !== undefined) onContentChange?.(value)
  }

  return (
    <MonacoEditor
      height="100%"
      width="100%"
      language={language}
      value={content}
      theme={resolveActiveThemeName(theme)}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      onChange={handleChange}
      options={{
        fontSize,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        minimap: { enabled: minimapEnabled },
        automaticLayout: true,
        tabSize: 2,
        bracketPairColorization: { enabled: true },
        scrollBeyondLastLine: false,
        wordWrap: wordWrapEnabled ? 'on' : 'off'
      }}
    />
  )
}

// ─── Theme application ───────────────────────────────────────────────────────

/**
 * Defines both the legacy `fleet-*` syntax themes and the V2 chrome overlay,
 * then activates the V2 overlay. The V2 overlay inherits syntax token colors
 * from the legacy theme so syntax highlighting stays exactly as it was.
 */
function applyAllThemes(monaco: typeof Monaco, theme: 'system' | 'dark' | 'light'): void {
  const isDark = theme !== 'light'
  monaco.editor.defineTheme('fleet-dark', getMonacoTheme())
  monaco.editor.defineTheme('fleet-light', getLightMonacoTheme())
  monaco.editor.defineTheme(V2_THEME_DARK, getMonacoV2Theme(true))
  monaco.editor.defineTheme(V2_THEME_LIGHT, getMonacoV2Theme(false))
  monaco.editor.setTheme(isDark ? V2_THEME_DARK : V2_THEME_LIGHT)
}

function resolveActiveThemeName(theme: 'system' | 'dark' | 'light'): string {
  return theme === 'light' ? V2_THEME_LIGHT : V2_THEME_DARK
}

function bindEditorShortcuts(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  onSave: (() => void) | undefined
): void {
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    onSave?.()
  })
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
    editor.getAction('actions.find')?.run()
  })
}
