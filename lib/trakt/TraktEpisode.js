import { Episode } from '../core/Episode.js'

export class TraktEpisode extends Episode {
  #firstAired

  constructor (id, imdbId, seasonNumber, episodeNumber, title, firstAired) {
    super(id, imdbId, seasonNumber, episodeNumber, title)
    this.#firstAired = firstAired
  }

  get firstAired () {
    return this.#firstAired
  }
}
