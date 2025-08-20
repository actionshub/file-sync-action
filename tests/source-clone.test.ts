import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getGitHubToken } from './helpers/getToken'
import { getSourcePath } from '../src/source'

const token = getGitHubToken()
const maybeIt = token ? it : it.skip

describe('getSourcePath (integration)', () => {
  maybeIt('clones sous-chefs/repo-management and returns path to standardfiles/cookbook', async () => {
    const { absPath, cleanup } = await getSourcePath({
      repo: 'sous-chefs/repo-management',
      path: 'standardfiles/cookbook',
      token: token as string
    })

    try {
      expect(fs.existsSync(absPath)).toBe(true)
      // spot check a file that should exist
      expect(fs.existsSync(path.join(absPath, '.editorconfig'))).toBe(true)
    } finally {
      await cleanup()
    }
  })
})
