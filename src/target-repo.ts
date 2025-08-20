import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import simpleGit from 'simple-git'
import { syncPath } from './sync'

export interface TargetRepoOptions {
  token: string
  gitEmail: string
  gitUsername: string
  tmpDir?: string
}

export interface SetupTargetRepoOptions {
  repo: string // owner/repo format
  branchName: string
  ref?: string // base branch, defaults to default branch
}

export interface SyncFileSpec {
  sourcePath: string
  destPath: string
}

export interface CommitOptions {
  message: string
  body?: string
}

export interface SetupResult {
  workingDir: string
  branchName: string
}

export interface SyncResult {
  changed: string[]
}

export interface CommitResult {
  committed: boolean
  pushed: boolean
  commitSha?: string
}

export class TargetRepoHandler {
  private options: TargetRepoOptions
  private workingDir?: string
  private git?: ReturnType<typeof simpleGit>
  private repo?: string
  private branchName?: string

  constructor(options: TargetRepoOptions) {
    this.options = options
  }

  async setupTargetRepo(setupOptions: SetupTargetRepoOptions): Promise<SetupResult> {
    const { repo, branchName, ref } = setupOptions
    this.repo = repo
    this.branchName = branchName

    // Create temporary directory
    const tmpRoot = this.options.tmpDir || await fs.mkdtemp(path.join(os.tmpdir(), 'repo-sync-target-'))
    this.workingDir = path.join(tmpRoot, 'repo')

    // Setup git with non-interactive mode
    this.git = simpleGit().env({ 
      GIT_TERMINAL_PROMPT: '0', 
      GIT_ASKPASS: '/bin/true' 
    })

    // Clone repository
    const url = `https://x-access-token:${encodeURIComponent(this.options.token)}@github.com/${repo}.git`
    
    const cloneArgs: string[] = ['--depth', '1', '--no-tags']
    if (ref && ref.trim()) {
      cloneArgs.push('--branch', ref.trim(), '--single-branch')
    }

    try {
      await this.git.clone(url, this.workingDir, cloneArgs)
    } catch (err) {
      await fs.remove(tmpRoot)
      throw err
    }

    // Sanitize origin to remove token
    const sanitizedUrl = `https://github.com/${repo}.git`
    const repoGit = simpleGit({ baseDir: this.workingDir }).env({ 
      GIT_TERMINAL_PROMPT: '0', 
      GIT_ASKPASS: '/bin/true' 
    })
    await repoGit.remote(['set-url', 'origin', sanitizedUrl])

    // Configure git user
    await repoGit.addConfig('user.email', this.options.gitEmail)
    await repoGit.addConfig('user.name', this.options.gitUsername)
    await repoGit.addConfig('commit.gpgsign', 'false')

    // Create and checkout branch (or checkout if it exists)
    try {
      await repoGit.checkoutLocalBranch(branchName)
    } catch (err) {
      // Branch might already exist, try to checkout existing branch
      try {
        await repoGit.checkout(branchName)
      } catch (checkoutErr) {
        // If both fail, try to fetch and checkout remote branch
        await repoGit.fetch('origin', branchName)
        await repoGit.checkout(branchName)
      }
    }

    this.git = repoGit

    return {
      workingDir: this.workingDir,
      branchName
    }
  }

  async syncFilesToTarget(files: SyncFileSpec[]): Promise<SyncResult> {
    if (!this.workingDir || !this.git) {
      throw new Error('Target repository not setup. Call setupTargetRepo first.')
    }

    const allChanged: string[] = []

    for (const file of files) {
      const result = await syncPath({
        sourcePath: file.sourcePath,
        targetDir: this.workingDir,
        dest: file.destPath
      })
      allChanged.push(...result.changed)
    }

    return { changed: allChanged }
  }

  async commitAndPush(commitOptions: CommitOptions): Promise<CommitResult> {
    if (!this.git || !this.branchName) {
      throw new Error('Target repository not setup. Call setupTargetRepo first.')
    }

    // Check if there are any changes to commit
    const status = await this.git.status()
    const hasChanges = status.files.length > 0

    if (!hasChanges) {
      return { committed: false, pushed: false }
    }

    // Stage all changes
    await this.git.add('.')

    // Create commit message
    let fullMessage = commitOptions.message
    if (commitOptions.body) {
      fullMessage += '\n\n' + commitOptions.body
    }

    // Commit changes
    const commitResult = await this.git.commit(fullMessage)
    const commitSha = commitResult.commit

    // Push to origin with token - use force push to override existing branches
    const url = `https://x-access-token:${encodeURIComponent(this.options.token)}@github.com/${this.repo}.git`
    await this.git.push(url, this.branchName, ['--force'])

    // Sanitize origin again after push
    const sanitizedUrl = `https://github.com/${this.repo}.git`
    await this.git.remote(['set-url', 'origin', sanitizedUrl])

    return {
      committed: true,
      pushed: true,
      commitSha
    }
  }

  async hasChanges(): Promise<boolean> {
    if (!this.git) {
      throw new Error('Target repository not setup. Call setupTargetRepo first.')
    }

    const status = await this.git.status()
    return status.files.length > 0
  }

  async cleanup(): Promise<void> {
    if (this.workingDir) {
      const tmpRoot = path.dirname(this.workingDir)
      await fs.remove(tmpRoot)
      this.workingDir = undefined
      this.git = undefined
    }
  }

  getWorkingDir(): string | undefined {
    return this.workingDir
  }

  getBranchName(): string | undefined {
    return this.branchName
  }
}
