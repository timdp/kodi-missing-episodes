import open from 'open'
import parseDuration from 'parse-duration'
import Trakt from 'trakt.tv'

import { config } from '../core/config.js'
import { TraktEpisode } from './TraktEpisode.js'
import { TraktShow } from './TraktShow.js'

export class TraktClient {
  #options
  #maxCacheAge
  #api

  constructor (options) {
    this.#options = options
    this.#maxCacheAge =
      options.maxCacheAge != null ? parseDuration(options.maxCacheAge) : -1
  }

  async connect () {
    const key = 'trakt.token'
    this.#api = new Trakt({
      client_id: this.#options.clientId,
      client_secret: this.#options.clientSecret
    })
    const oldToken = config.get(key)
    let token = null
    if (oldToken != null) {
      try {
        token = await this.#api.import_token(oldToken)
      } catch (error) {
        console.warn('Token import failed:', error)
      }
    }
    if (token == null) {
      const poll = await this.#api.get_codes()
      console.info('Code:', poll.user_code)
      await open(poll.verification_url)
      token = await this.#api.poll_access(poll)
    }
    config.set(key, token)
  }

  async getShowByImdbId (imdbId) {
    const { id, title, seasons } = await this.#cachedGetShowByImdbId(imdbId)
    if (id == null) {
      return null
    }
    return new TraktShow(
      id,
      title,
      imdbId,
      seasons
        .map(({ episodes }) =>
          episodes.map(
            ({ ids, season, number, title, first_aired: firstAired }) =>
              new TraktEpisode(
                ids.trakt,
                ids.imdb,
                season,
                number,
                title,
                firstAired != null ? new Date(firstAired) : null
              )
          )
        )
        .flat()
    )
  }

  async #cachedGetShowByImdbId (imdbId) {
    const key = 'trakt.showCache.' + imdbId
    const entry = config.get(key)
    if (
      entry != null &&
      this.#maxCacheAge > 0 &&
      Date.now() - entry.timestamp < this.#maxCacheAge
    ) {
      return entry.data
    }
    const data = await this.#uncachedGetShowByImdbId(imdbId)
    config.set(key, {
      timestamp: Date.now(),
      data
    })
    return data
  }

  async #uncachedGetShowByImdbId (imdbId) {
    const [result] = await this.#api.search.id({
      id_type: 'imdb',
      id: imdbId
    })
    if (result == null || result.type !== 'show') {
      return {}
    }
    const {
      show: {
        title,
        ids: { trakt: id }
      }
    } = result
    const seasons = await this.#api.seasons.summary({
      id,
      extended: 'full,episodes'
    })
    return { id, title, seasons }
  }
}
