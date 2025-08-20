import { describe, it, expect } from 'vitest'
import { parsePrTags } from '../src/inputs'

describe('parsePrTags', () => {
  it('returns empty array for empty or whitespace', () => {
    expect(parsePrTags('')).toEqual([])
    expect(parsePrTags('   ')).toEqual([])
    expect(parsePrTags(undefined as unknown as string)).toEqual([])
    expect(parsePrTags(null as unknown as string)).toEqual([])
  })

  it('parses JSON array string', () => {
    const input = '["Release: Skip", "Release: Minor"]'
    expect(parsePrTags(input)).toEqual(['Release: Skip', 'Release: Minor'])
  })

  it('parses newline-separated list', () => {
    const input = 'Release: Skip\nRelease: Minor\n\n'
    expect(parsePrTags(input)).toEqual(['Release: Skip', 'Release: Minor'])
  })

  it('trims whitespace around items', () => {
    const input = '  Release: Skip  \n  Release: Minor  '
    expect(parsePrTags(input)).toEqual(['Release: Skip', 'Release: Minor'])
  })

  it('treats single non-empty value as one tag', () => {
    expect(parsePrTags('Release: Patch')).toEqual(['Release: Patch'])
  })
})
