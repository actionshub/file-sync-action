import { Octokit } from '@octokit/rest'
import { TargetRepoHandler } from './target-repo'
import { PullRequestManager } from './pr-manager'
import { discoverReposByTopic } from './discover'
import { cloneSourceRepo } from './source'
import { syncPath } from './sync'
import { parseSyncConfigFile } from './config'

export interface WorkflowOrchestratorOptions {
  octokit: Octokit
  token: string
  gitEmail: string
  gitUsername: string
}

export interface ExecuteSyncOptions {
  sourceRepo: string
  sourcePath: string
  targetOrg?: string
  searchTopics?: string[]
  targetRepos?: string[]
  branchName?: string
  commitPrefix?: string
  commitBody?: string
  prTitle: string
  prBody: string
  labels?: string[]
  assignees?: string[]
  reviewers?: string[]
  dryRun?: boolean
}

export interface ExecuteSyncFromConfigOptions {
  sourceRepo: string
  syncConfig: Record<string, Array<{ source: string; dest: string }>>
  branchName?: string
  commitPrefix?: string
  commitBody?: string
  prTitle: string
  prBody: string
  labels?: string[]
  assignees?: string[]
  reviewers?: string[]
  dryRun?: boolean
}

export interface DiscoverTargetReposOptions {
  org: string
  searchTopics: string[]
}

export interface GenerateBranchNameOptions {
  sourceRepo: string
  prefix?: string
  sourcePath?: string
}

export interface SyncResult {
  targetRepo: string
  filesChanged: string[]
  pullRequestUrl?: string
  error?: string
}

export interface WorkflowResult {
  discoveredRepos: string[]
  syncResults: SyncResult[]
  pullRequestUrls: string[]
}

export class WorkflowOrchestrator {
  private options: WorkflowOrchestratorOptions
  private prManager: PullRequestManager
  private activeHandlers: TargetRepoHandler[] = []

  constructor(options: WorkflowOrchestratorOptions) {
    this.options = options
    this.prManager = new PullRequestManager(options.octokit)
  }

