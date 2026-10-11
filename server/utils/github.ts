import { discardBody, UPSTREAM_TIMEOUT_MILLISECONDS, type UpstreamClient } from './upstream-client'

export interface GitHubIssue {
  title: string
  body: string
  labels: string[]
}

/** Where an issue is filed and the token that allows it (fine-grained, Issues: write on that one repository). */
export interface GitHubTarget {
  /** `owner/name` */
  repository: string
  token: string
}

/** Whether the issue was filed. `reason` is for the server log, never for the player. */
export type GitHubIssueOutcome = { created: true } | { created: false; reason: string }

/** Files an issue through GitHub's REST API. */
export async function createGitHubIssue(
  issue: GitHubIssue,
  target: GitHubTarget,
  client: UpstreamClient,
): Promise<GitHubIssueOutcome> {
  let response: Response
  try {
    response = await client.fetch(`https://api.github.com/repos/${target.repository}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${target.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': client.userAgent,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(issue),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MILLISECONDS),
    })
  } catch {
    return { created: false, reason: 'GitHub could not be reached' }
  }
  await discardBody(response)
  return response.ok
    ? { created: true }
    : { created: false, reason: `GitHub answered ${response.status}` }
}
