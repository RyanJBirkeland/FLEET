import type { editor } from 'monaco-editor'

/**
 * Build a Monaco dark theme from the currently-active BDE CSS variables.
 * Must be called after DOM is mounted (uses getComputedStyle).
 */
export function getMonacoTheme(): editor.IStandaloneThemeData {
  const style = getComputedStyle(document.documentElement)
  const get = (v: string): string => style.getPropertyValue(v).trim()

  // Neon syntax colors
  const cyan = '#00ffc8'
  const green = '#00ff96'
  const orange = '#ffb432'
  const pink = '#ff64c8'
  const purple = '#bf5af2'
  const dimText = 'rgba(255, 255, 255, 0.3)'

  return {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // Keywords — cyan
      { token: 'keyword', foreground: cyan, fontStyle: 'bold' },
      { token: 'keyword.control', foreground: cyan, fontStyle: 'bold' },
      { token: 'keyword.operator', foreground: cyan },
      { token: 'storage.type', foreground: cyan, fontStyle: 'bold' },
      { token: 'storage.modifier', foreground: cyan },

      // Strings — green
      { token: 'string', foreground: green },
      { token: 'string.quoted', foreground: green },
      { token: 'string.template', foreground: green },
      { token: 'string.regexp', foreground: green, fontStyle: 'italic' },

      // Comments — dim italic
      { token: 'comment', foreground: dimText, fontStyle: 'italic' },
      { token: 'comment.line', foreground: dimText, fontStyle: 'italic' },
      { token: 'comment.block', foreground: dimText, fontStyle: 'italic' },

      // Numbers — orange
      { token: 'constant.numeric', foreground: orange },
      { token: 'constant.language', foreground: orange },
      { token: 'constant.character', foreground: orange },
      { token: 'number', foreground: orange },

      // Functions — pink
      { token: 'entity.name.function', foreground: pink },
      { token: 'support.function', foreground: pink },
      { token: 'meta.function-call', foreground: pink },

      // Types & Classes — purple
      { token: 'entity.name.type', foreground: purple },
      { token: 'entity.name.class', foreground: purple },
      { token: 'support.type', foreground: purple },
      { token: 'support.class', foreground: purple },

      // Variables — default text (inherit)
      { token: 'variable', foreground: get('--bde-text') },
      { token: 'variable.parameter', foreground: get('--bde-text') },

      // Operators — text-muted
      { token: 'keyword.operator.arithmetic', foreground: get('--bde-text-dim') || dimText },
      { token: 'keyword.operator.assignment', foreground: get('--bde-text-dim') || dimText },
      { token: 'keyword.operator.comparison', foreground: get('--bde-text-dim') || dimText },
      { token: 'keyword.operator.logical', foreground: get('--bde-text-dim') || dimText },

      // Punctuation — subtle
      { token: 'punctuation', foreground: get('--bde-text-dim') || dimText },
      { token: 'punctuation.definition', foreground: get('--bde-text-dim') || dimText },

      // Tags (HTML/JSX) — cyan
      { token: 'entity.name.tag', foreground: cyan },
      { token: 'meta.tag', foreground: cyan },

      // Attributes — purple
      { token: 'entity.other.attribute-name', foreground: purple },

      // Invalid/Deprecated — red
      { token: 'invalid', foreground: '#ff3264', fontStyle: 'underline' },
      { token: 'invalid.deprecated', foreground: orange, fontStyle: 'strikethrough' }
    ],
    colors: {
      'editor.background': get('--bde-bg'),
      'editor.foreground': get('--bde-text'),
      'editor.lineHighlightBackground': get('--bde-surface'),
      'editor.selectionBackground': get('--bde-accent-dim') || get('--bde-accent'),
      'editorCursor.foreground': get('--bde-accent'),
      'editorLineNumber.foreground': get('--bde-text-dim') || get('--bde-text'),
      'editorLineNumber.activeForeground': get('--bde-text'),
      'editorIndentGuide.background': get('--bde-border'),
      'editorIndentGuide.activeBackground': get('--bde-accent'),
      'editorWidget.background': get('--bde-surface'),
      'editorWidget.border': get('--bde-border'),
      'editorSuggestWidget.background': get('--bde-surface'),
      'editorSuggestWidget.border': get('--bde-border'),
      'editorSuggestWidget.selectedBackground': get('--bde-accent'),
      'editorHoverWidget.background': get('--bde-surface'),
      'editorHoverWidget.border': get('--bde-border'),
      'input.background': get('--bde-surface'),
      'input.border': get('--bde-border'),
      'input.foreground': get('--bde-text'),
      focusBorder: get('--bde-accent'),
      'scrollbar.shadow': 'transparent',
      'scrollbarSlider.background': get('--bde-border'),
      'scrollbarSlider.hoverBackground': get('--bde-text-dim') || get('--bde-text'),
      'scrollbarSlider.activeBackground': get('--bde-accent'),
      'minimap.background': get('--bde-bg')
    }
  }
}

