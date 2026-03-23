import { useEffect, useRef } from 'react'

type SpecEditorProps = {
  value: string
  onChange: (value: string) => void
}

export function SpecEditor({ value, onChange }: SpecEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    editorRef.current?.focus()
  }, [])

  return (
    <textarea
      ref={editorRef}
      className="spec-drawer__editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Write your spec in markdown..."
    />
  )
}
