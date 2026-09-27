/**
 * Formatting helpers shared by the renderer.
 * Kept free of React so they can be unit tested.
 */

/**
 * Format a memory value that the main process reports in kilobytes.
 *
 * The main process sends KB (field name `memoryKB`) - rendering that number with a
 * "MB" label used to inflate every tab by a factor of 1024.
 */
export function formatMemoryKB(kb: number | undefined | null): string {
    if (kb === undefined || kb === null || !Number.isFinite(kb) || kb <= 0) {
        return '0 MB';
    }

    if (kb < 1024) {
        return `${Math.round(kb)} KB`;
    }

    const mb = kb / 1024;
    // Keep small values precise, avoid long decimals for large ones
    return `${mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

/** Format a byte count as a short human readable string (e.g. "1.4 MB") */
export function formatBytes(bytes: number | undefined | null): string {
    if (bytes === undefined || bytes === null || !Number.isFinite(bytes) || bytes <= 0) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, exponent);
    const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${rounded} ${units[exponent]}`;
}
