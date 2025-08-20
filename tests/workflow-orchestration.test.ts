import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Octokit } from '@octokit/rest'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { WorkflowOrchestrator } from '../src/workflow-orchestrator'
import { getGitHubToken } from './helpers/getToken'

const token = getGitHubToken()
const maybeIt = token ? it : it.skip
const MyOctokit = Octokit.plugin(paginateRest)

describe('WorkflowOrchestrator (integration)', () => {
  let orchestrator: WorkflowOrchestrator

  beforeEach(() => {
    if (token) {
      const octokit = new MyOctokit({
        auth: token,
        userAgent: 'repo-sync-action-tests'
      })
      orchestrator = new WorkflowOrchestrator({
        octokit: octokit as any,
        token: token as string,
        gitEmail: 'repo-sync@example.com',
        gitUsername: 'Repo Sync Action'
      })
    }
  })

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup()
    }
  })

  maybeIt('executes full sync workflow from source to targets', async () => {
    // Use a smaller subset to avoid timeout
    const result = await orchestrator.executeSync({
      sourceRepo: 'sous-chefs/repo-management',
      sourcePath: 'standardfiles/cookbook/.editorconfig',
      targetRepos: ['sous-chefs/haproxy'], // Target specific repo instead of discovering all
      branchName: 'repo-sync-action/test-workflow',
      commitPrefix: '🔄',
      commitBody: 'Synced from repo-management via repo-sync-action test',
      prTitle: 'Sync .editorconfig from repo-management',
      prBody: 'This PR syncs the .editorconfig file from the repo-management repository.',
      labels: ['sync', 'automated'],
      dryRun: true // Don't actually create PRs in test
    })

    expect(result.discoveredRepos).toEqual(['sous-chefs/haproxy'])
    expect(result.syncResults.length).toBe(1)
    expect(result.syncResults[0].error).toBeUndefined()
    
    // In dry run mode, no PRs should be created
    expect(result.pullRequestUrls).toEqual([])
  })

  maybeIt('handles sync configuration from file', async () => {
    // Create a test sync config
    const syncConfig = {
      'sous-chefs/haproxy': [
        {
          source: 'standardfiles/cookbook/.editorconfig',
          dest: '.editorconfig'
        }
      ]
    }

    const result = await orchestrator.executeSyncFromConfig({
      sourceRepo: 'sous-chefs/repo-management',
      syncConfig,
      branchName: 'sync/config-test',
      commitPrefix: '🔄',
      prTitle: 'Sync files from repo-management',
      prBody: 'Automated sync from configuration',
      dryRun: true
    })

    expect(result.syncResults.length).toBe(1)
    expect(result.syncResults[0].targetRepo).toBe('sous-chefs/haproxy')
  })

  maybeIt('discovers repositories by topics', async () => {
    const repos = await orchestrator.discoverTargetRepos({
      org: 'sous-chefs',
      searchTopics: ['chef-cookbook']
    })

    expect(Array.isArray(repos)).toBe(true)
    expect(repos.length).toBeGreaterThan(0)
    
    // Should include haproxy cookbook
    expect(repos.some(repo => repo.includes('haproxy'))).toBe(true)
  })

  maybeIt('generates appropriate branch names', async () => {
    const branchName = orchestrator.generateBranchName({
      sourceRepo: 'sous-chefs/repo-management',
      prefix: 'sync',
      sourcePath: 'standardfiles/cookbook/.editorconfig'
    })

    expect(branchName).toMatch(/^sync\/repo-management\//)
    expect(branchName).toContain('editorconfig')
  })
}, 120000)
