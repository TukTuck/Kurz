import { describe, expect, it } from 'vitest'
import { formatBytes, formatMemoryKB } from './format'

describe('formatMemoryKB', () => {
    it('renders values below 1 MB in KB', () => {
        expect(formatMemoryKB(512)).toBe('512 KB')
    })

    it('renders megabytes with one decimal below 100 MB', () => {
        expect(formatMemoryKB(1536)).toBe('1.5 MB')
        expect(formatMemoryKB(1024)).toBe('1 MB')
    })

    it('rounds large values to whole megabytes', () => {
        expect(formatMemoryKB(1024 * 250)).toBe('250 MB')
        expect(formatMemoryKB(1024 * 1024)).toBe('1024 MB')
    })

    it('never reports a raw KB number as MB', () => {
        // Regression: the tab tooltip used to print "<kb> MB"
        expect(formatMemoryKB(300 * 1024)).toBe('300 MB')
        expect(formatMemoryKB(300 * 1024)).not.toContain('307200')
    })

    it('handles invalid input', () => {
        expect(formatMemoryKB(0)).toBe('0 MB')
        expect(formatMemoryKB(-5)).toBe('0 MB')
        expect(formatMemoryKB(undefined)).toBe('0 MB')
        expect(formatMemoryKB(Number.NaN)).toBe('0 MB')
    })
})

describe('formatBytes', () => {
    it('scales through the units', () => {
        expect(formatBytes(0)).toBe('0 B')
        expect(formatBytes(999)).toBe('999 B')
        expect(formatBytes(2048)).toBe('2 KB')
        expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
    })

    it('handles invalid input', () => {
        expect(formatBytes(undefined)).toBe('0 B')
        expect(formatBytes(-1)).toBe('0 B')
    })
})
