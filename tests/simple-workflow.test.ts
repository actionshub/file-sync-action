import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Octokit } from '@octokit/rest'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { WorkflowOrchestrator } from '../src/workflow-orchestrator'
import { TargetRepoHandler } from '../src/target-repo'
import { getGitHubToken } from './helpers/getToken'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'

const token = getGitHubToken()
const maybeIt = token ? it : it.skip
const MyOctokit = Octokit.plugin(paginateRest)

describe('Simple Workflow Test', () => {
  let orchestrator: WorkflowOrchestrator

  beforeEach(() => {
    if (token) {
      const octokit = new MyOctokit({
        auth: token,
        userAgent: 'repo-sync-action-simple-tests'
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

  maybeIt('can create a test file and sync it', async () => {
    // Create a temporary test file with unique content
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-test-'))
    const testContent = `# Test File\nGenerated at: ${new Date().toISOString()}\nRandom: ${Math.random()}`
    const testFile = path.join(tmpDir, 'test-sync-file.md')
    await fs.writeFile(testFile, testContent)

    try {
      // Test target repo handler directly
      const handler = new TargetRepoHandler({
        token: token as string,
        gitEmail: 'test@example.com',
        gitUsername: 'Test User'
      })

      await handler.setupTargetRepo({
        repo: 'sous-chefs/repo-management',
        branchName: 'test/sync-test-file'
      })

      const syncResult = await handler.syncFilesToTarget([
        {
          sourcePath: testFile,
          destPath: 'test-sync/test-file.md'
        }
      ])

      expect(syncResult.changed.length).toBeGreaterThan(0)
      expect(syncResult.changed).toContain('test-sync/test-file.md')

      await handler.cleanup()
    } finally {
      await fs.remove(tmpDir)
    }
  })

  maybeIt('workflow orchestrator can discover repos', async () => {
    const repos = await orchestrator.discoverTargetRepos({
      org: 'sous-chefs',
      searchTopics: ['chef-cookbook']
    })

    expect(repos.length).toBeGreaterThan(0)
    expect(repos.some(repo => repo.includes('haproxy'))).toBe(true)
  })

  maybeIt('workflow orchestrator generates branch names correctly', async () => {
    const branchName = orchestrator.generateBranchName({
      sourceRepo: 'sous-chefs/repo-management',
      sourcePath: 'standardfiles/cookbook/.editorconfig'
    })

    expect(branchName).toMatch(/^sync\/repo-management\/\d{4}-\d{2}-\d{2}/)
    expect(branchName).toContain('editorconfig')
  })
}, 60000)
