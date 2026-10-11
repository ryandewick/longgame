import { describe, expect, it } from 'vitest'
import { lookUpAccountType, lookUpHiscores } from '~~/server/utils/jagex'
import type { UpstreamClient } from '~~/server/utils/upstream-client'

const USER_AGENT = 'LongGame/1.0 (free fan tool; https://longgame.tools)'
const FETCHED_AT = 1_791_670_000_000

interface RecordedRequest {
  url: string
  headers: Headers
}

/** A client whose `fetch` answers with `respond` and records what it was asked. */
function clientThat(respond: () => Response | Promise<Response>) {
  const requests: RecordedRequest[] = []
  const client: UpstreamClient = {
    userAgent: USER_AGENT,
    fetch: async (url, init) => {
      requests.push({ url, headers: new Headers(init.headers) })
      return respond()
    },
  }
  return { client, requests }
}

function unreachable(): never {
  throw new TypeError('fetch failed')
}

describe('lookUpHiscores', () => {
  it("returns Jagex's answer with the time it was fetched", async () => {
    const answer = { skills: [{ id: 0, name: 'Overall', level: 2277 }], activities: [] }
    const { client } = clientThat(() => Response.json(answer))
    expect(await lookUpHiscores('Zezima', client, () => FETCHED_AT)).toEqual({
      ok: true,
      value: { ...answer, fetched: FETCHED_AT },
    })
  })

  it('asks the main hiscores for the encoded name and says who is asking', async () => {
    const { client, requests } = clientThat(() => Response.json({}))
    await lookUpHiscores('Iron Man 99', client, () => FETCHED_AT)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe(
      'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=Iron%20Man%2099',
    )
    expect(requests[0]?.headers.get('User-Agent')).toBe(USER_AGENT)
    expect(requests[0]?.headers.get('Accept')).toBe('application/json')
  })

  it('explains a 404 as a name with no hiscores entry', async () => {
    const { client } = clientThat(() => new Response('<html>not found</html>', { status: 404 }))
    expect(await lookUpHiscores('nobody', client, () => FETCHED_AT)).toEqual({
      ok: false,
      failure: {
        statusCode: 404,
        message:
          'No hiscores entry for that name. Check the spelling, and note that brand-new accounts need a few levels first.',
      },
    })
  })

  it('reports any other status from Jagex', async () => {
    const { client } = clientThat(() => new Response('', { status: 503 }))
    expect(await lookUpHiscores('Zezima', client, () => FETCHED_AT)).toEqual({
      ok: false,
      failure: { statusCode: 502, message: 'Hiscores returned 503.' },
    })
  })

  it('says so when Jagex cannot be reached', async () => {
    const { client } = clientThat(unreachable)
    expect(await lookUpHiscores('Zezima', client, () => FETCHED_AT)).toEqual({
      ok: false,
      failure: {
        statusCode: 502,
        message: 'Could not reach the hiscores. Try again in a minute.',
      },
    })
  })

  it.each([
    ['a web page', '<html>busy</html>'],
    ['a list', '[1, 2]'],
    ['nothing', 'null'],
  ])('refuses an answer that is %s', async (_reason, body) => {
    const { client } = clientThat(() => new Response(body, { status: 200 }))
    expect(await lookUpHiscores('Zezima', client, () => FETCHED_AT)).toEqual({
      ok: false,
      failure: {
        statusCode: 502,
        message: 'The hiscores sent something unreadable. Try again in a minute.',
      },
    })
  })
})

describe('lookUpAccountType', () => {
  it('calls a name on the ironman hiscores an ironman', async () => {
    const { client, requests } = clientThat(() => Response.json({ skills: [] }))
    expect(await lookUpAccountType('Iron Man 99', client)).toEqual({ ok: true, value: 'ironman' })
    expect(requests[0]?.url).toBe(
      'https://secure.runescape.com/m=hiscore_oldschool_ironman/index_lite.json?player=Iron%20Man%2099',
    )
    expect(requests[0]?.headers.get('User-Agent')).toBe(USER_AGENT)
  })

  it('calls a name missing from the ironman hiscores a main', async () => {
    const { client } = clientThat(() => new Response('', { status: 404 }))
    expect(await lookUpAccountType('Zezima', client)).toEqual({ ok: true, value: 'main' })
  })

  it('reports any other status from Jagex', async () => {
    const { client } = clientThat(() => new Response('', { status: 500 }))
    expect(await lookUpAccountType('Zezima', client)).toEqual({
      ok: false,
      failure: { statusCode: 502, message: 'Hiscores returned 500.' },
    })
  })

  it('says so when Jagex cannot be reached', async () => {
    const { client } = clientThat(unreachable)
    expect(await lookUpAccountType('Zezima', client)).toEqual({
      ok: false,
      failure: { statusCode: 502, message: 'Could not reach the hiscores.' },
    })
  })
})
