import { Show } from '../core/Show.js'

export class TraktShow extends Show {
  #episodes

  constructor (id, imdbId, title, episodes) {
    super(id, imdbId, title)
    this.#episodes = episodes
  }

  get episodes () {
    return this.#episodes
  }
}
