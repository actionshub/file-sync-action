import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import simpleGit from 'simple-git'
import { getGitHubToken } from './helpers/getToken'
import { TargetRepoHandler } from '../src/target-repo'

const token = getGitHubToken()
const maybeIt = token ? it : it.skip

interface TestRepo {
  dir: string
  cleanup: () => Promise<void>
}

async function createTestSourceFiles(): Promise<TestRepo> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-sync-source-'))

  // Create test files to sync
  await fs.writeFile(path.join(tmpRoot, 'test-file.md'), '# Test File\nThis is a test file.\n')
  await fs.writeFile(path.join(tmpRoot, 'LICENSE'), 'MIT License\n')

  return {
    dir: tmpRoot,
    cleanup: async () => {
      await fs.remove(tmpRoot)
    }
  }
}

describe('TargetRepoHandler', () => {
  let sourceFiles: TestRepo
  let handler: TargetRepoHandler

  beforeEach(async () => {
    sourceFiles = await createTestSourceFiles()
    handler = new TargetRepoHandler({
      token: token as string,
      gitEmail: 'repo-sync@example.com',
      gitUsername: 'Repo Sync Action'
    })
  })

  afterEach(async () => {
    await sourceFiles.cleanup()
    await handler.cleanup()
  })

  maybeIt('clones target repository and creates branch', async () => {
    const result = await handler.setupTargetRepo({
      repo: 'sous-chefs/repo-management', // Use a real repo for integration test
      branchName: 'repo-sync-action/test-clone'
    })

    expect(result.workingDir).toBeDefined()
    expect(await fs.pathExists(result.workingDir)).toBe(true)
    expect(await fs.pathExists(path.join(result.workingDir, '.git'))).toBe(true)
  })

  maybeIt('syncs files to target repository', async () => {
    const setup = await handler.setupTargetRepo({
      repo: 'sous-chefs/repo-management',
      branchName: 'repo-sync-action/test-sync'
    })

    const syncResults = await handler.syncFilesToTarget([
      {
        sourcePath: path.join(sourceFiles.dir, 'test-file.md'),
        destPath: 'test-sync/test-file.md'
      },
      {
        sourcePath: path.join(sourceFiles.dir, 'LICENSE'),
        destPath: 'test-sync/LICENSE'
      }
    ])

    expect(syncResults.changed.length).toBeGreaterThan(0)
    expect(await fs.pathExists(path.join(setup.workingDir, 'test-sync/test-file.md'))).toBe(true)
    expect(await fs.pathExists(path.join(setup.workingDir, 'test-sync/LICENSE'))).toBe(true)
  })

  maybeIt('commits and pushes changes', async () => {
    await handler.setupTargetRepo({
      repo: 'sous-chefs/repo-management',
      branchName: 'repo-sync-action/test-commit'
    })

    await handler.syncFilesToTarget([
      {
        sourcePath: path.join(sourceFiles.dir, 'test-file.md'),
        destPath: 'test-sync/test-file.md'
      }
    ])

    const commitResult = await handler.commitAndPush({
      message: 'test: sync test files',
      body: 'This is a test commit from repo-sync-action'
    })

    expect(commitResult.committed).toBe(true)
    expect(commitResult.pushed).toBe(true)
  })

  maybeIt('handles no changes gracefully', async () => {
    await handler.setupTargetRepo({
      repo: 'sous-chefs/repo-management',
      branchName: 'repo-sync-action/test-no-changes'
    })

    // Sync same files twice
    await handler.syncFilesToTarget([
      {
        sourcePath: path.join(sourceFiles.dir, 'test-file.md'),
        destPath: 'test-sync/test-file.md'
      }
    ])

    const syncResults2 = await handler.syncFilesToTarget([
      {
        sourcePath: path.join(sourceFiles.dir, 'test-file.md'),
        destPath: 'test-sync/test-file.md'
      }
    ])

    expect(syncResults2.changed).toEqual([])
  })

}, 60000)
