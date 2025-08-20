import { describe, it, expect } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import simpleGit from 'simple-git'
import { getGitHubToken } from './helpers/getToken'
import { getSourcePath } from '../src/source'
import { syncSubfolder } from '../src/sync'

const token = getGitHubToken()
const maybeIt = token ? it : it.skip

async function createTempRepo (): Promise<{ dir: string, cleanup: () => Promise<void> }> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-sync-target-'))
  const git = simpleGit({ baseDir: tmpRoot })
  await git.init()
  // Ensure commits don't require signing in this temp repo
  await git.addConfig('user.email', 'repo-sync@example.com')
  await git.addConfig('user.name', 'Repo Sync Action')
  await git.addConfig('commit.gpgsign', 'false')
  await fs.writeFile(path.join(tmpRoot, '.gitignore'), '\
node_modules\n')
  await git.add('.')
  await git.commit('chore: init')
  return {
    dir: tmpRoot,
    cleanup: async () => {
      await fs.remove(tmpRoot)
    }
  }
}

describe('syncSubfolder local (integration)', () => {
  maybeIt('copies source subfolder into target repo and is idempotent', async () => {
    const { absPath: sourceDir, cleanup: cleanupSource } = await getSourcePath({
      repo: 'sous-chefs/repo-management',
      path: 'standardfiles/cookbook',
      token: token as string,
      sparse: true
    })

    const { dir: targetDir, cleanup: cleanupTarget } = await createTempRepo()

    try {
      const result1 = await syncSubfolder({ sourceDir, targetDir, dest: '.' })
      expect(result1.changed.length).toBeGreaterThan(0)
      // Key file should exist now
      expect(await fs.pathExists(path.join(targetDir, '.editorconfig'))).toBe(true)

      const result2 = await syncSubfolder({ sourceDir, targetDir, dest: '.' })
      expect(result2.changed.length).toBe(0)
    } finally {
      await cleanupSource()
      await cleanupTarget()
    }
  }, 90000)
})
