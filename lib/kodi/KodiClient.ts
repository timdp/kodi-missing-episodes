// @ts-ignore
import xbmc from 'xbmc'

import { KodiEpisode } from './KodiEpisode'
import { KodiOptions } from './KodiOptions'
import { KodiShow } from './KodiShow'

type UniqueId = {
  imdb?: string
}

type ShowInfo = {
  tvshowid: number
  title: string
  uniqueid?: UniqueId
}

type EpisodeInfo = {
  episodeid: number
  title: string
  season: number
  episode: number
  uniqueid?: UniqueId
}

export class KodiClient {
  #options: KodiOptions
  #api: any

  constructor (options: KodiOptions) {
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
    const shows: ShowInfo[] = await this.#api.media.tvshows({
      properties: ['uniqueid', 'title']
    })
    return shows.map(
      ({ tvshowid, title, uniqueid }) =>
        new KodiShow(tvshowid, uniqueid?.imdb?.trim(), title)
    )
  }

  async listShowEpisodes (id: number) {
    const episodes: EpisodeInfo[] = await this.#api.media.episodes(id, null, {
      properties: ['uniqueid', 'season', 'episode', 'title']
    })
    return episodes.map(
      ({ episodeid, title, season, episode, uniqueid }) =>
        new KodiEpisode(
          episodeid,
          uniqueid?.imdb?.trim(),
          season,
          episode,
          title
        )
    )
  }
}
