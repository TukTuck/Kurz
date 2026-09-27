import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { SearchableTab } from '../lib/tabSearch'
import { moveSelection, searchTabs, splitHighlight, getHostname } from '../lib/tabSearch'

interface TabSearchOverlayProps {
    tabs: SearchableTab[]
    activeTabId?: string | null
    onSelectTab: (tabId: string) => void
    onClose: () => void
}

/**
 * Floating palette to jump to any open tab (Ctrl+Shift+K).
 *
 * The web content is detached by the main process while this is open, so the
 * overlay is fully visible and receives keyboard input.
 */
export default function TabSearchOverlay({ tabs, activeTabId, onSelectTab, onClose }: TabSearchOverlayProps) {
    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    const results = useMemo(() => searchTabs(tabs, query), [tabs, query])

    // Reset the cursor whenever the result list changes
    useEffect(() => {
        setSelectedIndex(0)
    }, [query])

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const choose = (index: number) => {
        const tab = results[index]
        if (!tab) return
        onSelectTab(tab.id)
        onClose()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(current => moveSelection(current, 1, results.length))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(current => moveSelection(current, -1, results.length))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            choose(selectedIndex)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 pt-[15vh]"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="w-[560px] max-w-[90vw] overflow-hidden rounded-xl border border-[#3e3e42] bg-[#252526] shadow-2xl">
                {/* Search field */}
                <div className="flex items-center gap-3 border-b border-[#3e3e42] px-4 py-3">
                    <Search size={18} className="text-zinc-400" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search open tabs by title or URL..."
                        className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                        spellCheck={false}
                        autoComplete="off"
                    />
                    <span className="text-xs text-zinc-500">{results.length}</span>
                </div>

                {/* Results */}
                <div className="max-h-[320px] overflow-y-auto py-1">
                    {results.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-zinc-500">
                            No matching tabs
                        </div>
                    ) : (
                        results.map((tab, index) => {
                            const isActive = tab.id === activeTabId
                            const isSelected = index === selectedIndex
                            const hostname = getHostname(tab.url)

                            return (
                                <button
                                    key={tab.id}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    onClick={() => choose(index)}
                                    className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${isSelected ? 'bg-violet-600/30' : 'hover:bg-[#2a2a2a]'
                                        }`}
                                >
                                    <span
                                        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isActive ? 'bg-violet-400' : 'bg-transparent'
                                            }`}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm text-white">
                                            {splitHighlight(tab.title || 'New Thread', query).map((segment, i) =>
                                                segment.isMatch ? (
                                                    <mark key={i} className="bg-transparent font-semibold text-violet-300">
                                                        {segment.text}
                                                    </mark>
                                                ) : (
                                                    <span key={i}>{segment.text}</span>
                                                )
                                            )}
                                        </span>
                                        {hostname && (
                                            <span className="block truncate text-xs text-zinc-500">{hostname}</span>
                                        )}
                                    </span>
                                    {isActive && <span className="flex-shrink-0 text-xs text-zinc-500">current</span>}
                                </button>
                            )
                        })
                    )}
                </div>

                {/* Footer hints */}
                <div className="flex items-center gap-4 border-t border-[#3e3e42] px-4 py-2 text-xs text-zinc-500">
                    <span><kbd className="text-zinc-400">↑</kbd> <kbd className="text-zinc-400">↓</kbd> navigate</span>
                    <span><kbd className="text-zinc-400">Enter</kbd> open</span>
                    <span><kbd className="text-zinc-400">Esc</kbd> close</span>
                </div>
            </div>
        </div>
    )
}
