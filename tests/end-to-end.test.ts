import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Octokit } from '@octokit/rest'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { WorkflowOrchestrator } from '../src/workflow-orchestrator'
import { getGitHubToken } from './helpers/getToken'

const token = getGitHubToken()
const maybeIt = token ? it : it.skip
const MyOctokit = Octokit.plugin(paginateRest)

describe('End-to-End Workflow', () => {
  let orchestrator: WorkflowOrchestrator

  beforeEach(() => {
    if (token) {
      const octokit = new MyOctokit({
        auth: token,
        userAgent: 'repo-sync-action-e2e-tests'
      })
      orchestrator = new WorkflowOrchestrator({
        octokit: octokit as any,
        token: token as string,
        gitEmail: 'repo-sync-test@example.com',
        gitUsername: 'Repo Sync Action Test'
      })
    }
  })

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup()
    }
  })

  maybeIt('can sync a file from repo-management to haproxy (dry run)', async () => {
    const result = await orchestrator.executeSync({
      sourceRepo: 'sous-chefs/repo-management',
      sourcePath: 'standardfiles/cookbook/.yamllint',
      targetRepos: ['sous-chefs/haproxy'], // Target specific repo for test
      branchName: 'repo-sync-action/test-e2e',
      commitPrefix: '🔄',
      commitBody: 'Synced .yamllint from repo-management via repo-sync-action test (dry run)',
      prTitle: 'Test: Sync .yamllint from repo-management',
      prBody: 'This is a test PR to verify the sync functionality works correctly.\n\n**This is a dry run - no actual PR will be created.**',
      labels: ['sync', 'automated', 'test'],
      dryRun: true // Important: dry run to avoid creating actual PRs
    })

    // Verify the workflow executed successfully
    expect(result.discoveredRepos).toEqual(['sous-chefs/haproxy'])
    expect(result.syncResults).toHaveLength(1)

    const syncResult = result.syncResults[0]
    expect(syncResult.targetRepo).toBe('sous-chefs/haproxy')

    // In dry run mode, we don't actually push or create PRs, so no errors should occur
    expect(syncResult.error).toBeUndefined()

    // In dry run, no PR should be created
    expect(syncResult.pullRequestUrl).toBeUndefined()
    expect(result.pullRequestUrls).toEqual([])
  })

  maybeIt('can discover chef cookbooks by topic', async () => {
    const repos = await orchestrator.discoverTargetRepos({
      org: 'sous-chefs',
      searchTopics: ['chef-cookbook']
    })

    expect(Array.isArray(repos)).toBe(true)
    expect(repos.length).toBeGreaterThan(0)

    // Should include some known cookbooks
    expect(repos.some(repo => repo.includes('haproxy'))).toBe(true)

    // All should be in sous-chefs org
    expect(repos.every(repo => repo.startsWith('sous-chefs/'))).toBe(true)
  })

  maybeIt('generates appropriate branch names', async () => {
    const branchName = orchestrator.generateBranchName({
      sourceRepo: 'sous-chefs/repo-management',
      prefix: 'sync',
      sourcePath: 'standardfiles/cookbook/.yamllint'
    })

    expect(branchName).toMatch(/^sync\/repo-management\/\d{4}-\d{2}-\d{2}\/.*yamllint/)
  })

  maybeIt('can sync multiple files using configuration', async () => {
    const syncConfig = {
      'sous-chefs/haproxy': [
        {
          source: 'standardfiles/cookbook/.yamllint',
          dest: '.yamllint'
        },
        {
          source: 'standardfiles/cookbook/.gitignore',
          dest: '.gitignore'
        }
      ]
    }

    const result = await orchestrator.executeSyncFromConfig({
      sourceRepo: 'sous-chefs/repo-management',
      syncConfig,
      branchName: 'repo-sync-action/test-multi',
      commitPrefix: '🔄',
      prTitle: 'Test: Sync multiple files from repo-management',
      prBody: 'Testing multi-file sync functionality',
      dryRun: true
    })

    expect(result.syncResults).toHaveLength(1)
    expect(result.syncResults[0].targetRepo).toBe('sous-chefs/haproxy')
    expect(result.syncResults[0].error).toBeUndefined()
  })
}, 120000)
