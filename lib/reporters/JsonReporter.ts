import ora, { Ora } from 'ora'

import { Episode } from '../core/Episode'
import { Reporter } from '../core/Reporter'
import { KodiEpisode } from '../kodi/KodiEpisode'
import { KodiShow } from '../kodi/KodiShow'
import { TraktEpisode } from '../trakt/TraktEpisode'
import { buildImdbUrl } from '../util/buildImdbUrl'

export class JsonReporter extends Reporter {
  #data: Record<string, Record<string, any>> = {
    showsWithoutImdbId: [],
    showsNotFoundOnTrakt: [],
    showsWithMissingEpisodes: [],
    showsWithoutMissingEpisodes: []
  }

  #totalCount = 0
  #processedCount = 0
  #spinner?: Ora

  onListKodiShows () {
    if (this.options.verbose) {
      this.#spinner = ora({
        text: 'Listing shows',
        discardStdin: false
      }).start()
    }
  }

  onProcessShows (kodiShows: readonly KodiShow[]) {
    this.#totalCount = kodiShows.length
    this.#updateStatus()
  }

  onListShowEpisodes (kodiShow: KodiShow) {
    this.#updateStatus()
  }

  onShowWithoutImdbId (kodiShow: KodiShow) {
    this.#updateStatus()
    this.#data.showsWithoutImdbId.push(this.#showToJson(kodiShow))
  }

  onShowNotFoundOnTrakt (kodiShow: KodiShow) {
    this.#onShowProcessed()
    this.#data.showsNotFoundOnTrakt.push(this.#showToJson(kodiShow))
  }

  onShowConsistent (kodiShow: KodiShow) {
    this.#onShowProcessed()
    this.#data.showsWithoutMissingEpisodes.push(this.#showToJson(kodiShow))
  }

  onShowInconsistent (
    kodiShow: KodiShow,
    episodesNotFoundOnTrakt: readonly KodiEpisode[],
    episodesNotFoundInKodi: readonly TraktEpisode[]
  ) {
    this.#onShowProcessed()
    this.#data.showsWithMissingEpisodes.push({
      ...this.#showToJson(kodiShow),
      episodesNotFoundOnTrakt: episodesNotFoundOnTrakt.map((kodiEpisode) =>
        this.#episodeToJson(kodiEpisode, false)
      ),
      episodesNotFoundInKodi: episodesNotFoundInKodi.map((traktEpisode) =>
        this.#episodeToJson(traktEpisode, true)
      )
    })
  }

  onComplete () {
    this.#spinner?.succeed()
    console.log(JSON.stringify(this.#data, null, 2))
  }

  #onShowProcessed () {
    this.#processedCount++
    this.#updateStatus()
  }

  #updateStatus () {
    if (this.#spinner == null) {
      return
    }
    const processed = this.#processedCount.toLocaleString('en-US')
    const total = this.#totalCount.toLocaleString('en-US')
    this.#spinner.text = `${processed}/${total} shows processed`
  }

  #showToJson (kodiShow: KodiShow) {
    const json: Record<string, any> = {
      title: kodiShow.title,
      id: kodiShow.id
    }
    if (kodiShow.imdbId != null) {
      json.imdbUrl = buildImdbUrl(kodiShow.imdbId)
    }
    return json
  }

  #episodeToJson (episode: Episode, isTraktEpisode: boolean) {
    const json: Record<string, any> = {
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      id: episode.id
    }
    if (episode.imdbId != null) {
      json.imdbUrl = buildImdbUrl(episode.imdbId)
    }
    if (isTraktEpisode) {
      const { firstAired } = episode as TraktEpisode
      if (firstAired != null) {
        json.firstAired = firstAired.toISOString()
      }
    }
    return json
  }
}
