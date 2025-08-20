import { execFileSync } from 'node:child_process'

export function getGitHubToken(): string | undefined {
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GH_PAT
  if (envToken && envToken.trim()) return envToken.trim()
  try {
    const output = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const token = output.trim()
    if (token) return token
  } catch {
    // gh CLI not available or not logged in
  }
  return undefined
}
