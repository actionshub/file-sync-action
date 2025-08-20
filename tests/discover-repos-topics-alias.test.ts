import { describe, it, expect } from 'vitest'
import { Octokit } from '@octokit/rest'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { discoverReposByTopic } from '../src/discover'
import { getGitHubToken } from './helpers/getToken'
import { normalizeActionInputs } from '../src/inputs'

const token = getGitHubToken()
const MyOctokit = Octokit.plugin(paginateRest)
const maybeIt = token ? it : it.skip

describe('discoverReposByTopic with search_topics only (integration)', () => {
  maybeIt('discovers repos using search_topics input', async () => {
    const octokit = new MyOctokit({
      auth: token,
      userAgent: 'repo-sync-action-tests'
    })

    // Use only search_topics
    const n = normalizeActionInputs({ search_topics: 'chef-cookbook' })

    // Retry a few times to avoid occasional empty/slow search results
    let repos: string[] = []
    for (let attempt = 0; attempt < 3; attempt++) {
      repos = await discoverReposByTopic(octokit as any, {
        org: 'sous-chefs',
        search_topics: n.search_topics
      })
      if (repos.length > 0) break
      await new Promise((r) => setTimeout(r, 1000))
    }

    expect(Array.isArray(repos)).toBe(true)

    // If any repos are returned, they should be within the sous-chefs org and unique
    if (repos.length > 0) {
      for (const name of repos) {
        expect(name.startsWith('sous-chefs/')).toBe(true)
      }
      expect(new Set(repos).size).toBe(repos.length)
    }
  }, 60000)
})
