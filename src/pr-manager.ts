import { Octokit } from '@octokit/rest'

export interface CreatePullRequestOptions {
  repo: string // owner/repo format
  title: string
  body: string
  head: string // branch name
  base: string // base branch name
}

export interface UpdatePullRequestOptions {
  repo: string
  pullNumber: number
  title?: string
  body?: string
}

export interface FindPullRequestOptions {
  repo: string
  head: string
  base: string
}

export interface AddLabelsOptions {
  repo: string
  pullNumber: number
  labels: string[]
}

export interface AddAssigneesOptions {
  repo: string
  pullNumber: number
  assignees: string[]
}

export interface RequestReviewersOptions {
  repo: string
  pullNumber: number
  reviewers: string[]
  teamReviewers?: string[]
}

export interface GetPullRequestOptions {
  repo: string
  pullNumber: number
}

export interface PullRequest {
  number: number
  html_url: string
  title: string
  body: string | null
  labels: Array<{ name: string }>
  assignees: Array<{ login: string }>
  head: { ref: string }
  base: { ref: string }
}

export class PullRequestManager {
  private octokit: Octokit

  constructor(octokit: Octokit) {
    this.octokit = octokit
  }

  async createPullRequest(options: CreatePullRequestOptions): Promise<PullRequest> {
    const [owner, repo] = options.repo.split('/')
    
    const response = await this.octokit.rest.pulls.create({
      owner,
      repo,
      title: options.title,
      body: options.body,
      head: options.head,
      base: options.base
    })

    return response.data as PullRequest
  }

  async updatePullRequest(options: UpdatePullRequestOptions): Promise<PullRequest> {
    const [owner, repo] = options.repo.split('/')
    
    const response = await this.octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: options.pullNumber,
      title: options.title,
      body: options.body
    })

    return response.data as PullRequest
  }

  async findExistingPullRequest(options: FindPullRequestOptions): Promise<PullRequest | null> {
    const [owner, repo] = options.repo.split('/')
    
    const response = await this.octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${options.head}`,
      base: options.base,
      state: 'open'
    })

    return response.data.length > 0 ? response.data[0] as PullRequest : null
  }

  async getPullRequest(options: GetPullRequestOptions): Promise<PullRequest> {
    const [owner, repo] = options.repo.split('/')
    
    const response = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: options.pullNumber
    })

    return response.data as PullRequest
  }

  async addLabels(options: AddLabelsOptions): Promise<void> {
    const [owner, repo] = options.repo.split('/')
    
    await this.octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: options.pullNumber,
      labels: options.labels
    })
  }

  async addAssignees(options: AddAssigneesOptions): Promise<void> {
    const [owner, repo] = options.repo.split('/')
    
    await this.octokit.rest.issues.addAssignees({
      owner,
      repo,
      issue_number: options.pullNumber,
      assignees: options.assignees
    })
  }

  async requestReviewers(options: RequestReviewersOptions): Promise<void> {
    const [owner, repo] = options.repo.split('/')
    
    await this.octokit.rest.pulls.requestReviewers({
      owner,
      repo,
      pull_number: options.pullNumber,
      reviewers: options.reviewers,
      team_reviewers: options.teamReviewers
    })
  }

  async createOrUpdatePullRequest(options: CreatePullRequestOptions): Promise<PullRequest> {
    // Check if PR already exists
    const existingPr = await this.findExistingPullRequest({
      repo: options.repo,
      head: options.head,
      base: options.base
    })

    if (existingPr) {
      // Update existing PR
      return await this.updatePullRequest({
        repo: options.repo,
        pullNumber: existingPr.number,
        title: options.title,
        body: options.body
      })
    } else {
      // Create new PR
      return await this.createPullRequest(options)
    }
  }

  async addPullRequestMetadata(options: {
    repo: string
    pullNumber: number
    labels?: string[]
    assignees?: string[]
    reviewers?: string[]
    teamReviewers?: string[]
  }): Promise<void> {
    const { repo, pullNumber, labels, assignees, reviewers, teamReviewers } = options

    if (labels && labels.length > 0) {
      await this.addLabels({ repo, pullNumber, labels })
    }

    if (assignees && assignees.length > 0) {
      await this.addAssignees({ repo, pullNumber, assignees })
    }

    if ((reviewers && reviewers.length > 0) || (teamReviewers && teamReviewers.length > 0)) {
      await this.requestReviewers({ 
        repo, 
        pullNumber, 
        reviewers: reviewers || [], 
        teamReviewers 
      })
    }
  }
}
