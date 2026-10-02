import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import TabSearchOverlay from './TabSearchOverlay'

const tabs = [
    { id: 't1', title: 'Perplexity – AI Search', url: 'https://www.perplexity.ai' },
    { id: 't2', title: 'ChatGPT', url: 'https://chatgpt.com/c/abc123' },
    { id: 't3', title: 'Claude', url: 'https://claude.ai/chat/xyz' }
]

function render(overrides: Partial<Parameters<typeof TabSearchOverlay>[0]> = {}) {
    return renderToStaticMarkup(
        <TabSearchOverlay
            tabs={tabs}
            activeTabId="t2"
            onSelectTab={() => { /* noop */ }}
            onClose={() => { /* noop */ }}
            {...overrides}
        />
    )
}

describe('TabSearchOverlay', () => {
    it('renders the search field and every open tab for an empty query', () => {
        const html = render()

        expect(html).toContain('Search open tabs by title or URL...')
        expect(html).toContain('Perplexity')
        expect(html).toContain('ChatGPT')
        expect(html).toContain('Claude')
    })

    it('renders the keyboard hints', () => {
        const html = render()
        expect(html).toContain('navigate')
        expect(html).toContain('open')
        expect(html).toContain('close')
    })

    it('shows a message when there is nothing to render', () => {
        const html = render({ tabs: [] })
        expect(html).toContain('No matching tabs')
    })

    it('does not throw for tabs without a url', () => {
        expect(() => render({ tabs: [{ id: 'x', title: 'No URL', url: '' }] })).not.toThrow()
    })

    it('keeps the callbacks wired to props', () => {
        const onSelectTab = vi.fn()
        const onClose = vi.fn()

        // Rendering must not call the callbacks by itself
        render({ onSelectTab, onClose })
        expect(onSelectTab).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
    })
})
