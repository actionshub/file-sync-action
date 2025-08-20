import { describe, it, expect } from 'vitest'
import { Octokit } from '@octokit/rest'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { discoverReposByTopic } from '../src/discover'
import { getGitHubToken } from './helpers/getToken'

// Read token from env or gh CLI; skip test if still not available
const token = getGitHubToken()
const MyOctokit = Octokit.plugin(paginateRest)
const maybeIt = token ? it : it.skip

describe('discoverReposByTopic (integration)', () => {
  maybeIt('discovers repos in sous-chefs by topic chef-cookbook', async () => {
    const octokit = new MyOctokit({
      auth: token,
      userAgent: 'repo-sync-action-tests'
    })

    // Retry a few times to avoid occasional empty search results
    let repos: string[] = []
    for (let attempt = 0; attempt < 3; attempt++) {
      repos = await discoverReposByTopic(octokit as any, {
        org: 'sous-chefs',
        search_topics: ['chef-cookbook']
      })
      if (repos.length > 0) break
      await new Promise((r) => setTimeout(r, 1000))
    }

    expect(Array.isArray(repos)).toBe(true)
    expect(repos.length).toBeGreaterThan(0)
    for (const name of repos) {
      expect(name.startsWith('sous-chefs/')).toBe(true)
    }
    expect(new Set(repos).size).toBe(repos.length)
  })
}, 60000)
