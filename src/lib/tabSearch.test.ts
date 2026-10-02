import { describe, expect, it } from 'vitest'
import type { SearchableTab } from './tabSearch'
import { getHostname, moveSelection, scoreTab, searchTabs, splitHighlight } from './tabSearch'

const tabs: SearchableTab[] = [
    { id: 't1', title: 'Perplexity – AI Search', url: 'https://www.perplexity.ai' },
    { id: 't2', title: 'ChatGPT', url: 'https://chatgpt.com/c/abc123' },
    { id: 't3', title: 'Claude', url: 'https://claude.ai/chat/xyz' },
    { id: 't4', title: 'New Thread', url: 'https://gemini.google.com/app' },
    { id: 't5', title: 'GitHub: TukTuck/Kurz', url: 'https://github.com/TukTuck/Kurz' }
]

describe('getHostname', () => {
    it('extracts the hostname of valid URLs', () => {
        expect(getHostname('https://www.perplexity.ai/search?q=1')).toBe('www.perplexity.ai')
    })

    it('returns an empty string for empty input', () => {
        expect(getHostname('')).toBe('')
        expect(getHostname(undefined)).toBe('')
    })

    it('falls back to the raw value for invalid URLs', () => {
        expect(getHostname('not a url')).toBe('not a url')
    })
})

describe('scoreTab', () => {
    it('scores an exact title match highest', () => {
        expect(scoreTab(tabs[1], 'chatgpt')).toBe(120)
    })

    it('scores a title prefix above a mid-title match', () => {
        const prefix = scoreTab(tabs[0], 'perplex')
        const substring = scoreTab(tabs[0], 'search')
        expect(prefix).toBeGreaterThan(substring)
        expect(substring).toBeGreaterThan(0)
    })

    it('matches on the URL even when the title does not contain the query', () => {
        // 'gemini' only appears in the URL of the "New Thread" tab
        expect(scoreTab(tabs[3], 'gemini')).toBeGreaterThan(0)
    })

    it('matches on the hostname', () => {
        expect(scoreTab(tabs[4], 'github.com')).toBeGreaterThan(0)
    })

    it('returns 0 for no match and for an empty query', () => {
        expect(scoreTab(tabs[1], 'nothingmatcheshere')).toBe(0)
        expect(scoreTab(tabs[1], '   ')).toBe(0)
    })

    it('is case insensitive', () => {
        expect(scoreTab(tabs[2], 'CLAUDE')).toBe(scoreTab(tabs[2], 'claude'))
    })
})

describe('searchTabs', () => {
    it('returns every tab (limited) for an empty query', () => {
        expect(searchTabs(tabs, '')).toHaveLength(tabs.length)
        expect(searchTabs(tabs, '   ')).toHaveLength(tabs.length)
        expect(searchTabs(tabs, '', { limit: 2 })).toHaveLength(2)
    })

    it('ranks the best match first', () => {
        expect(searchTabs(tabs, 'chatgpt')[0].id).toBe('t2')
        expect(searchTabs(tabs, 'claude')[0].id).toBe('t3')
    })

    it('finds tabs by URL', () => {
        expect(searchTabs(tabs, 'gemini.google.com').map(t => t.id)).toEqual(['t4'])
    })

    it('respects the limit', () => {
        expect(searchTabs(tabs, 'a', { limit: 1 })).toHaveLength(1)
    })

    it('returns an empty array when nothing matches', () => {
        expect(searchTabs(tabs, 'zzzzz')).toEqual([])
    })

    it('keeps the original order for equally scored matches', () => {
        // Both "New Thread" style titles score the same -> stable order
        const same: SearchableTab[] = [
            { id: 'a', title: 'Alpha', url: 'https://a.test' },
            { id: 'b', title: 'Alpha Two', url: 'https://b.test' },
            { id: 'c', title: 'Alpha Three', url: 'https://c.test' }
        ]
        expect(searchTabs(same, 'alpha').map(t => t.id)).toEqual(['a', 'b', 'c'])
    })

    it('does not mutate the input array', () => {
        const input = [...tabs]
        searchTabs(input, 'claude')
        expect(input).toEqual(tabs)
    })
})

describe('splitHighlight', () => {
    it('splits matched and unmatched segments', () => {
        expect(splitHighlight('ChatGPT', 'gpt')).toEqual([
            { text: 'Chat', isMatch: false },
            { text: 'GPT', isMatch: true }
        ])
    })

    it('is case insensitive', () => {
        expect(splitHighlight('ChatGPT', 'chatgpt')).toEqual([{ text: 'ChatGPT', isMatch: true }])
    })

    it('returns a single unmatched segment when there is no match', () => {
        expect(splitHighlight('Claude', 'gpt')).toEqual([{ text: 'Claude', isMatch: false }])
    })

    it('handles empty input', () => {
        expect(splitHighlight('', 'x')).toEqual([{ text: '', isMatch: false }])
        expect(splitHighlight('Claude', '')).toEqual([{ text: 'Claude', isMatch: false }])
    })

    it('only highlights the first occurrence', () => {
        expect(splitHighlight('a a a', 'a')).toEqual([
            { text: 'a', isMatch: true },
            { text: ' a a', isMatch: false }
        ])
    })
})

describe('moveSelection', () => {
    it('wraps around at the end', () => {
        expect(moveSelection(2, 1, 3)).toBe(0)
    })

    it('wraps around at the start', () => {
        expect(moveSelection(0, -1, 3)).toBe(2)
    })

    it('selects the first item from an empty selection', () => {
        expect(moveSelection(-1, 1, 3)).toBe(0)
    })

    it('selects the last item when moving up from an empty selection', () => {
        expect(moveSelection(-1, -1, 3)).toBe(2)
    })

    it('returns -1 for an empty list', () => {
        expect(moveSelection(0, 1, 0)).toBe(-1)
    })

    it('moves normally inside the list', () => {
        expect(moveSelection(0, 1, 5)).toBe(1)
        expect(moveSelection(3, -1, 5)).toBe(2)
    })
})
