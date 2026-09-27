import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

// The manager only needs app.getPath('userData') - point it at a temp dir.
// The factory is evaluated lazily, so the global is set before any manager is built.
vi.mock('electron', () => ({
    app: {
        getPath: (name: string) => {
            const dir = (globalThis as unknown as { __KURZ_USER_DATA__?: string }).__KURZ_USER_DATA__
            if (!dir) throw new Error(`[test] userData dir not initialised (getPath: ${name})`)
            return dir
        }
    }
}))

import SettingsManager from './SettingsManager'
import type { Settings } from './types'

let userDataDir = ''

function writeSettings(data: unknown): void {
    fs.writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify(data), 'utf-8')
}

function readSettings(): Settings {
    return JSON.parse(fs.readFileSync(path.join(userDataDir, 'settings.json'), 'utf-8')) as Settings
}

beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurz-settings-'))
    ;(globalThis as unknown as { __KURZ_USER_DATA__?: string }).__KURZ_USER_DATA__ = userDataDir
})

afterAll(() => {
    delete (globalThis as unknown as { __KURZ_USER_DATA__?: string }).__KURZ_USER_DATA__
})

describe('SettingsManager - first run', () => {
    it('creates a settings file with the defaults', () => {
        const manager = new SettingsManager()
        const settings = manager.getSettings()

        expect(settings.profiles.map(p => p.id)).toEqual(['work', 'personal'])
        expect(settings.defaultProviderId).toBe('perplexity')
        expect(fs.existsSync(path.join(userDataDir, 'settings.json'))).toBe(true)
    })

    it('exposes sensible security defaults', () => {
        const settings = new SettingsManager().getSettings()
        expect(settings.security?.downloadsEnabled).toBe(true)
        expect(settings.security?.askWhereToSave).toBe(false)
        expect(settings.adBlock?.enabled).toBe(true)
    })
})

describe('SettingsManager - loading', () => {
    it('merges stored values over the defaults', () => {
        writeSettings({ defaultProfileId: 'personal', aiProviders: [] })

        const settings = new SettingsManager().getSettings()

        expect(settings.defaultProfileId).toBe('personal')
        // untouched keys keep their defaults
        expect(settings.profiles.map(p => p.id)).toEqual(['work', 'personal'])
        expect(settings.general?.hardwareAcceleration).toBe(true)
    })

    it('backfills the provider color field for providers saved without one', () => {
        writeSettings({
            aiProviders: [{ id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai', icon: '' }]
        })

        const settings = new SettingsManager().getSettings()
        const provider = settings.aiProviders.find(p => p.id === 'perplexity')

        expect(provider?.color).toBe('#191A1A')
    })

    it('uses a fallback color for unknown custom providers', () => {
        writeSettings({
            aiProviders: [{ id: 'custom-1', name: 'Custom', url: 'https://example.com', icon: '' }]
        })

        const settings = new SettingsManager().getSettings()
        expect(settings.aiProviders.find(p => p.id === 'custom-1')?.color).toBe('#191A1A')
    })

    it('migrates emoji profile icons to lucide icon names', () => {
        writeSettings({
            profiles: [
                { id: 'work', name: 'Work', icon: '💼' },
                { id: 'research', name: 'Research', icon: '👤' },
                { id: 'other', name: 'Other', icon: 'briefcase' }
            ]
        })

        const profiles = new SettingsManager().getSettings().profiles

        expect(profiles.find(p => p.id === 'work')?.icon).toBe('briefcase')
        expect(profiles.find(p => p.id === 'work')?.color).toBe('#3b82f6')
        expect(profiles.find(p => p.id === 'research')?.icon).toBe('user')
        // already migrated profiles are left untouched
        expect(profiles.find(p => p.id === 'other')?.icon).toBe('briefcase')
    })

    it('adds a color to profiles that have none', () => {
        writeSettings({ profiles: [{ id: 'work', name: 'Work', icon: 'briefcase' }] })

        expect(new SettingsManager().getSettings().profiles[0].color).toBe('#3b82f6')
    })

    it('falls back to defaults when the file is corrupted', () => {
        fs.writeFileSync(path.join(userDataDir, 'settings.json'), '{ not json', 'utf-8')

        const settings = new SettingsManager().getSettings()
        expect(settings.profiles.map(p => p.id)).toEqual(['work', 'personal'])
    })
})

describe('SettingsManager - saving', () => {
    it('persists partial updates without dropping other sections', () => {
        const manager = new SettingsManager()

        const ok = manager.saveSettings({ profiles: [{ id: 'solo', name: 'Solo', icon: 'user', color: '#ffffff' }] })

        expect(ok).toBe(true)
        const stored = readSettings()
        expect(stored.profiles.map(p => p.id)).toEqual(['solo'])
        expect(stored.general?.hardwareAcceleration).toBe(true)
        expect(stored.adBlock?.enabled).toBe(true)
    })

    it('reports the saved values on the next read', () => {
        const manager = new SettingsManager()
        manager.saveSettings({ defaultProviderId: 'claude' })

        expect(new SettingsManager().getDefaultProviderId()).toBe('claude')
    })
})
