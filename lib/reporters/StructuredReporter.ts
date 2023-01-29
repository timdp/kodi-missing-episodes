import { EOL } from 'node:os'

import YAML from 'js-yaml'
import ora, { Ora } from 'ora'

import { Episode } from '../core/Episode'
import { Reporter } from '../core/Reporter'
import { KodiEpisode } from '../kodi/KodiEpisode'
import { KodiShow } from '../kodi/KodiShow'
import { TraktEpisode } from '../trakt/TraktEpisode'
import { buildImdbUrl } from '../util/buildImdbUrl'

type PropValue = string | number

type Props = Record<string, PropValue>

type Data = Record<string, Record<string, PropValue | Props[]>[]>

export class StructuredReporter extends Reporter {
  #data: Data = {
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
      this.#spinner = ora('Listing shows').start()
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
        this.#episodeToJson(kodiEpisode)
      ),
      episodesNotFoundInKodi: episodesNotFoundInKodi.map((traktEpisode) =>
        this.#traktEpisodeToJson(traktEpisode)
      )
    })
  }

  onComplete () {
    this.#spinner?.succeed()
    process.stdout.write(
      this.options.format === 'yaml'
        ? YAML.dump(this.#data)
        : JSON.stringify(this.#data, null, 2) + EOL
    )
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
    const json: Props = {
      title: kodiShow.title,
      id: kodiShow.id
    }
    if (kodiShow.imdbId != null) {
      json.imdbUrl = buildImdbUrl(kodiShow.imdbId)
    }
    return json
  }

  #traktEpisodeToJson (episode: TraktEpisode) {
    const json = this.#episodeToJson(episode)
    if (episode.firstAired != null) {
      json.firstAired = episode.firstAired.toISOString()
    }
    return json
  }

  #episodeToJson (episode: Episode) {
    const json: Props = {
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      id: episode.id
    }
    if (episode.imdbId != null) {
      json.imdbUrl = buildImdbUrl(episode.imdbId)
    }
    return json
  }
}
