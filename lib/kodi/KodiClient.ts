// @ts-ignore
import xbmc from 'xbmc'

import { KodiEpisode } from './KodiEpisode'
import { KodiShow } from './KodiShow'

export class KodiClient {
  #options: Record<string, any>
  #api: any

  constructor (options: Record<string, any>) {
    this.#options = options
  }

  async connect () {
    this.#api = new xbmc.XbmcApi({
      connection: new xbmc.TCPConnection({
        host: this.#options.hostname,
        port: this.#options.port,
        username: this.#options.username,
        password: this.#options.password,
        connectNow: false
      }),
      silent: true
    })
    await new Promise((resolve, reject) => {
      this.#api.on('connection:open', resolve)
      this.#api.on('connection:error', reject)
      this.#api.connect()
    })
  }

  disconnect () {
    this.#api.disconnect()
  }

  async listShows () {
    const shows: Record<string, any>[] = await this.#api.media.tvshows({
      properties: ['uniqueid']
    })
    return shows.map(
      ({ tvshowid, label, uniqueid }) =>
        new KodiShow(tvshowid, uniqueid?.imdb?.trim(), label)
    )
  }

  async listShowEpisodes (id: number) {
    const episodes: Record<string, any>[] = await this.#api.media.episodes(
      id,
      null,
      {
        properties: ['uniqueid', 'season', 'episode']
      }
    )
    return episodes.map(
      ({ episodeid, label, season, episode, uniqueid }) =>
        new KodiEpisode(
          episodeid,
          uniqueid?.imdb?.trim(),
          season,
          episode,
          label
        )
    )
  }
}
