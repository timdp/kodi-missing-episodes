import chalk from 'chalk'
import terminalLink from 'terminal-link'

import { Episode } from '../core/Episode'
import { Reporter } from '../core/Reporter'
import { KodiEpisode } from '../kodi/KodiEpisode'
import { KodiShow } from '../kodi/KodiShow'
import { TraktEpisode } from '../trakt/TraktEpisode'
import { buildImdbUrl } from '../util/buildImdbUrl'

const INDENT1 = ' '.repeat(2)
const INDENT2 = INDENT1.repeat(2)
const SEPARATOR = ' · '

export class ConsoleReporter extends Reporter {
  onShowWithoutImdbId (kodiShow: KodiShow) {
    console.info(chalk.bold(kodiShow.title))
    console.info(INDENT1 + chalk.red('Show IMDB ID unknown'))
    console.info()
  }

  onShowNotFoundOnTrakt (kodiShow: KodiShow) {
    console.info(chalk.bold(kodiShow.title))
    console.info(INDENT1 + chalk.red('Show not found on Trakt'))
    console.info()
  }

  onShowConsistent (kodiShow: KodiShow) {
    if (!this.options.verbose) {
      return
    }
    console.info(chalk.bold(kodiShow.title))
    console.info(INDENT1 + chalk.green('Looking good'))
    console.info()
  }

  onShowInconsistent (
    kodiShow: KodiShow,
    episodesNotFoundOnTrakt: readonly KodiEpisode[],
    episodesNotFoundInKodi: readonly TraktEpisode[]
  ) {
    console.info(chalk.bold(kodiShow.title))
    this.#reportInconsistencies('Not found on Trakt', episodesNotFoundOnTrakt)
    this.#reportInconsistencies('Missing from Kodi', episodesNotFoundInKodi)
    console.info()
  }

  #reportInconsistencies (title: string, missingEpisodes: readonly Episode[]) {
    if (missingEpisodes.length === 0) {
      return
    }
    console.info(INDENT1 + chalk.underline(title))
    for (const episode of missingEpisodes) {
      console.info(INDENT2 + chalk.yellow(this.#episodeToString(episode)))
    }
  }

  #episodeToString (episode: Episode) {
    const episodeNumberPadded = String(episode.episodeNumber).padStart(2, '0')
    const prefix = `${episode.seasonNumber}x${episodeNumberPadded}. `
    const info = [`ID: ${episode.id}`]
    if (episode.imdbId != null) {
      const url = buildImdbUrl(episode.imdbId)
      info.push('IMDB: ' + terminalLink(episode.imdbId, url))
    }
    if (episode instanceof TraktEpisode && episode.firstAired != null) {
      info.push('Aired: ' + episode.firstAired.toLocaleDateString('en-US'))
    }
    const suffix = SEPARATOR + info.join(SEPARATOR)
    return chalk.bold(prefix) + episode.title + chalk.dim(suffix)
  }
}
