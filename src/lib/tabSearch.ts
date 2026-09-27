/**
 * Pure helpers for the "search open tabs" palette.
 *
 * Deliberately free of Electron and React imports so the logic can be unit tested
 * (see tabSearch.test.ts) and reused by any renderer.
 */

/** Minimal shape a tab needs to be searchable */
export interface SearchableTab {
    id: string;
    title: string;
    url: string;
}

export interface TabSearchOptions {
    /** Maximum number of results (default: 8) */
    limit?: number;
}

/** A piece of text, optionally marked as part of the current match */
export interface HighlightSegment {
    text: string;
    isMatch: boolean;
}

export const DEFAULT_TAB_SEARCH_LIMIT = 8;

/** Relative weights - higher means a better match */
const SCORES = {
    titleExact: 120,
    titlePrefix: 90,
    titleWordStart: 70,
    titleSubstring: 45,
    hostnameSubstring: 35,
    urlSubstring: 30
} as const;

function normalize(value: string | undefined | null): string {
    return (value ?? '').toLowerCase().trim();
}

/**
 * Score a single field against the (already normalized) query.
 * Returns 0 when the field does not contain the query.
 */
function scoreField(field: string, query: string, scores: { exact: number; prefix: number; wordStart: number; substring: number }): number {
    if (!field) return 0;

    if (field === query) return scores.exact;
    if (field.startsWith(query)) return scores.prefix;

    // Word-boundary match ("chat" matches "ChatGPT - New Chat" better than a mid-word hit)
    const wordStart = new RegExp(`\\b${escapeRegExp(query)}`, 'i');
    if (wordStart.test(field)) return scores.wordStart;

    if (field.includes(query)) return scores.substring;

    return 0;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extract the hostname of a URL, tolerating invalid URLs */
export function getHostname(url: string | undefined | null): string {
    if (!url) return '';
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

/**
 * Score one tab against the query (0 = no match).
 * Title matches always beat URL matches.
 */
export function scoreTab(tab: SearchableTab, query: string): number {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return 0;

    const titleScore = scoreField(normalize(tab.title), normalizedQuery, {
        exact: SCORES.titleExact,
        prefix: SCORES.titlePrefix,
        wordStart: SCORES.titleWordStart,
        substring: SCORES.titleSubstring
    });

    const url = normalize(tab.url);
    const urlScore = scoreField(url, normalizedQuery, {
        exact: SCORES.titlePrefix,
        prefix: SCORES.titlePrefix,
        wordStart: SCORES.urlSubstring,
        substring: SCORES.urlSubstring
    });

    const hostname = normalize(getHostname(tab.url));
    const hostnameScore = hostname.includes(normalizedQuery) ? SCORES.hostnameSubstring : 0;

    return Math.max(titleScore, urlScore, hostnameScore);
}

/**
 * Filter and rank tabs for the given query.
 *
 * - Empty query: returns the tabs unchanged (limited to `options.limit`)
 * - Otherwise: best matches first, ties keep the original order (stable)
 */
export function searchTabs<T extends SearchableTab>(
    tabs: readonly T[],
    query: string,
    options: TabSearchOptions = {}
): T[] {
    const limit = options.limit ?? DEFAULT_TAB_SEARCH_LIMIT;
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
        return tabs.slice(0, Math.max(0, limit));
    }

    return tabs
        .map((tab, index) => ({ tab, index, score: scoreTab(tab, normalizedQuery) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => (b.score - a.score) || (a.index - b.index))
        .slice(0, Math.max(0, limit))
        .map(entry => entry.tab);
}

/**
 * Split `text` into matched / unmatched segments for highlighting.
 * Case-insensitive, first occurrence only. Returns a single unmatched segment
 * when there is nothing to highlight.
 */
export function splitHighlight(text: string, query: string): HighlightSegment[] {
    const value = text ?? '';
    const needle = (query ?? '').trim();
    if (!needle || !value) {
        return [{ text: value, isMatch: false }];
    }

    const index = value.toLowerCase().indexOf(needle.toLowerCase());
    if (index === -1) {
        return [{ text: value, isMatch: false }];
    }

    const segments: HighlightSegment[] = [];
    if (index > 0) {
        segments.push({ text: value.slice(0, index), isMatch: false });
    }
    segments.push({ text: value.slice(index, index + needle.length), isMatch: true });
    if (index + needle.length < value.length) {
        segments.push({ text: value.slice(index + needle.length), isMatch: false });
    }
    return segments;
}

/**
 * Move a selection cursor inside a list of `length` items, wrapping around.
 * `current` may be -1 (nothing selected yet): ArrowDown selects the first item,
 * ArrowUp selects the last one. Returns -1 for an empty list.
 */
export function moveSelection(current: number, delta: number, length: number): number {
    if (length <= 0) return -1;
    if (current < 0) {
        return delta < 0 ? length - 1 : 0;
    }
    const next = (current + delta) % length;
    return next < 0 ? next + length : next;
}