  async executeSync(syncOptions: ExecuteSyncOptions): Promise<WorkflowResult> {
    const {
      sourceRepo,
      sourcePath,
      targetOrg,
      searchTopics,
      targetRepos,
      branchName,
      commitPrefix = '🔄',
      commitBody,
      prTitle,
      prBody,
      labels,
      assignees,
      reviewers,
      dryRun = false
    } = syncOptions

    // Discover target repositories
    let discoveredRepos: string[]
    if (targetRepos) {
      discoveredRepos = targetRepos
    } else if (targetOrg && searchTopics) {
      discoveredRepos = await this.discoverTargetRepos({ org: targetOrg, searchTopics })
    } else {
      throw new Error('Must provide either targetRepos or both targetOrg and searchTopics')
    }

    // Clone source repository
    const sourceClone = await cloneSourceRepo({
      repo: sourceRepo,
      token: this.options.token
    })

    const syncResults: SyncResult[] = []
    const pullRequestUrls: string[] = []

    try {
      // Process each target repository
      for (const targetRepo of discoveredRepos) {
        try {
          const result = await this.syncToTargetRepo({
            sourceClone,
            sourcePath,
            targetRepo,
            branchName: branchName || this.generateBranchName({ sourceRepo, sourcePath }),
            commitPrefix,
            commitBody,
            prTitle,
            prBody,
            labels,
            assignees,
            reviewers,
            dryRun
          })

          syncResults.push(result)
          if (result.pullRequestUrl) {
            pullRequestUrls.push(result.pullRequestUrl)
          }
        } catch (error) {
          syncResults.push({
            targetRepo,
            filesChanged: [],
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    } finally {
      // Cleanup source clone
      await sourceClone.cleanup()
    }

    return {
      discoveredRepos,
      syncResults,
      pullRequestUrls
    }
  }

  async executeSyncFromConfig(options: ExecuteSyncFromConfigOptions): Promise<WorkflowResult> {
    const {
      sourceRepo,
      syncConfig,
      branchName,
      commitPrefix = '🔄',
      commitBody,
      prTitle,
      prBody,
      labels,
      assignees,
      reviewers,
      dryRun = false
    } = options

    // Clone source repository
    const sourceClone = await cloneSourceRepo({
      repo: sourceRepo,
      token: this.options.token
    })

    const syncResults: SyncResult[] = []
    const pullRequestUrls: string[] = []
    const discoveredRepos = Object.keys(syncConfig)

    try {
      // Process each target repository from config
      for (const [targetRepo, fileSpecs] of Object.entries(syncConfig)) {
        try {
          const result = await this.syncMultipleFilesToTarget({
            sourceClone,
            fileSpecs,
            targetRepo,
            branchName: branchName || this.generateBranchName({ sourceRepo }),
            commitPrefix,
            commitBody,
            prTitle,
            prBody,
            labels,
            assignees,
            reviewers,
            dryRun
          })

          syncResults.push(result)
          if (result.pullRequestUrl) {
            pullRequestUrls.push(result.pullRequestUrl)
          }
        } catch (error) {
          syncResults.push({
            targetRepo,
            filesChanged: [],
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    } finally {
      // Cleanup source clone
      await sourceClone.cleanup()
    }

    return {
      discoveredRepos,
      syncResults,
      pullRequestUrls
    }
  }

  async discoverTargetRepos(options: DiscoverTargetReposOptions): Promise<string[]> {
    const repos = await discoverReposByTopic(this.options.octokit, {
      org: options.org,
      search_topics: options.searchTopics
    })

    return repos // Already returns string[] of full_name format
  }

  generateBranchName(options: GenerateBranchNameOptions): string {
    const { sourceRepo, prefix = 'sync', sourcePath } = options
    const repoName = sourceRepo.split('/')[1]
    const timestamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    
    let branchName = `${prefix}/${repoName}/${timestamp}`
    
    if (sourcePath) {
      const fileName = sourcePath.split('/').pop()?.replace(/[^a-zA-Z0-9.-]/g, '-') || 'file'
      branchName += `/${fileName}`
    }

    return branchName
  }

  private async syncToTargetRepo(options: {
    sourceClone: { workingDir: string; cleanup: () => Promise<void> }
    sourcePath: string
    targetRepo: string
    branchName: string
    commitPrefix: string
    commitBody?: string
    prTitle: string
    prBody: string
    labels?: string[]
    assignees?: string[]
    reviewers?: string[]
    dryRun: boolean
  }): Promise<SyncResult> {
    const handler = new TargetRepoHandler({
      token: this.options.token,
      gitEmail: this.options.gitEmail,
      gitUsername: this.options.gitUsername
    })

    this.activeHandlers.push(handler)

    try {
      // Setup target repository
      await handler.setupTargetRepo({
        repo: options.targetRepo,
        branchName: options.branchName
      })

      // Sync files - map source path to correct destination
      const destPath = options.sourcePath.split('/').pop() || options.sourcePath
      const syncResult = await syncPath({
        sourcePath: `${options.sourceClone.workingDir}/${options.sourcePath}`,
        targetDir: handler.getWorkingDir()!,
        dest: destPath
      })

      if (syncResult.changed.length === 0) {
        return {
          targetRepo: options.targetRepo,
          filesChanged: []
        }
      }

      if (options.dryRun) {
        // In dry run mode, don't commit or push anything
        return {
          targetRepo: options.targetRepo,
          filesChanged: syncResult.changed
        }
      }

      // Commit and push changes
      const commitMessage = `${options.commitPrefix} Sync ${options.sourcePath}`
      const commitResult = await handler.commitAndPush({
        message: commitMessage,
        body: options.commitBody
      })

      if (!commitResult.committed) {
        return {
          targetRepo: options.targetRepo,
          filesChanged: syncResult.changed
        }
      }

      // Create or update pull request
      const pr = await this.prManager.createOrUpdatePullRequest({
        repo: options.targetRepo,
        title: options.prTitle,
        body: options.prBody,
        head: options.branchName,
        base: 'main'
      })

      // Add metadata to PR
      await this.prManager.addPullRequestMetadata({
        repo: options.targetRepo,
        pullNumber: pr.number,
        labels: options.labels,
        assignees: options.assignees,
        reviewers: options.reviewers
      })

      return {
        targetRepo: options.targetRepo,
        filesChanged: syncResult.changed,
        pullRequestUrl: pr.html_url
      }
    } finally {
      await handler.cleanup()
      this.activeHandlers = this.activeHandlers.filter(h => h !== handler)
    }
  }

  private async syncMultipleFilesToTarget(options: {
    sourceClone: { workingDir: string; cleanup: () => Promise<void> }
    fileSpecs: Array<{ source: string; dest: string }>
    targetRepo: string
    branchName: string
    commitPrefix: string
    commitBody?: string
    prTitle: string
    prBody: string
    labels?: string[]
    assignees?: string[]
    reviewers?: string[]
    dryRun: boolean
  }): Promise<SyncResult> {
    const handler = new TargetRepoHandler({
      token: this.options.token,
      gitEmail: this.options.gitEmail,
      gitUsername: this.options.gitUsername
    })

    this.activeHandlers.push(handler)

    try {
      // Setup target repository
      await handler.setupTargetRepo({
        repo: options.targetRepo,
        branchName: options.branchName
      })

      const allChanged: string[] = []

      // Sync each file
      for (const fileSpec of options.fileSpecs) {
        const syncResult = await syncPath({
          sourcePath: `${options.sourceClone.workingDir}/${fileSpec.source}`,
          targetDir: handler.getWorkingDir()!,
          dest: fileSpec.dest
        })
        allChanged.push(...syncResult.changed)
      }

      if (allChanged.length === 0) {
        return {
          targetRepo: options.targetRepo,
          filesChanged: []
        }
      }

      if (options.dryRun) {
        // In dry run mode, don't commit or push anything
        return {
          targetRepo: options.targetRepo,
          filesChanged: allChanged
        }
      }

      // Commit and push changes
      const fileList = options.fileSpecs.map(f => f.dest).join(', ')
      const commitMessage = `${options.commitPrefix} Sync ${fileList}`
      const commitResult = await handler.commitAndPush({
        message: commitMessage,
        body: options.commitBody
      })

      if (!commitResult.committed) {
        return {
          targetRepo: options.targetRepo,
          filesChanged: allChanged
        }
      }

      // Create or update pull request
      const pr = await this.prManager.createOrUpdatePullRequest({
        repo: options.targetRepo,
        title: options.prTitle,
        body: options.prBody,
        head: options.branchName,
        base: 'main'
      })

      // Add metadata to PR
      await this.prManager.addPullRequestMetadata({
        repo: options.targetRepo,
        pullNumber: pr.number,
        labels: options.labels,
        assignees: options.assignees,
        reviewers: options.reviewers
      })

      return {
        targetRepo: options.targetRepo,
        filesChanged: allChanged,
        pullRequestUrl: pr.html_url
      }
    } finally {
      await handler.cleanup()
      this.activeHandlers = this.activeHandlers.filter(h => h !== handler)
    }
  }

  async cleanup(): Promise<void> {
    // Cleanup all active handlers
    await Promise.all(this.activeHandlers.map(handler => handler.cleanup()))
    this.activeHandlers = []
  }
}
