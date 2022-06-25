import { Show } from './Show.js'

export class TraktShow extends Show {
  constructor (id, imdbId, title, episodes) {
    super(id, imdbId, title)
    this._episodes = episodes
  }

  get episodes () {
    return this._episodes
  }
}
