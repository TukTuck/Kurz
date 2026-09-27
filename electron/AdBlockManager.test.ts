import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

// The Ghostery package pulls in Electron internals at import time - stub it out,
// the whitelist logic under test does not need a real engine.
vi.mock('@ghostery/adblocker-electron', () => ({
    ElectronBlocker: class ElectronBlocker {
        static deserialize() {
            return new ElectronBlocker()
        }
        static parse() {
            return new ElectronBlocker()
        }
        enableBlockingInSession() { /* noop */ }
        disableBlockingInSession() { /* noop */ }
        getCosmeticsFilters() {
            return { styles: [] }
        }
    }
}))

vi.mock('electron', () => ({
    app: {
        getPath: (name: string) => {
            const dir = (globalThis as unknown as { __KURZ_USER_DATA__?: string }).__KURZ_USER_DATA__
            if (!dir) throw new Error(`[test] userData dir not initialised (getPath: ${name})`)
            return dir
        }
    },
    session: {
        fromPartition: () => ({})
    }
}))

import AdBlockManager from './AdBlockManager'
import type SettingsManager from './SettingsManager'

function fakeSettingsManager(whitelist: string[]): SettingsManager {
    return {
        getSettings: () => ({ adBlock: { enabled: true, whitelist } })
    } as unknown as SettingsManager
}

let userDataDir = ''

beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurz-adblock-'))
    ;(globalThis as unknown as { __KURZ_USER_DATA__?: string }).__KURZ_USER_DATA__ = userDataDir
})

describe('AdBlockManager.isWhitelisted', () => {
    // Built inside the suite so the mocked userData dir from beforeEach exists
    let manager: AdBlockManager

    beforeEach(() => {
        manager = new AdBlockManager(fakeSettingsManager([]))
    })

    it('matches an exact domain', () => {
        expect(manager.isWhitelisted('https://example.com/ads.js', ['example.com'])).toBe(true)
    })

    it('matches subdomains', () => {
        expect(manager.isWhitelisted('https://cdn.example.com/x.png', ['example.com'])).toBe(true)
    })

    it('does not match a domain that merely ends with the entry', () => {
        expect(manager.isWhitelisted('https://notexample.com/', ['example.com'])).toBe(false)
    })

    it('ignores a leading www. on both sides', () => {
        expect(manager.isWhitelisted('https://www.example.com/', ['example.com'])).toBe(true)
        expect(manager.isWhitelisted('https://example.com/', ['www.example.com'])).toBe(true)
    })

    it('is case insensitive', () => {
        expect(manager.isWhitelisted('https://EXAMPLE.com/', ['example.COM'])).toBe(true)
    })

    it('returns false for an empty whitelist', () => {
        expect(manager.isWhitelisted('https://example.com/', [])).toBe(false)
    })

    it('returns false for invalid URLs', () => {
        expect(manager.isWhitelisted('::::', ['example.com'])).toBe(false)
    })

    it('does not throw when the whitelist is undefined', () => {
        expect(manager.isWhitelisted('https://example.com/', undefined as unknown as string[])).toBe(false)
    })
})
