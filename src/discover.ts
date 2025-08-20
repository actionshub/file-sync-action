import { DiscoverOptions, DiscoverOptionsSchema } from './schemas'

export interface MinimalOctokit {
  paginate: (fn: any, params: any) => Promise<any[]>
  rest: {
    search: {
      repos: any
    }
  }
}

/**
 * Discover repositories in an org by GitHub topics, excluding archived or disabled repos.
 * Returns repo full_name strings (e.g. "owner/repo").
 */
export async function discoverReposByTopic (
  octokit: MinimalOctokit,
  options: DiscoverOptions
): Promise<string[]> {
  const parsed = DiscoverOptionsSchema.parse(options)
  const org = parsed.org
  const topics = parsed.search_topics.map((t: string) => t.trim()).filter(Boolean)

  const topicQuery = topics.map(t => `topic:${t}`).join(' ')
  const q = `org:${org} ${topicQuery} archived:false`

  const results = await octokit.paginate(octokit.rest.search.repos, {
    q,
    per_page: 100
  })

  const repos = results
    .filter((r: any) => !r.archived && !r.disabled)
    .map((r: any) => r.full_name)

  // Deduplicate, preserving order
  const seen = new Set<string>()
  const unique = [] as string[]
  for (const name of repos) {
    if (!seen.has(name)) {
      seen.add(name)
      unique.push(name)
    }
  }
  return unique
}
