import { KodiEpisode } from '../kodi/KodiEpisode'
import { KodiShow } from '../kodi/KodiShow'
import { TraktEpisode } from '../trakt/TraktEpisode'

export class Reporter {
  #options: Record<string, any>

  constructor (options: Record<string, any>) {
    this.#options = options
  }

  get options () {
    return this.#options
  }

  onStart () {}

  onListKodiShows () {}

  onProcessShows (kodiShows: readonly KodiShow[]) {}

  onListShowEpisodes (kodiShow: KodiShow) {}

  onShowWithoutImdbId (kodiShow: KodiShow) {}

  onShowNotFoundOnTrakt (kodiShow: KodiShow) {}

  onShowConsistent (kodiShow: KodiShow) {}

  onShowInconsistent (
    kodiShow: KodiShow,
    episodesNotFoundOnTrakt: readonly KodiEpisode[],
    episodesNotFoundInKodi: readonly TraktEpisode[]
  ) {}

  onComplete () {}
}
