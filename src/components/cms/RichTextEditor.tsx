import { useEffect, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Youtube from '@tiptap/extension-youtube'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight } from 'lowlight'
import { useTranslation } from '@/stores/i18nStore'

const lowlight = createLowlight()

interface RichTextEditorProps {
  value: string
  onChange: (html: string, json: Record<string, unknown>) => void
}

function EditorButton({
  label,
  onClick,
  active = false
}: {
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
        active
          ? 'bg-accent-500 text-white'
          : 'bg-surface-100 dark:bg-white/10 text-surface-700 dark:text-surface-200 hover:bg-surface-200 dark:hover:bg-white/20'
      }`}
    >
      {label}
    </button>
  )
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'wysiwyg' | 'html'>('wysiwyg')
  const [htmlSource, setHtmlSource] = useState(value || '<p></p>')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto', 'tel'],
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank'
        }
      }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({
        nocookie: true,
      }),
      CodeBlockLowlight.configure({
        lowlight
      })
    ],
    content: value || '<p></p>',
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML()
      setHtmlSource(html)
      onChange(html, instance.getJSON() as Record<string, unknown>)
    }
  })

  useEffect(() => {
    const nextValue = value || '<p></p>'
    setHtmlSource(nextValue)

    if (!editor) return
    const current = editor.getHTML()
    if (nextValue !== current) {
      editor.commands.setContent(nextValue, { emitUpdate: false })
    }
  }, [editor, value])

  if (!editor) {
    return <div className="p-4 text-sm text-surface-500">{t('cms.loadingEditor')}</div>
  }

  const switchToMode = (nextMode: 'wysiwyg' | 'html') => {
    if (nextMode === 'html') {
      setHtmlSource(editor.getHTML())
      setMode('html')
      return
    }

    if (editor.getHTML() !== htmlSource) {
      editor.commands.setContent(htmlSource || '<p></p>', { emitUpdate: false })
      onChange(editor.getHTML(), editor.getJSON() as Record<string, unknown>)
    }
    setMode('wysiwyg')
  }

  const handleHtmlSourceChange = (nextHtml: string) => {
    setHtmlSource(nextHtml)
    editor.commands.setContent(nextHtml || '<p></p>', { emitUpdate: false })
    onChange(editor.getHTML(), editor.getJSON() as Record<string, unknown>)
  }

  return (
    <div className="border border-surface-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-surface-900">
      <div className="p-2 border-b border-surface-200 dark:border-white/10 flex flex-wrap gap-2">
        <EditorButton label="WYSIWYG" active={mode === 'wysiwyg'} onClick={() => switchToMode('wysiwyg')} />
        <EditorButton label="HTML" active={mode === 'html'} onClick={() => switchToMode('html')} />
        {mode === 'wysiwyg' ? (
          <>
            <EditorButton label="B" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
            <EditorButton label="I" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
            <EditorButton label="H2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
            <EditorButton label="UL" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
            <EditorButton label="OL" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
            <EditorButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
            <EditorButton
              label="Link"
              active={editor.isActive('link')}
              onClick={() => {
                const href = window.prompt(t('cms.promptUrl'))
                if (!href) return
                editor.chain().focus().setLink({ href }).run()
              }}
            />
            <EditorButton
              label="Image"
              onClick={() => {
                const src = window.prompt(t('cms.promptImageUrl'))
                if (!src) return
                editor.chain().focus().setImage({ src }).run()
              }}
            />
            <EditorButton
              label="YouTube"
              onClick={() => {
                const src = window.prompt(t('cms.promptYoutubeUrl'))
                if (!src) return
                editor.commands.setYoutubeVideo({
                  src,
                  width: 640,
                  height: 360
                })
              }}
            />
          </>
        ) : null}
      </div>
      {mode === 'html' ? (
        <textarea
          value={htmlSource}
          onChange={(event) => handleHtmlSourceChange(event.target.value)}
          spellCheck={false}
          className="w-full px-4 py-3 min-h-[260px] font-mono text-xs bg-transparent border-0 outline-none resize-y"
        />
      ) : (
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none px-4 py-3 min-h-[260px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[250px]"
        />
      )}
    </div>
  )
}
