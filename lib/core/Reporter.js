export class Reporter {
  #options

  constructor (options) {
    this.#options = options
  }

  get options () {
    return this.#options
  }

  onStart () {}

  onListKodiShows () {}

  onProcessShows (kodiShows) {}

  onListShowEpisodes (kodiShow) {}

  onShowWithoutImdbId (kodiShow) {}

  onShowNotFoundOnTrakt (kodiShow) {}

  onShowConsistent (kodiShow) {}

  onShowInconsistent (
    kodiShow,
    episodesNotFoundOnTrakt,
    episodesNotFoundInKodi
  ) {}

  onComplete () {}
}
