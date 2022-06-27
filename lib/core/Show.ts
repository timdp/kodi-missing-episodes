export class Show {
  #id: number
  #imdbId: string
  #title: string

  constructor (id: number, imdbId: string, title: string) {
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
