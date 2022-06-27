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
    for (const { title, missingEpisodes, fromTrakt } of [
      {
        title: 'Not found on Trakt',
        missingEpisodes: episodesNotFoundOnTrakt,
        fromTrakt: false
      },
      {
        title: 'Missing from Kodi',
        missingEpisodes: episodesNotFoundInKodi,
        fromTrakt: true
      }
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

  #episodeToString (episode: Episode, isTraktEpisode: boolean) {
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
      const { firstAired } = episode as TraktEpisode
      if (firstAired != null) {
        info.push('Aired: ' + firstAired.toLocaleDateString('en-US'))
      }
    }
    return prefix + episode.title + chalk.dim(SEPARATOR + info.join(SEPARATOR))
  }
}
