/**
 * Common string and array utilities to reduce duplication across the codebase
 */

export const StringUtils = {
  /**
   * Convert unknown input to string or undefined if empty/null
   */
  strOrUndefined(v: unknown): string | undefined {
    if (v == null) return undefined
    const s = String(v).trim()
    return s.length ? s : undefined
  },

  /**
   * Parse boolean from various string representations
   */
  parseBool(v: unknown): boolean | undefined {
    const s = StringUtils.strOrUndefined(v)
    if (s == null) return undefined
    const lc = s.toLowerCase()
    if (lc === 'true' || lc === '1' || lc === 'yes') return true
    if (lc === 'false' || lc === '0' || lc === 'no') return false
    return undefined
  },

  /**
   * Trim and filter empty strings from array
   */
  trimAndFilter(items: string[]): string[] {
    return items.map(s => s.trim()).filter(s => s.length > 0)
  },

  /**
   * Parse newline-separated list from input
   */
  parseNewlineList(v: unknown): string[] {
    const s = StringUtils.strOrUndefined(v)
    if (!s) return []
    return StringUtils.trimAndFilter(s.split('\n'))
  },

  /**
   * Parse topic list supporting both arrays and comma/newline separated strings
   */
  parseTopicList(v: unknown): string[] {
    if (Array.isArray(v)) {
      return StringUtils.trimAndFilter(
        v.map((x) => (x == null ? '' : String(x)))
      )
    }
    const s = StringUtils.strOrUndefined(v)
    if (!s) return []
    return StringUtils.trimAndFilter(s.split(/[\n,]/g))
  },

  /**
   * Parse PR tags supporting JSON arrays or newline-separated strings
   */
  parsePrTags(input: unknown): string[] {
    if (input == null) return []
    const raw = String(input).trim()
    if (!raw) return []

    // Try JSON array first
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return StringUtils.trimAndFilter(
          parsed.map((v) => (v == null ? '' : String(v)))
        )
      }
    } catch {}

    // Fallback: newline-separated string (or single value)
    const items = raw.includes('\n') ? raw.split('\n') : [raw]
    return StringUtils.trimAndFilter(items)
  }
}

export const ArrayUtils = {
  /**
   * Deduplicate array while preserving order
   */
  dedupe<T>(items: T[], keyFn: (item: T) => string = String): T[] {
    const seen = new Set<string>()
    return items.filter(item => {
      const key = keyFn(item)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  },

  /**
   * Deduplicate string array preserving order
   */
  dedupeStrings(items: string[]): string[] {
    return ArrayUtils.dedupe(items)
  }
}

/**
 * Generic input parser factory for creating type-safe input parsers
 */
export function createInputParser<T>(
  parseFn: (input: unknown) => T,
  fallbackKeys: string[] = []
) {
  return (raw: Record<string, any>, primaryKey: string, additionalFallbacks?: string[]): T => {
    const keys = [primaryKey, ...fallbackKeys, ...(additionalFallbacks || [])]
    for (const key of keys) {
      const result = parseFn(raw[key])
      if (result !== undefined && result !== null) return result
    }
    return parseFn(undefined)
  }
}
