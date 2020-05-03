'use strict'

const got = require('got')
const fs = require('fs').promises
const path = require('path')

const tokenPath = path.resolve(__dirname, '..', '.tvdb-session')

let languages
let token

const apiCall = async (endpoint, searchParams, headers, body) => {
  const options = {
    responseType: 'json',
    headers: { ...headers }
  }
  if (searchParams != null) {
    options.searchParams = searchParams
  }
  if (token != null) {
    options.headers.authorization = `Bearer ${token}`
  }
  if (body != null) {
    options.method = 'POST'
    options.json = body
  }
  const response = await got(`https://api.thetvdb.com/${endpoint}`, options)
  return response.body
}

const is404 = err =>
  err instanceof got.HTTPError && err.response.statusCode === 404

const readToken = async () => fs.readFile(tokenPath, 'utf8')

const writeToken = async token => fs.writeFile(tokenPath, token, 'utf8')

const readAndRefreshToken = async () => {
  token = await readToken()
  await apiCall('refresh_token')
}

const authenticateAndWriteToken = async config => {
  const { username, userKey: userkey, apiKey: apikey } = config
  const body = await apiCall('login', null, null, { username, userkey, apikey })
  token = body.token
  try {
    await writeToken(token)
  } catch (_) {}
}

const acquireToken = async config => {
  try {
    await readAndRefreshToken()
  } catch (err) {
    await authenticateAndWriteToken(config)
  }
}

const init = async config => {
  languages = config.languages || ['en']
  await acquireToken(config)
}

const findShow = async title => {
  for (const language of languages) {
    try {
      const { data } = await apiCall(
        'search/series',
        { name: title },
        { 'accept-language': language }
      )
      return { ...data[0], language }
    } catch (err) {
      if (!is404(err)) {
        throw new Error(
          `Failed to search for show "${title}" in ${language}: ${err}`
        )
      }
    }
  }
  throw new Error(`Show "${title} not found`)
}

const getEpisodes = async show => {
  const results = []
  let last = 1
  for (let page = 1; page <= last; ++page) {
    let body
    try {
      body = await apiCall(`series/${show.id}/episodes`, { page })
    } catch (err) {
      if (is404(err)) {
        break
      } else {
        throw new Error(`Failed to get episodes for show #${show.id}: ${err}`)
      }
    }
    const { data, links } = body
    last = links.last
    for (const episode of body.data) {
      episode.firstAired =
        episode.firstAired != null && episode.firstAired !== ''
          ? new Date(episode.firstAired + 'T00:00:00Z')
          : null
    }
    results.push(...data)
  }
  return results
}

module.exports = {
  init,
  findShow,
  getEpisodes
}
