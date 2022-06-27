import { KodiEpisode } from '../kodi/KodiEpisode'
import { KodiShow } from '../kodi/KodiShow'
import { TraktEpisode } from '../trakt/TraktEpisode'

type Options = Record<string, any>

export class Reporter {
  #options: Options

  constructor (options: Options) {
    this.#options = options
  }

  get options () {
    return this.#options
  }

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
