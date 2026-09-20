import { useState } from 'react'

// Local typing does not fill the project history; one commit creates one undo entry.
export function CommitInput({ value, onCommit, multiline = false, ...props }: {
  value: string; onCommit: (value: string) => void; multiline?: boolean;
  className?: string; 'aria-label'?: string; placeholder?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => { if (draft !== null && draft !== value) onCommit(draft); setDraft(null) }
  const shared = {
    ...props, value: draft ?? value, onBlur: commit,
    onDoubleClick: (event: React.MouseEvent) => event.stopPropagation(),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
    onKeyDown: (event: React.KeyboardEvent) => {
      event.stopPropagation()
      if (event.key === 'Escape') { setDraft(null); event.preventDefault() }
      if (event.key === 'Enter' && !multiline) { commit(); (event.target as HTMLElement).blur() }
    },
  }
  return multiline ? <textarea {...shared} /> : <input {...shared} />
}
