/**
 * ADB Terminal Component
 * Terminale interattivo per inviare comandi ADB al dispositivo
 * Single source of truth: commandLogs dallo store
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal,
  ChevronUp,
  ChevronDown,
  Send,
  Trash2,
  Maximize2,
  Minimize2,
  Download,
  AlertCircle,
  ChevronRight
} from 'lucide-react'
import { useAdbStore } from '@/stores/adbStore'
import { useAdb } from '@/hooks/useAdb'
import { useTranslation } from '@/stores/i18nStore'
import { validateTerminalCommand } from '@/services/command-sanitizer'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface AdbTerminalProps {
  sidebarOffset?: string
}

interface TerminalLine {
  id: string
  type: 'command' | 'output' | 'error' | 'info'
  content: string
}

export function AdbTerminal({ sidebarOffset = '0px' }: AdbTerminalProps) {
  const { isConnected, commandLogs, totalCommands, downloadFullLog } = useAdbStore()
  const { shell } = useAdb()
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  const [isOpen, setIsOpen] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isExecuting, setIsExecuting] = useState(false)
  const [pendingCommand, setPendingCommand] = useState<string | null>(null)
  const [clearedBeforeId, setClearedBeforeId] = useState<string | null>(null)

  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const autoScrollRef = useRef(true)

  // Filter logs based on clear point AND limit to last 100 for UI performance
  const visibleLogs = useMemo(() => {
    let logs = commandLogs
    if (clearedBeforeId) {
      const idx = logs.findIndex(l => l.id === clearedBeforeId)
      if (idx !== -1) {
        logs = logs.slice(0, idx)
      }
    }
    // Only show last 100 in terminal UI
    return logs.slice(0, 100)
  }, [commandLogs, clearedBeforeId])

  // Derive terminal lines from commandLogs (single source of truth)
  // commandLogs is newest-first, reverse for chronological display
  const terminalLines = useMemo(() => {
    const reversed = [...visibleLogs].reverse()
    return reversed.flatMap(log => {
      const lines: TerminalLine[] = [{
        id: `${log.id}-cmd`,
        type: 'command',
        content: log.command
      }]
      if (log.message && log.message.trim()) {
        lines.push({
          id: `${log.id}-out`,
          type: log.result === 'error' ? 'error' : (log.result === 'pending' ? 'info' : 'output'),
          content: log.message
        })
      }
      return lines
    })
  }, [visibleLogs])

  // Auto-scroll to bottom when new content or terminal opens
  useEffect(() => {
    if (terminalRef.current && isOpen && autoScrollRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLines, pendingCommand, isOpen])

  // Track if user scrolled up manually
  const handleScroll = useCallback(() => {
    if (!terminalRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40
  }, [])

  // Focus input when terminal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const executeCommand = useCallback(async () => {
    if (!inputValue.trim() || isExecuting || !isConnected) return

    const command = inputValue.trim()
    setInputValue('')
    setHistoryIndex(-1)
    autoScrollRef.current = true

    // Add to history
    setCommandHistory(prev => [command, ...prev.filter(c => c !== command)].slice(0, 50))

    // Validate command against whitelist before execution
    const validation = validateTerminalCommand(command)
    if (!validation.isValid) {
      // Log the blocked command attempt
      const { addCommandLog } = useAdbStore.getState()
      addCommandLog({
        command,
        result: 'error',
        message: `🛡️ BLOCKED: ${validation.reason}`
      })
      return
    }

    setIsExecuting(true)
    setPendingCommand(command)

    try {
      await shell(validation.sanitizedCommand)
      // shell() calls addCommandLog() which updates commandLogs → terminalLines auto-updates
    } catch {
      // Error already logged by shell() via addCommandLog
    } finally {
      setPendingCommand(null)
      setIsExecuting(false)
    }
  }, [inputValue, isExecuting, isConnected, shell])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setInputValue(commandHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInputValue(commandHistory[newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setInputValue('')
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      clearTerminal()
    }
  }

  const clearTerminal = () => {
    if (commandLogs.length > 0) {
      setClearedBeforeId(commandLogs[0].id)
    }
    autoScrollRef.current = true
  }

  const commandCount = visibleLogs.length

  if (!isConnected) return null

  return (
    <>
      {/* Mobile Floating Button / Desktop Bottom Bar */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            className={`fixed z-40 ${isMobile ? 'bottom-6 right-6' : 'bottom-0 right-0'}`}
            style={isMobile ? {} : { left: sidebarOffset }}
          >
            {isMobile ? (
              <button
                onClick={() => setIsOpen(true)}
                className="group relative w-14 h-14 bg-accent-500 rounded-full shadow-2xl shadow-accent-500/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200"
              >
                <Terminal className="w-6 h-6 text-white" strokeWidth={2} />
                {commandCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[#161b22]">
                    {commandCount}
                  </span>
                )}
                {/* Visual pulse for feedback */}
                <div className="absolute inset-0 rounded-full bg-accent-500 animate-ping opacity-20 pointer-events-none" />
              </button>
            ) : (
              <button
                onClick={() => setIsOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-4
                  bg-[#0d1117] dark:bg-[#0d1117] light:bg-[#f6f8fa] border-t border-[#30363d] dark:border-[#30363d] light:border-surface-200 text-[#58a6ff]
                  hover:bg-[#161b22] dark:hover:bg-[#161b22] light:hover:bg-surface-100 transition-colors"
              >
                <Terminal className="w-4 h-4" strokeWidth={1.5} />
                <span className="text-sm font-mono">{t('terminal.title')}</span>
                <ChevronUp className="w-4 h-4" strokeWidth={1.5} />
                {commandCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-[#238636] text-white rounded">
                    {commandCount}
                  </span>
                )}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terminal Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for Mobile */}
            {isMobile && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
              />
            )}

            <motion.div
              initial={isMobile ? { y: '100%', opacity: 0 } : { y: '100%' }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`fixed bottom-0 right-0 z-[60] flex flex-col
                bg-white dark:bg-[#0d1117] border-surface-200 dark:border-[#30363d] shadow-2xl
                ${isMobile ? 'bottom-4 right-4 left-4 h-[90vh] rounded-[2rem] border overflow-hidden' : `border-t ${isMaximized ? 'h-[80vh]' : 'h-80'}`}
              `}
              style={isMobile ? {} : { left: sidebarOffset }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-[#30363d] bg-surface-50 dark:bg-[#161b22]">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-accent-500/10 ${isMobile ? 'block' : 'hidden md:block'}`}>
                    <Terminal className="w-4 h-4 text-accent-500 dark:text-[#58a6ff]" strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold font-mono text-surface-900 dark:text-[#c9d1d9] leading-none">{t('terminal.title')}</span>
                    <span className="text-[10px] text-surface-500 dark:text-[#8b949e] font-mono mt-1">
                      {commandCount} {t('terminal.commandsSuffix')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={downloadFullLog}
                    className="p-1.5 rounded-xl hover:bg-surface-200 dark:hover:bg-[#30363d] text-surface-500 dark:text-[#8b949e] transition-colors"
                    title={t('terminal.downloadLog')}
                  >
                    <Download className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={clearTerminal}
                    className="p-1.5 rounded-xl hover:bg-surface-200 dark:hover:bg-[#30363d] text-surface-500 dark:text-[#8b949e] transition-colors"
                    title={t('terminal.clear')}
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  {!isMobile && (
                    <button
                      onClick={() => setIsMaximized(!isMaximized)}
                      className="p-1.5 rounded-xl hover:bg-surface-200 dark:hover:bg-[#30363d] text-surface-500 dark:text-[#8b949e] transition-colors"
                      title={isMaximized ? t('terminal.minimize') : t('terminal.maximize')}
                    >
                      {isMaximized ? <Minimize2 className="w-4 h-4" strokeWidth={1.5} /> : <Maximize2 className="w-4 h-4" strokeWidth={1.5} />}
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-surface-200 dark:hover:bg-[#30363d] text-surface-500 dark:text-[#8b949e] transition-colors"
                    title={t('terminal.close')}
                  >
                    <ChevronDown className="w-5 h-5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {/* Terminal Output */}
              <div
                ref={terminalRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto overflow-x-auto p-4 lg:p-6 font-mono text-sm bg-surface-50/30 dark:bg-black/20"
              >
                {terminalLines.length === 0 && !pendingCommand ? (
                  <div className="h-full flex flex-col items-center justify-center text-[#8b949e] opacity-50 space-y-4">
                    <Terminal className="w-12 h-12" strokeWidth={1} />
                    <div className="text-center">
                      <p className="font-medium">{t('terminal.ready')}</p>
                      <p className="text-xs mt-1">{t('terminal.instructions')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Notice for hidden logs */}
                    {totalCommands > 100 && visibleLogs.length === 100 && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-accent-500/5 border border-accent-500/20 text-xs text-surface-500 dark:text-[#8b949e]">
                        <AlertCircle className="w-4 h-4 text-accent-500" strokeWidth={1.5} />
                        <span>
                          {t('terminal.hiddenLogsNotice') || 'Some previous commands are hidden.'}
                          <button
                            onClick={downloadFullLog}
                            className="ml-2 text-accent-500 hover:underline font-bold"
                          >
                            {t('terminal.downloadLog')}
                          </button>
                        </span>
                      </div>
                    )}

                    {terminalLines.map((line) => (
                      <TerminalRow key={line.id} line={line} />
                    ))}
                    {pendingCommand && (
                      <div className="animate-pulse">
                        <div className="flex items-start gap-2">
                          <span className="text-accent-500 dark:text-[#58a6ff] select-none shrink-0 font-bold">$</span>
                          <span className="text-emerald-500 font-semibold">{pendingCommand}</span>
                        </div>
                        <div className="text-surface-400 text-[10px] pl-5 mt-1 italic">
                          {t('terminal.executing')}...
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Input */}
              <div className={`
                flex items-center gap-3 px-4 py-4 border-t border-surface-200 dark:border-[#30363d] bg-surface-50 dark:bg-[#161b22]
                ${isMobile ? 'pb-8' : ''}
              `}>
                <div className="flex items-center justify-center w-6 h-6 rounded bg-accent-500/10">
                  <span className="text-accent-500 font-bold font-mono text-sm leading-none">$</span>
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('terminal.placeholder')}
                  disabled={isExecuting}
                  className="flex-1 bg-transparent border-none outline-none text-emerald-600 dark:text-[#39d353] font-mono text-sm
                    placeholder:text-surface-400 dark:placeholder:text-[#484f58] disabled:opacity-50"
                  style={{ textShadow: inputValue ? '0 0 10px rgba(52, 211, 153, 0.3)' : 'none' }}
                />
                <button
                  onClick={executeCommand}
                  disabled={!inputValue.trim() || isExecuting}
                  className="w-10 h-10 rounded-xl bg-accent-500 hover:bg-accent-600 text-white flex items-center justify-center
                    disabled:opacity-50 disabled:bg-surface-300 dark:disabled:bg-surface-800 transition-all duration-200 shadow-lg shadow-accent-500/20 active:scale-90"
                >
                  <Send className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function TerminalRow({ line }: { line: TerminalLine }) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const isLarge = line.content.length > 500 || line.content.split('\n').length > 5

  if (line.type === 'command') {
    return (
      <div className="flex items-start gap-2">
        <span className="text-accent-500 dark:text-[#58a6ff] select-none shrink-0 font-bold">$</span>
        <span className="text-emerald-600 dark:text-[#39d353] font-semibold break-all">
          {line.content}
        </span>
      </div>
    )
  }

  const content = isExpanded ? line.content : line.content.split('\n').slice(0, 5).join('\n').substring(0, 500)
  const hasMore = isLarge && !isExpanded

  return (
    <div className="relative group/row">
      <pre className={`
        whitespace-pre-wrap pl-5 text-xs leading-relaxed break-words font-mono transition-all duration-300
        ${line.type === 'output' ? 'text-surface-600 dark:text-[#c9d1d9]' : ''}
        ${line.type === 'error' ? 'text-red-500 dark:text-[#f85149] bg-red-500/5 px-2 py-1 rounded' : ''}
        ${line.type === 'info' ? 'text-surface-400 dark:text-[#8b949e] italic' : ''}
        ${isLarge ? 'cursor-pointer hover:bg-accent-500/5 rounded p-1 -ml-1 pl-6' : ''}
      `}
        onClick={() => isLarge && setIsExpanded(!isExpanded)}
      >
        {content}
        {hasMore && (
          <span className="text-accent-500 font-bold ml-1 animate-pulse">
            ... {t('terminal.clickForMore') || '[Click for more]'}
          </span>
        )}
      </pre>

      {isLarge && (
        <div className="absolute left-0 top-1.5">
          <ChevronRight className={`w-3.5 h-3.5 text-accent-500/50 transition-transform ${isExpanded ? 'rotate-90' : ''}`} strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}
