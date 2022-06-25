export class Show {
  constructor (id, imdbId, title) {
    this._id = id
    this._imdbId = imdbId
    this._title = title
  }

  get id () {
    return this._id
  }

  get imdbId () {
    return this._imdbId
  }

  get title () {
    return this._title
  }
}
