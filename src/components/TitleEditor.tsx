import { useRef, useState, type KeyboardEvent } from 'react'
import { MAX_TITLE_LENGTH } from '../todos/tree'

interface TitleEditorProps {
  initialTitle: string
  onSave: (title: string) => void
  onClose: (returnFocus: boolean) => void
  className?: string
}

/** Enter or leaving the field saves, Escape cancels. An empty title keeps the old one. */
export function TitleEditor({ initialTitle, onSave, onClose, className }: TitleEditorProps) {
  const [draft, setDraft] = useState(initialTitle)
  // Closing unmounts the input, which can fire a late blur; this makes sure we finish once.
  const finishedRef = useRef(false)

  function finish(save: boolean, returnFocus: boolean) {
    if (finishedRef.current) return
    finishedRef.current = true
    if (save && draft.trim()) onSave(draft)
    onClose(returnFocus)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      finish(true, true)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      finish(false, true)
    }
  }

  return (
    <input
      className={['text-input', 'title-input', className].filter(Boolean).join(' ')}
      type="text"
      value={draft}
      maxLength={MAX_TITLE_LENGTH}
      aria-label="Title"
      enterKeyHint="done"
      autoFocus
      onFocus={(event) => event.target.select()}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => finish(true, false)}
    />
  )
}
