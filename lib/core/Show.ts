export class Show {
  readonly id: number
  readonly imdbId?: string
  readonly title: string

  constructor (id: number, imdbId: string | undefined, title: string) {
    this.id = id
    this.imdbId = imdbId
    this.title = title
  }
}
