import pMap from 'p-map'

import { KodiClient } from '../lib/kodi/KodiClient'
import { TraktClient } from '../lib/trakt/TraktClient'
import { Episode } from './core/Episode'
import { Reporter } from './core/Reporter'
import { KodiEpisode } from './kodi/KodiEpisode'
import { KodiOptions } from './kodi/KodiOptions'
import { KodiShow } from './kodi/KodiShow'
import { TraktEpisode } from './trakt/TraktEpisode'
import { TraktOptions } from './trakt/TraktOptions'
import { cullArray } from './util/cullArray'

type Settings = {
  kodi: KodiOptions
  trakt: TraktOptions
  newerOnly?: boolean
  ignoreSpecials?: boolean
  ignoreUnaired?: boolean
  concurrency?: number
}

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
  settings: Settings
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
  shows.sort((one, other) =>
    one.title.toLowerCase().localeCompare(other.title.toLowerCase())
  )
}

const episodesEqual = (one: Episode, other: Episode) =>
  one.imdbId != null && other.imdbId != null
    ? one.imdbId === other.imdbId
    : one.seasonNumber === other.seasonNumber &&
      one.episodeNumber === other.episodeNumber

const difference = <T1 extends Episode, T2 extends Episode>(
  full: T1[],
  partial: T2[]
) => full.filter((one) => !partial.some((other) => episodesEqual(one, other)))

export const run = async (settings: Settings, reporter: Reporter) => {
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
      const episodesNotFoundOnTrakt = difference(kodiEpisodes, traktEpisodes)
      const episodesNotFoundInKodi = difference(traktEpisodes, kodiEpisodes)
      const isConsistent =
        episodesNotFoundOnTrakt.length === 0 &&
        episodesNotFoundInKodi.length === 0
      if (isConsistent) {
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
