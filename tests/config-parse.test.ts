import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import { parseSyncConfigFromString } from '../src/config'

const sampleYaml = `
user/repository:
  - .github/workflows/test.yml
  - .github/workflows/lint.yml

user/repository2:
  - source: workflows/stale.yml
    dest: .github/workflows/stale.yml
`

describe('parseSyncConfigFromString', () => {
  it('parses repositories with string and object specs', () => {
    const cfg = parseSyncConfigFromString(sampleYaml)
    expect(cfg['user/repository']).toEqual([
      '.github/workflows/test.yml',
      '.github/workflows/lint.yml'
    ])
    expect(cfg['user/repository2']).toEqual([
      { source: 'workflows/stale.yml', dest: '.github/workflows/stale.yml' }
    ])
  })

  it('rejects empty arrays for a repo', () => {
    const bad = `owner/repo: []\n`
    expect(() => parseSyncConfigFromString(bad)).toThrow(ZodError)
  })
})
