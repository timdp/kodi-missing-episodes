import { Episode } from '../core/Episode'

export class TraktEpisode extends Episode {
  #firstAired: Date | null

  constructor (
    id: number,
    imdbId: string,
    seasonNumber: number,
    episodeNumber: number,
    title: string,
    firstAired: Date | null
  ) {
    super(id, imdbId, seasonNumber, episodeNumber, title)
    this.#firstAired = firstAired
  }

  get firstAired () {
    return this.#firstAired
  }
}
