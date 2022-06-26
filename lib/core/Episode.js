export class Episode {
  #id
  #imdbId
  #seasonNumber
  #episodeNumber
  #title

  constructor (id, imdbId, seasonNumber, episodeNumber, title) {
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

  equals (other) {
    return this.#imdbId != null && other.#imdbId != null
      ? this.#imdbId === other.#imdbId
      : this.#seasonNumber === other.#seasonNumber &&
          this.#episodeNumber === other.#episodeNumber
  }
}
