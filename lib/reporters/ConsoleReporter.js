import chalk from 'chalk'
import terminalLink from 'terminal-link'

import { Reporter } from '../core/Reporter.js'
import { buildImdbUrl } from '../util/buildImdbUrl.js'

const INDENT1 = ' '.repeat(2)
const INDENT2 = INDENT1.repeat(2)
const SEPARATOR = ' · '

export class ConsoleReporter extends Reporter {
  onShowWithoutImdbId (kodiShow) {
    console.info(chalk.bold(kodiShow.title))
    console.info(INDENT1 + chalk.red('Show IMDB ID unknown'))
    console.info()
  }

  onShowNotFoundOnTrakt (kodiShow) {
    console.info(chalk.bold(kodiShow.title))
    console.info(INDENT1 + chalk.red('Show not found on Trakt'))
    console.info()
  }

  onShowConsistent (kodiShow) {
    if (!this.options.verbose) {
      return
    }
    console.info(chalk.bold(kodiShow.title))
    console.info(INDENT1 + chalk.green('Looking good'))
    console.info()
  }

  onShowInconsistent (
    kodiShow,
    episodesNotFoundOnTrakt,
    episodesNotFoundInKodi
  ) {
    console.info(chalk.bold(kodiShow.title))
    for (const [title, missingEpisodes, fromTrakt] of [
      ['Not found on Trakt', episodesNotFoundOnTrakt, false],
      ['Missing from Kodi', episodesNotFoundInKodi, true]
    ]) {
      if (missingEpisodes.length === 0) {
        continue
      }
      console.info(INDENT1 + chalk.underline(title))
      for (const episode of missingEpisodes) {
        console.info(
          INDENT2 + chalk.yellow(this.#episodeToString(episode, fromTrakt))
        )
      }
    }
    console.info()
  }

  #episodeToString (episode, isTraktEpisode) {
    const info = [`ID: ${episode.id}`]
    if (episode.imdbId != null) {
      info.push(
        'IMDB: ' + terminalLink(episode.imdbId, buildImdbUrl(episode.imdbId))
      )
    }
    let prefix = ''
    if (isTraktEpisode) {
      prefix =
        episode.seasonNumber +
        'x' +
        String(episode.episodeNumber).padStart(2, '0') +
        '. '
      if (episode.firstAired != null) {
        info.push('Aired: ' + episode.firstAired.toLocaleDateString('en-US'))
      }
    }
    return prefix + episode.title + chalk.dim(SEPARATOR + info.join(SEPARATOR))
  }
}
