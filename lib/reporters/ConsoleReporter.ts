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
    this.#maybePrintInconsistencies(
      'Not found on Trakt',
      episodesNotFoundOnTrakt,
      false
    )
    this.#maybePrintInconsistencies(
      'Missing from Kodi',
      episodesNotFoundInKodi,
      true
    )
    console.info()
  }

  #maybePrintInconsistencies (
    title: string,
    missingEpisodes: readonly Episode[],
    fromTrakt: boolean
  ) {
    if (missingEpisodes.length === 0) {
      return
    }
    console.info(INDENT1 + chalk.underline(title))
    for (const episode of missingEpisodes) {
      console.info(
        INDENT2 + chalk.yellow(this.#episodeToString(episode, fromTrakt))
      )
    }
  }

  #episodeToString (episode: Episode, isTraktEpisode: boolean) {
    const info = [`ID: ${episode.id}`]
    if (episode.imdbId != null) {
      info.push(
        'IMDB: ' + terminalLink(episode.imdbId, buildImdbUrl(episode.imdbId))
      )
    }
    let prefix = ''
    if (isTraktEpisode) {
      const { seasonNumber, episodeNumber, firstAired } =
        episode as TraktEpisode
      const episodeNumberPadded = String(episodeNumber).padStart(2, '0')
      prefix = `${seasonNumber}x${episodeNumberPadded}. `
      if (firstAired != null) {
        info.push('Aired: ' + firstAired.toLocaleDateString('en-US'))
      }
    }
    return prefix + episode.title + chalk.dim(SEPARATOR + info.join(SEPARATOR))
  }
}
