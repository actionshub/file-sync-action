import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import simpleGit from 'simple-git'
import { GetSourcePathOptions, GetSourcePathOptionsSchema } from './schemas'

export async function getSourcePath (opts: GetSourcePathOptions): Promise<{ absPath: string, cleanup: () => Promise<void> }> {
  const parsed = GetSourcePathOptionsSchema.parse(opts)
  const repo = parsed.repo
  const subPath = parsed.path
  const token = parsed.token
  const ref = parsed.ref
  const depth = parsed.depth ?? 1
  const useSparse = Boolean(parsed.sparse)

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-sync-source-'))
  const cloneDir = path.join(tmpRoot, 'repo')

  const url = `https://x-access-token:${encodeURIComponent(token)}@github.com/${repo}.git`

  // Non-interactive git to avoid prompts in CI
  const git = simpleGit().env({ GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '/bin/true' })
  const cloneArgs: string[] = ['--depth', String(depth), '--no-tags']
  if (useSparse) {
    // Avoid checking out files initially and reduce data transfer
    cloneArgs.push('--filter=blob:none', '--no-checkout')
  }
  if (ref && ref.trim()) {
    cloneArgs.push('--branch', ref.trim(), '--single-branch')
  }

  try {
    await git.clone(url, cloneDir, cloneArgs)
  } catch (err) {
    // Ensure cleanup if clone fails
    await fs.remove(tmpRoot)
    throw err
  }

  // Sanitize origin to avoid leaking token into remotes/config
  const sanitized = `https://github.com/${repo}.git`
  const repoGit = simpleGit({ baseDir: cloneDir }).env({ GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '/bin/true' })
  await repoGit.remote(['set-url', 'origin', sanitized])

  // If sparse checkout requested, configure it now
  if (useSparse) {
    try {
      await repoGit.raw(['sparse-checkout', 'init', '--cone'])
      await repoGit.raw(['sparse-checkout', 'set', subPath])

      // Ensure working tree is checked out at desired ref/default branch
      if (ref && ref.trim()) {
        await repoGit.checkout(ref.trim())
      } else {
        // Determine default branch from origin/HEAD -> e.g., origin/main
        const originHead = (await repoGit.raw(['rev-parse', '--abbrev-ref', 'origin/HEAD'])).trim()
        const defBranch = originHead.startsWith('origin/') ? originHead.slice('origin/'.length) : originHead
        if (defBranch) {
          await repoGit.checkout(defBranch)
        }
      }
    } catch (err) {
      await fs.remove(tmpRoot)
      throw err
    }
  }

  const absPath = path.join(cloneDir, subPath)
  const exists = await fs.pathExists(absPath)
  if (!exists) {
    // cleanup before throwing
    await fs.remove(tmpRoot)
    throw new Error(`Subpath not found in source repo: ${subPath}`)
  }

  const cleanup = async () => {
    await fs.remove(tmpRoot)
  }

  return { absPath, cleanup }
}

export async function cloneSourceRepo(options: { repo: string; token: string; ref?: string }): Promise<{ workingDir: string; cleanup: () => Promise<void> }> {
  const result = await getSourcePath({
    repo: options.repo,
    path: '.', // Clone entire repo - use '.' for root
    token: options.token,
    ref: options.ref,
    sparse: false
  })

  return {
    workingDir: result.absPath, // Return the repo root directory (already points to cloneDir/.)
    cleanup: result.cleanup
  }
}
