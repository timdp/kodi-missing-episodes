export class Episode {
  constructor (id, imdbId, seasonNumber, episodeNumber, title) {
    this._id = id
    this._imdbId = imdbId
    this._seasonNumber = seasonNumber
    this._episodeNumber = episodeNumber
    this._title = title
  }

  get id () {
    return this._id
  }

  get imdbId () {
    return this._imdbId
  }

  get seasonNumber () {
    return this._seasonNumber
  }

  get episodeNumber () {
    return this._episodeNumber
  }

  get title () {
    return this._title
  }

  equals (other) {
    return this._imdbId != null && other._imdbId != null
      ? this._imdbId === other._imdbId
      : this._seasonNumber === other._seasonNumber &&
          this._episodeNumber === other._episodeNumber
  }

  toString () {
    return `${this._title} (ID: ${this._id}, IMDB: ${
      this._imdbId ?? '<unknown>'
    })`
  }
}
