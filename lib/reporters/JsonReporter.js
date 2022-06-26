import ora from 'ora'

import { Reporter } from '../core/Reporter.js'
import { buildImdbUrl } from '../util/buildImdbUrl.js'

export class JsonReporter extends Reporter {
  #data = {
    showsWithoutImdbId: [],
    showsNotFoundOnTrakt: [],
    showsWithMissingEpisodes: [],
    showsWithoutMissingEpisodes: []
  }

  #totalCount = 0
  #processedCount = 0
  #activeCount = 0
  #spinner

  onListKodiShows () {
    if (this.options.verbose) {
      this.#spinner = ora({
        text: 'Listing shows',
        discardStdin: false
      }).start()
    }
  }

  onProcessShows (kodiShows) {
    this.#totalCount = kodiShows.length
    this.#updateStatus()
  }

  onListShowEpisodes (kodiShow) {
    this.#activeCount++
    this.#updateStatus()
  }

  onShowWithoutImdbId (kodiShow) {
    this.#activeCount--
    this.#updateStatus()
    this.#data.showsWithoutImdbId.push(this.#showToJson(kodiShow))
  }

  onShowNotFoundOnTrakt (kodiShow) {
    this.#onShowProcessed()
    this.#data.showsNotFoundOnTrakt.push(this.#showToJson(kodiShow))
  }

  onShowConsistent (kodiShow) {
    this.#onShowProcessed()
    this.#data.showsWithoutMissingEpisodes.push(this.#showToJson(kodiShow))
  }

  onShowInconsistent (
    kodiShow,
    episodesNotFoundOnTrakt,
    episodesNotFoundInKodi
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
    this.#activeCount--
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

  #showToJson (kodiShow) {
    const json = {
      title: kodiShow.title,
      id: kodiShow.id
    }
    if (kodiShow.imdbId != null) {
      json.imdbUrl = buildImdbUrl(kodiShow.imdbId)
    }
    return json
  }

  #episodeToJson (episode, isTraktEpisode) {
    const json = {
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      id: episode.id
    }
    if (episode.imdbId != null) {
      json.imdbUrl = buildImdbUrl(episode.imdbId)
    }
    if (isTraktEpisode && episode.firstAired != null) {
      json.firstAired = episode.firstAired.toISOString()
    }
    return json
  }
}