/**
 * Build a Monaco light theme from the currently-active BDE CSS variables.
 * Must be called after DOM is mounted (uses getComputedStyle).
 */
export function getLightMonacoTheme(): editor.IStandaloneThemeData {
  const style = getComputedStyle(document.documentElement)
  const get = (v: string): string => style.getPropertyValue(v).trim()

  // Light theme syntax colors (from neon.css light overrides)
  const cyan = '#00b894'
  const green = '#00a67e'
  const orange = '#e17055'
  const pink = '#e84393'
  const purple = '#a855f7'
  const dimText = 'rgba(26, 26, 46, 0.3)'

  return {
    base: 'vs',
    inherit: true,
    rules: [
      // Keywords — cyan
      { token: 'keyword', foreground: cyan, fontStyle: 'bold' },
      { token: 'keyword.control', foreground: cyan, fontStyle: 'bold' },
      { token: 'keyword.operator', foreground: cyan },
      { token: 'storage.type', foreground: cyan, fontStyle: 'bold' },
      { token: 'storage.modifier', foreground: cyan },

      // Strings — green
      { token: 'string', foreground: green },
      { token: 'string.quoted', foreground: green },
      { token: 'string.template', foreground: green },
      { token: 'string.regexp', foreground: green, fontStyle: 'italic' },

      // Comments — dim italic
      { token: 'comment', foreground: dimText, fontStyle: 'italic' },
      { token: 'comment.line', foreground: dimText, fontStyle: 'italic' },
      { token: 'comment.block', foreground: dimText, fontStyle: 'italic' },

      // Numbers — orange
      { token: 'constant.numeric', foreground: orange },
      { token: 'constant.language', foreground: orange },
      { token: 'constant.character', foreground: orange },
      { token: 'number', foreground: orange },

      // Functions — pink
      { token: 'entity.name.function', foreground: pink },
      { token: 'support.function', foreground: pink },
      { token: 'meta.function-call', foreground: pink },

      // Types & Classes — purple
      { token: 'entity.name.type', foreground: purple },
      { token: 'entity.name.class', foreground: purple },
      { token: 'support.type', foreground: purple },
      { token: 'support.class', foreground: purple },

      // Variables — default text (inherit)
      { token: 'variable', foreground: get('--bde-text') },
      { token: 'variable.parameter', foreground: get('--bde-text') },

      // Operators — text-muted
      { token: 'keyword.operator.arithmetic', foreground: get('--bde-text-dim') || dimText },
      { token: 'keyword.operator.assignment', foreground: get('--bde-text-dim') || dimText },
      { token: 'keyword.operator.comparison', foreground: get('--bde-text-dim') || dimText },
      { token: 'keyword.operator.logical', foreground: get('--bde-text-dim') || dimText },

      // Punctuation — subtle
      { token: 'punctuation', foreground: get('--bde-text-dim') || dimText },
      { token: 'punctuation.definition', foreground: get('--bde-text-dim') || dimText },

      // Tags (HTML/JSX) — cyan
      { token: 'entity.name.tag', foreground: cyan },
      { token: 'meta.tag', foreground: cyan },

      // Attributes — purple
      { token: 'entity.other.attribute-name', foreground: purple },

      // Invalid/Deprecated — red
      { token: 'invalid', foreground: '#d63031', fontStyle: 'underline' },
      { token: 'invalid.deprecated', foreground: orange, fontStyle: 'strikethrough' }
    ],
    colors: {
      'editor.background': get('--bde-bg'),
      'editor.foreground': get('--bde-text'),
      'editor.lineHighlightBackground': get('--bde-surface'),
      'editor.selectionBackground': get('--bde-accent-dim') || get('--bde-accent'),
      'editorCursor.foreground': get('--bde-accent'),
      'editorLineNumber.foreground': get('--bde-text-dim') || get('--bde-text'),
      'editorLineNumber.activeForeground': get('--bde-text'),
      'editorIndentGuide.background': get('--bde-border'),
      'editorIndentGuide.activeBackground': get('--bde-accent'),
      'editorWidget.background': get('--bde-surface'),
      'editorWidget.border': get('--bde-border'),
      'editorSuggestWidget.background': get('--bde-surface'),
      'editorSuggestWidget.border': get('--bde-border'),
      'editorSuggestWidget.selectedBackground': get('--bde-accent'),
      'editorHoverWidget.background': get('--bde-surface'),
      'editorHoverWidget.border': get('--bde-border'),
      'input.background': get('--bde-surface'),
      'input.border': get('--bde-border'),
      'input.foreground': get('--bde-text'),
      focusBorder: get('--bde-accent'),
      'scrollbar.shadow': 'transparent',
      'scrollbarSlider.background': get('--bde-border'),
      'scrollbarSlider.hoverBackground': get('--bde-text-dim') || get('--bde-text'),
      'scrollbarSlider.activeBackground': get('--bde-accent'),
      'minimap.background': get('--bde-bg')
    }
  }
}
