import { describe, it, expect } from 'vitest'
import { normalizeActionInputs } from '../src/inputs'

describe('normalizeActionInputs (extended)', () => {
  it('maps pr_body and commit fields from lower/uppercase', () => {
    const n = normalizeActionInputs({
      pr_body: 'p1',
      PR_BODY: 'p2',
      commit_prefix: 'cp2',
      COMMIT_PREFIX: 'cp',
      COMMIT_BODY: 'cb'
    })
    expect(n.pr_body).toBe('p1')
    expect(n.commit_prefix).toBe('cp2')
    expect(n.commit_body).toBe('cb')
  })

  it('maps commit_each_file from COMMIT_EACH_FILE', () => {
    const nTrue = normalizeActionInputs({ COMMIT_EACH_FILE: 'true' })
    expect(nTrue.commit_each_file).toBe(true)
    const nFalse = normalizeActionInputs({ COMMIT_EACH_FILE: 'false' })
    expect(nFalse.commit_each_file).toBe(false)
  })

  it('maps pr_title from lower/uppercase', () => {
    const n1 = normalizeActionInputs({ pr_title: 'lower wins', PR_TITLE: 'upper' })
    expect(n1.pr_title).toBe('lower wins')
    const n2 = normalizeActionInputs({ PR_TITLE: 'upper only' })
    expect(n2.pr_title).toBe('upper only')
  })

  it('maps config_path from CONFIG_PATH', () => {
    const n = normalizeActionInputs({ CONFIG_PATH: '.github/sync.yml' })
    expect(n.config_path).toBe('.github/sync.yml')
  })

  it('maps assignees from both casings and dedupes', () => {
    const n = normalizeActionInputs({ assignees: 'u1\n u2', ASSIGNEES: 'u2\n u3' })
    expect(n.assignees).toEqual(['u1', 'u2', 'u3'])
  })

  it('maps branch and flags and misc fields', () => {
    const n = normalizeActionInputs({
      branch_name: 'bn',
      BRANCH_PREFIX: 'bp',
      SKIP_PR: 'true',
      TMP_DIR: '/tmp/work',
      SKIP_CLEANUP: 'yes',
      OVERWRITE_EXISTING_PR: '1',
      COMMIT_AS_PR_TITLE: 'no',
      ORIGINAL_MESSAGE: 'false',
      IS_FINE_GRAINED: 'True',
      GIT_EMAIL: 'e@x',
      GIT_USERNAME: 'u',
      FORK: 'org'
    })
    expect(n.branch_name).toBe('bn')
    expect(n.branch_prefix).toBe('bp')
    expect(n.skip_pr).toBe(true)
    expect(n.tmp_dir).toBe('/tmp/work')
    expect(n.skip_cleanup).toBe(true)
    expect(n.overwrite_existing_pr).toBe(true)
    expect(n.commit_as_pr_title).toBe(false)
    expect(n.original_message).toBe(false)
    expect(n.is_fine_grained).toBe(true)
    expect(n.git_email).toBe('e@x')
    expect(n.git_username).toBe('u')
    expect(n.fork).toBe('org')
  })
})
