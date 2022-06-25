#!/usr/bin/env node

import { KodiClient } from '../lib/KodiClient.js'
import { TraktClient } from '../lib/TraktClient.js'
import settings from '../settings.json' assert { type: 'json' }
import pMap from 'p-map'
import chalk from 'chalk'

const cullArray = (data, predicate) => {
  let i = data.length - 1
  while (i >= 0) {
    if (!predicate(data[i])) {
      data.splice(i, 1)
    }
    --i
  }
}

const removeSpecials = (episodes) => {
  cullArray(episodes, (episode) => episode.seasonNumber !== 0)
}

const removeOlderEpisodes = (episodes, referenceEpisode) => {
  cullArray(
    episodes,
    (episode) =>
      episode.seasonNumber > referenceEpisode.seasonNumber ||
      (episode.seasonNumber === referenceEpisode.seasonNumber &&
        episode.episodeNumber >= referenceEpisode.episodeNumber)
  )
}

const removeUnairedEpisodes = (traktEpisodes) => {
  const now = new Date()
  cullArray(
    traktEpisodes,
    (traktEpisode) =>
      traktEpisode.firstAired == null || traktEpisode.firstAired < now
  )
}

const sortByTitle = (shows) => {
  shows.sort((showA, showB) =>
    showA.title.toLowerCase().localeCompare(showB.title.toLowerCase())
  )
}

const printMissing = (completeEpisodes, incompleteEpisodes, title) => {
  const missingEpisodes = completeEpisodes.filter(
    (sourceEpisode) =>
      !incompleteEpisodes.some((referenceEpisode) =>
        referenceEpisode.equals(sourceEpisode)
      )
  )
  if (missingEpisodes.length > 0) {
    console.info(chalk.yellow('  ' + title + ':'))
    for (const episode of missingEpisodes) {
      console.info(chalk.yellow(' '.repeat(4) + episode))
    }
    console.info()
  }
  return missingEpisodes.length
}

const kodiClient = new KodiClient(settings.kodi)
await kodiClient.connect()

const traktClient = new TraktClient(settings.trakt)
await traktClient.connect()

const kodiShows = await kodiClient.listShows()
sortByTitle(kodiShows)

await pMap(
  kodiShows,
  async (kodiShow) => {
    console.info(chalk.bold(kodiShow.title))

    if (kodiShow.imdbId == null) {
      console.info(chalk.red('  Show IMDB ID unknown'))
      console.info()
      return
    }

    const [kodiEpisodes, traktShow] = await Promise.all([
      kodiClient.listShowEpisodes(kodiShow.id),
      traktClient.getShowByImdbId(kodiShow.imdbId)
    ])
    if (traktShow == null) {
      console.info(chalk.red('  Show not found on Trakt'))
      console.info()
      return
    }

    const traktEpisodes = traktShow.episodes

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

    const missingCount =
      printMissing(kodiEpisodes, traktEpisodes, 'Episodes not found on Trakt') +
      printMissing(traktEpisodes, kodiEpisodes, 'Episodes not found in Kodi')

    if (missingCount === 0) {
      console.info(chalk.green('  Looking good'))
      console.info()
    }
  },
  { concurrency: 1 }
)

kodiClient.disconnect()
