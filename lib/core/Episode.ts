export class Episode {
  #id: number
  #imdbId?: string
  #seasonNumber: number
  #episodeNumber: number
  #title: string

  constructor (
    id: number,
    imdbId: string | undefined,
    seasonNumber: number,
    episodeNumber: number,
    title: string
  ) {
    this.#id = id
    this.#imdbId = imdbId
    this.#seasonNumber = seasonNumber
    this.#episodeNumber = episodeNumber
    this.#title = title
  }

  get id () {
    return this.#id
  }

  get imdbId () {
    return this.#imdbId
  }

  get seasonNumber () {
    return this.#seasonNumber
  }

  get episodeNumber () {
    return this.#episodeNumber
  }

  get title () {
    return this.#title
  }
}
