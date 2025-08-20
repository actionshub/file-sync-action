import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import { getSourcePath } from '../src/source'
import { discoverReposByTopic } from '../src/discover'

// For discover validation, the function should throw before touching octokit
const dummyOctokit: any = {
  paginate: async () => { throw new Error('should not paginate') },
  rest: { search: { repos: async () => { throw new Error('should not call search') } } }
}

describe('input validation with zod', () => {
  it('getSourcePath rejects invalid repo format', async () => {
    await expect(getSourcePath({
      repo: 'invalid',
      path: 'some/path',
      token: 't'
    } as any)).rejects.toBeInstanceOf(ZodError)
  })

  it('getSourcePath rejects missing path', async () => {
    await expect(getSourcePath({
      repo: 'owner/repo',
      path: '',
      token: 't'
    } as any)).rejects.toBeInstanceOf(ZodError)
  })

  it('getSourcePath rejects missing token', async () => {
    await expect(getSourcePath({
      repo: 'owner/repo',
      path: 'x',
      token: ''
    } as any)).rejects.toBeInstanceOf(ZodError)
  })

  it('discoverReposByTopic rejects empty org', async () => {
    await expect(discoverReposByTopic(dummyOctokit, { org: '', search_topics: ['a'] } as any))
      .rejects.toBeInstanceOf(ZodError)
  })

  it('discoverReposByTopic rejects empty topics array', async () => {
    await expect(discoverReposByTopic(dummyOctokit, { org: 'owner', search_topics: [] } as any))
      .rejects.toBeInstanceOf(ZodError)
  })
})
