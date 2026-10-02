import { describe, expect, it } from 'vitest'
import {
    BRAVE_SHORTCUTS,
    SAFARI_SHORTCUTS,
    STANDARD_SHORTCUTS,
    getDefaultShortcutSettings,
    getPresetDisplayName,
    getShortcutsForPreset,
    isValidShortcut
} from './ShortcutPresets'

describe('shortcut presets', () => {
    it('returns a copy so callers cannot mutate the preset', () => {
        const first = getShortcutsForPreset('standard')
        first.newTab = 'Ctrl+X'
        expect(STANDARD_SHORTCUTS.newTab).toBe('CmdOrCtrl+T')
        expect(getShortcutsForPreset('standard').newTab).toBe('CmdOrCtrl+T')
    })

    it('maps every preset name', () => {
        expect(getShortcutsForPreset('safari')).toEqual(SAFARI_SHORTCUTS)
        expect(getShortcutsForPreset('brave')).toEqual(BRAVE_SHORTCUTS)
    })

    it('falls back to the standard preset for unknown values', () => {
        // 'custom' has no preset table - the renderer supplies its own bindings
        expect(getShortcutsForPreset('custom')).toEqual(STANDARD_SHORTCUTS)
        // @ts-expect-error - guarding against unexpected runtime values
        expect(getShortcutsForPreset('nonsense')).toEqual(STANDARD_SHORTCUTS)
    })

    it('exposes display names', () => {
        expect(getPresetDisplayName('brave')).toBe('Brave')
        expect(getPresetDisplayName('custom')).toBe('Custom')
    })

    it('defaults to the standard preset', () => {
        expect(getDefaultShortcutSettings()).toEqual({
            preset: 'standard',
            custom: { ...STANDARD_SHORTCUTS }
        })
    })
})

describe('isValidShortcut', () => {
    it('accepts modifier + key combinations', () => {
        expect(isValidShortcut('CmdOrCtrl+K')).toBe(true)
        expect(isValidShortcut('Ctrl+Shift+Tab')).toBe(true)
        expect(isValidShortcut('Alt+F4')).toBe(true)
        expect(isValidShortcut('F5')).toBe(true)
        expect(isValidShortcut('Shift+F5')).toBe(true)
    })

    it('rejects a bare key without modifiers', () => {
        expect(isValidShortcut('K')).toBe(false)
    })

    it('rejects unknown modifiers and keys', () => {
        expect(isValidShortcut('Hyper+K')).toBe(false)
        expect(isValidShortcut('Ctrl+F13')).toBe(false)
        expect(isValidShortcut('Ctrl+')).toBe(false)
    })

    it('rejects empty input', () => {
        expect(isValidShortcut('')).toBe(false)
        expect(isValidShortcut('   ')).toBe(false)
    })
})
