import { describe, it, expect } from 'vitest'
import { normalizeActionInputs, type NormalizedInputs } from '../src/inputs'
import { resolveConfigPath } from '../src/main'

describe('resolveConfigPath', () => {
  it('uses explicit CONFIG_PATH when provided', () => {
    const n: NormalizedInputs = normalizeActionInputs({ CONFIG_PATH: '.github/sync-test-1.yml' })
    expect(resolveConfigPath(n)).toBe('.github/sync-test-1.yml')
  })

  it('falls back to default when not provided', () => {
    const n: NormalizedInputs = normalizeActionInputs({})
    expect(resolveConfigPath(n)).toBe('.github/sync.yml')
  })
})
