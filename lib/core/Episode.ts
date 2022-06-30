export class Episode {
  readonly id: number
  readonly imdbId?: string
  readonly seasonNumber: number
  readonly episodeNumber: number
  readonly title: string

  constructor (
    id: number,
    imdbId: string | undefined,
    seasonNumber: number,
    episodeNumber: number,
    title: string
  ) {
    this.id = id
    this.imdbId = imdbId
    this.seasonNumber = seasonNumber
    this.episodeNumber = episodeNumber
    this.title = title
  }
}
