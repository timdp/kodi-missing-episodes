import { Episode } from '../core/Episode'

export class TraktEpisode extends Episode {
  readonly firstAired?: Date

  constructor (
    id: number,
    imdbId: string,
    seasonNumber: number,
    episodeNumber: number,
    title: string,
    firstAired: Date | undefined
  ) {
    super(id, imdbId, seasonNumber, episodeNumber, title)
    this.firstAired = firstAired
  }
}
