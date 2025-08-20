import { describe, it, expect } from 'vitest'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { getGitHubToken } from './helpers/getToken'
import { getSourcePath } from '../src/source'

const token = getGitHubToken()
const maybeIt = token ? it : it.skip

function findRepoRoot(start: string): string {
  let dir = start
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Could not find repo root from: ' + start)
}

describe('getSourcePath security', () => {
  maybeIt('sanitizes origin remote URL to remove token and not leak into .git/config', async () => {
    const { absPath, cleanup } = await getSourcePath({
      repo: 'sous-chefs/repo-management',
      path: 'standardfiles/cookbook',
      token: token as string
    })

    try {
      const repoRoot = findRepoRoot(absPath)
      const url = execFileSync('git', ['-C', repoRoot, 'remote', 'get-url', 'origin'], {
        encoding: 'utf8'
      }).trim()
      expect(url).toBe('https://github.com/sous-chefs/repo-management.git')

      const gitConfig = fs.readFileSync(path.join(repoRoot, '.git', 'config'), 'utf8')
      expect(gitConfig.includes('x-access-token')).toBe(false)
      if (token) {
        expect(gitConfig.includes(token)).toBe(false)
      }
    } finally {
      await cleanup()
    }
  })

  maybeIt('removes temp directory on subpath failure', async () => {
    // Record baseline temp entries
    const prefix = 'repo-sync-source-'
    const tmp = os.tmpdir()
    const before = (fs.readdirSync(tmp).filter(n => n.startsWith(prefix)))

    let threw = false
    try {
      await getSourcePath({
        repo: 'sous-chefs/repo-management',
        path: 'does-not-exist-123456',
        token: token as string
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(true)

    // Allow filesystem to settle
    await new Promise(r => setTimeout(r, 100))

    const after = (fs.readdirSync(tmp).filter(n => n.startsWith(prefix)))
    // No leaked new temp dirs with our prefix (allow external cleanup to reduce count)
    expect(after.length).toBeLessThanOrEqual(before.length)
  })
})
