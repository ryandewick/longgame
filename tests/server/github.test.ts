import { describe, expect, it } from 'vitest'
import { createGitHubIssue, type GitHubIssue } from '~~/server/utils/github'
import type { UpstreamClient } from '~~/server/utils/upstream-client'

const issue: GitHubIssue = {
  title: '[Method] Mining 72: Volcanic Mine',
  body: '**Skill:** mining',
  labels: ['method suggestion'],
}
const target = { repository: 'ryandewick/longgame', token: 'test-token' }

interface RecordedRequest {
  url: string
  init: RequestInit
}

/** A client whose `fetch` answers with `respond` and records what it was asked. */
function clientThat(respond: () => Response) {
  const requests: RecordedRequest[] = []
  const client: UpstreamClient = {
    userAgent: 'LongGame/1.0 (free fan tool)',
    fetch: async (url, init) => {
      requests.push({ url, init })
      return respond()
    },
  }
  return { client, requests }
}

describe('createGitHubIssue', () => {
  it('posts the issue to the repository with the token', async () => {
    const { client, requests } = clientThat(() => Response.json({ number: 12 }, { status: 201 }))
    expect(await createGitHubIssue(issue, target, client)).toEqual({ created: true })

    expect(requests).toHaveLength(1)
    const request = requests[0]
    const headers = new Headers(request?.init.headers)
    expect(request?.url).toBe('https://api.github.com/repos/ryandewick/longgame/issues')
    expect(request?.init.method).toBe('POST')
    expect(headers.get('Authorization')).toBe('Bearer test-token')
    expect(headers.get('Accept')).toBe('application/vnd.github+json')
    expect(headers.get('User-Agent')).toBe('LongGame/1.0 (free fan tool)')
    expect(headers.get('X-GitHub-Api-Version')).toBe('2022-11-28')
    expect(JSON.parse(String(request?.init.body))).toEqual(issue)
  })

  it('reports the status when GitHub refuses', async () => {
    const { client } = clientThat(
      () => new Response('{"message":"Bad credentials"}', { status: 401 }),
    )
    expect(await createGitHubIssue(issue, target, client)).toEqual({
      created: false,
      reason: 'GitHub answered 401',
    })
  })

  it('says so when GitHub cannot be reached', async () => {
    const { client } = clientThat(() => {
      throw new TypeError('fetch failed')
    })
    expect(await createGitHubIssue(issue, target, client)).toEqual({
      created: false,
      reason: 'GitHub could not be reached',
    })
  })
})
