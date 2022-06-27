import pMap from 'p-map'

import { KodiClient } from '../lib/kodi/KodiClient'
import { TraktClient } from '../lib/trakt/TraktClient'
import { Episode } from './core/Episode'
import { Reporter } from './core/Reporter'
import { KodiEpisode } from './kodi/KodiEpisode'
import { KodiShow } from './kodi/KodiShow'
import { TraktEpisode } from './trakt/TraktEpisode'
import { cullArray } from './util/cullArray'

const removeSpecials = (episodes: Episode[]) => {
  cullArray(episodes, (episode) => episode.seasonNumber !== 0)
}

const removeOlderEpisodes = (
  episodes: TraktEpisode[],
  referenceEpisode: KodiEpisode
) => {
  cullArray(
    episodes,
    (episode) =>
      episode.seasonNumber > referenceEpisode.seasonNumber ||
      (episode.seasonNumber === referenceEpisode.seasonNumber &&
        episode.episodeNumber >= referenceEpisode.episodeNumber)
  )
}

const removeUnairedEpisodes = (traktEpisodes: TraktEpisode[]) => {
  const now = new Date()
  cullArray(
    traktEpisodes,
    (traktEpisode) =>
      traktEpisode.firstAired == null || traktEpisode.firstAired < now
  )
}

const applySettings = (
  kodiEpisodes: KodiEpisode[],
  traktEpisodes: TraktEpisode[],
  settings: Record<string, any>
) => {
  if (settings.ignoreSpecials) {
    removeSpecials(kodiEpisodes)
    removeSpecials(traktEpisodes)
  }
  if (settings.newerOnly && kodiEpisodes.length > 0) {
    removeOlderEpisodes(traktEpisodes, kodiEpisodes[0])
  }
  if (settings.ignoreUnaired) {
    removeUnairedEpisodes(traktEpisodes)
  }
}

const sortByTitle = (shows: KodiShow[]) => {
  shows.sort((showA, showB) =>
    showA.title.toLowerCase().localeCompare(showB.title.toLowerCase())
  )
}

const intersect = <T1 extends Episode, T2 extends Episode>(
  completeEpisodes: T1[],
  incompleteEpisodes: T2[]
) =>
    completeEpisodes.filter(
      (sourceEpisode) =>
        !incompleteEpisodes.some((referenceEpisode) =>
          referenceEpisode.equals(sourceEpisode)
        )
    )

export const run = async (
  settings: Record<string, any>,
  reporter: Reporter
) => {
  reporter.onStart()

  const kodiClient = new KodiClient(settings.kodi)
  await kodiClient.connect()

  const traktClient = new TraktClient(settings.trakt)
  await traktClient.connect()

  reporter.onListKodiShows()

  const kodiShows = await kodiClient.listShows()
  sortByTitle(kodiShows)

  reporter.onProcessShows(kodiShows)

  await pMap(
    kodiShows,
    async (kodiShow) => {
      if (kodiShow.imdbId == null) {
        reporter.onShowWithoutImdbId(kodiShow)
        return
      }
      reporter.onListShowEpisodes(kodiShow)
      const [kodiEpisodes, traktShow] = await Promise.all([
        kodiClient.listShowEpisodes(kodiShow.id),
        traktClient.getShowByImdbId(kodiShow.imdbId)
      ])
      if (traktShow == null) {
        reporter.onShowNotFoundOnTrakt(kodiShow)
        return
      }
      const traktEpisodes = traktShow.episodes.slice()
      applySettings(kodiEpisodes, traktEpisodes, settings)
      const episodesNotFoundOnTrakt = intersect(kodiEpisodes, traktEpisodes)
      const episodesNotFoundInKodi = intersect(traktEpisodes, kodiEpisodes)
      if (
        episodesNotFoundOnTrakt.length === 0 &&
        episodesNotFoundInKodi.length === 0
      ) {
        reporter.onShowConsistent(kodiShow)
      } else {
        reporter.onShowInconsistent(
          kodiShow,
          episodesNotFoundOnTrakt,
          episodesNotFoundInKodi
        )
      }
    },
    { concurrency: settings.concurrency ?? 1 }
  )

  reporter.onComplete()

  kodiClient.disconnect()
}
