import { describe, it, expect } from 'vitest'
import { parseSyncConfigFromString } from '../src/config'

// Example 1 — strings only (same source and destination)
const ex1 = `
owner/repository:
  - .github/workflows/test.yml
  - .github/workflows/lint.yml
`

// Example 2 — custom destinations
const ex2 = `
owner/repository:
  - source: workflows/stale.yml
    dest: .github/workflows/stale.yml
  - source: templates/README.md
    dest: README.md
`

// Example 3 — multiple repositories, mixed specs
const ex3 = `
owner/repo-a:
  - .editorconfig
  - .github/dependabot.yml

owner/repo-b:
  - source: ci/release.yml
    dest: .github/workflows/release.yml
  - source: ci/test.yml
    dest: .github/workflows/test.yml
`

describe('sync.yml examples', () => {
  it('example 1: strings only', () => {
    const cfg = parseSyncConfigFromString(ex1)
    expect(cfg['owner/repository']).toEqual([
      '.github/workflows/test.yml',
      '.github/workflows/lint.yml'
    ])
  })

  it('example 2: custom destinations', () => {
    const cfg = parseSyncConfigFromString(ex2)
    expect(cfg['owner/repository']).toEqual([
      { source: 'workflows/stale.yml', dest: '.github/workflows/stale.yml' },
      { source: 'templates/README.md', dest: 'README.md' }
    ])
  })

  it('example 3: multiple repositories mixed', () => {
    const cfg = parseSyncConfigFromString(ex3)
    expect(cfg['owner/repo-a']).toEqual([
      '.editorconfig',
      '.github/dependabot.yml'
    ])
    expect(cfg['owner/repo-b']).toEqual([
      { source: 'ci/release.yml', dest: '.github/workflows/release.yml' },
      { source: 'ci/test.yml', dest: '.github/workflows/test.yml' }
    ])
  })
})
