import pMap from 'p-map'
import xbmc from 'xbmc'

import { KodiEpisode } from './KodiEpisode.js'
import { KodiShow } from './KodiShow.js'

export class KodiClient {
  constructor (options) {
    this._options = options
  }

  async connect () {
    this._api = new xbmc.XbmcApi({
      connection: new xbmc.TCPConnection({
        host: this._options.hostname,
        port: this._options.port,
        username: this._options.username,
        password: this._options.password,
        connectNow: false
      }),
      silent: true
    })
    await new Promise((resolve, reject) => {
      this._api.on('connection:open', resolve)
      this._api.on('connection:error', reject)
      this._api.connect()
    })
  }

  disconnect () {
    this._api.disconnect()
  }

  async listShows () {
    const shows = await this._api.media.tvshows({
      properties: ['uniqueid']
    })
    return shows.map(
      ({ tvshowid, label, uniqueid }) =>
        new KodiShow(tvshowid, uniqueid?.imdb, label)
    )
  }

  async listShowEpisodes (id) {
    const episodes = await this._api.media.episodes(id, null, {
      properties: ['uniqueid', 'season', 'episode']
    })
    return episodes.map(
      ({ episodeid, label, season, episode, uniqueid }) =>
        new KodiEpisode(episodeid, uniqueid?.imdb, season, episode, label)
    )
  }
}
