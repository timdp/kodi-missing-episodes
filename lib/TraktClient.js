import open from 'open'
import Trakt from 'trakt.tv'

import { config } from './config.js'
import { TraktEpisode } from './TraktEpisode.js'
import { TraktShow } from './TraktShow.js'

export class TraktClient {
  constructor (options) {
    this._options = options
  }

  async connect () {
    this._api = new Trakt({
      client_id: this._options.clientId,
      client_secret: this._options.clientSecret
    })
    const oldToken = config.get('trakt.token')
    let token = null
    if (oldToken != null) {
      try {
        token = await this._api.import_token(oldToken)
      } catch (error) {
        console.warn('Token import failed:', error)
      }
    }
    if (token == null) {
      const poll = await this._api.get_codes()
      console.info('Code:', poll.user_code)
      await open(poll.verification_url)
      token = await this._api.poll_access(poll)
    }
    config.set('trakt.token', token)
  }

  async getShowByImdbId (imdbId) {
    const [result] = await this._api.search.id({
      id_type: 'imdb',
      id: imdbId
    })
    if (result == null || result.type !== 'show') {
      return null
    }
    const id = result.show.ids.trakt
    const seasons = await this._api.seasons.summary({
      id,
      extended: 'full,episodes'
    })
    return new TraktShow(
      id,
      result.show.title,
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
}
