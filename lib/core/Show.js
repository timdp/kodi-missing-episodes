export class Show {
  #id
  #imdbId
  #title

  constructor (id, imdbId, title) {
    this.#id = id
    this.#imdbId = imdbId
    this.#title = title
  }

  get id () {
    return this.#id
  }

  get imdbId () {
    return this.#imdbId
  }

  get title () {
    return this.#title
  }
}
