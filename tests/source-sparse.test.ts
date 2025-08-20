import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { getGitHubToken } from './helpers/getToken'
import { getSourcePath } from '../src/source'
import { findRepoRoot } from './helpers/repo'

const token = getGitHubToken()
const maybeIt = token ? it : it.skip

describe('getSourcePath sparse checkout (integration)', () => {
  maybeIt('uses sparse checkout to materialize only the requested subpath', async () => {
    const subPath = 'standardfiles/cookbook'
    const { absPath, cleanup } = await getSourcePath({
      repo: 'sous-chefs/repo-management',
      path: subPath,
      token: token as string,
      depth: 1,
      // New option under test
      sparse: true
    })

    try {
      const repoRoot = findRepoRoot(absPath)

      // Sparse-checkout file exists and references our subPath
      const sparseFile = path.join(repoRoot, '.git', 'info', 'sparse-checkout')
      expect(fs.existsSync(sparseFile)).toBe(true)
      const content = fs.readFileSync(sparseFile, 'utf8')
      expect(content.includes('standardfiles/cookbook')).toBe(true)

      // Requested files exist
      expect(fs.existsSync(path.join(absPath, '.editorconfig'))).toBe(true)

      // Remote URL should remain sanitized
      const url = execFileSync('git', ['-C', repoRoot, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
      expect(url).toBe('https://github.com/sous-chefs/repo-management.git')
    } finally {
      await cleanup()
    }
  })
})
