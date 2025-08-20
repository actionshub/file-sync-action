import { describe, it, expect, beforeEach } from 'vitest'
import { Octokit } from '@octokit/rest'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { PullRequestManager } from '../src/pr-manager'
import { getGitHubToken } from './helpers/getToken'

const token = getGitHubToken()
const maybeIt = token ? it : it.skip
const MyOctokit = Octokit.plugin(paginateRest)

describe('PullRequestManager', () => {
  let prManager: PullRequestManager
  let octokit: InstanceType<typeof MyOctokit>

  beforeEach(() => {
    if (token) {
      octokit = new MyOctokit({
        auth: token,
        userAgent: 'repo-sync-action-tests'
      })
      prManager = new PullRequestManager(octokit as any)
    }
  })

  maybeIt('can instantiate and has required methods', async () => {
    expect(prManager).toBeDefined()
    expect(typeof prManager.createPullRequest).toBe('function')
    expect(typeof prManager.updatePullRequest).toBe('function')
    expect(typeof prManager.findExistingPullRequest).toBe('function')
    expect(typeof prManager.addLabels).toBe('function')
    expect(typeof prManager.addAssignees).toBe('function')
    expect(typeof prManager.requestReviewers).toBe('function')
    expect(typeof prManager.createOrUpdatePullRequest).toBe('function')
  })

  maybeIt('can search for existing pull requests', async () => {
    // Test finding PRs - this should not fail even if no PRs exist
    const foundPr = await prManager.findExistingPullRequest({
      repo: 'sous-chefs/repo-management',
      head: 'non-existent-branch',
      base: 'main'
    })

    expect(foundPr).toBeNull()
  })
}, 60000)
