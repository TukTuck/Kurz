import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // Node environment: we only unit test pure logic (no React/DOM needed)
        environment: 'node',
        include: ['src/**/*.test.{ts,tsx}', 'electron/**/*.test.ts'],
        reporters: 'default'
    }
})
