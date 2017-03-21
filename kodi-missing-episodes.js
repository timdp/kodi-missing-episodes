#!/usr/bin/env node

'use strict'

var Q = require('q')
var qlimit = require('qlimit')
var yargs = require('yargs')
var _ = require('lodash')
var EventEmitter = require('events').EventEmitter

Q.longStackSupport = true

var KEY_MAP_TVDB = {id: 'id', title: 'name', firstAired: 'firstAired'}
var KEY_MAP_KODI = {id: 'episodeid', title: 'originaltitle'}

var events = new EventEmitter()
var config = require('./config.json')
config.options = _.assign(config.options || {}, yargs.argv)

var context = {
  events: events,
  config: config
}
var format = config.options.format || 'text'
require('./lib/output/' + format).call(context)
var kodi = require('./lib/kodi').call(context)
var tvdb = require('./lib/tvdb').call(context)

var compareNum = function (a, b) {
  return a - b
}

var toInt = function (str) {
  return parseInt(str, 10)
}

var filterEpisodes = function (episodes, includeUnaired) {
  var now = new Date()
  return episodes.filter(function (episode) {
    var hasSeason = (episode.season > 0)
    var hasAired = (episode.firstAired != null && episode.firstAired < now)
    return ((!config.options.excludeSpecials || hasSeason) &&
      (includeUnaired || hasAired))
  })
}

var groupBySeason = function (episodes, numberKey, keyMap) {
  var result = {}
  episodes.forEach(function (episode) {
    var season = episode.season
    var number = episode[numberKey]
    result[season] = result[season] || {}
    var res = {}
    for (var key in keyMap) {
      if (keyMap.hasOwnProperty(key)) {
        res[key] = episode[keyMap[key]]
      }
    }
    result[season][number] = res
  })
  return result
}

var tvdbInit = function () {
  events.emit('tvdb_initializing')
  tvdb.init()
  events.emit('tvdb_initialized')
}

var tvdbFindShow = function (title) {
  events.emit('tvdb_finding_show', {title: title})
  return tvdb.findShow(title)
    .then(function (show) {
      events.emit('tvdb_found_show', {
        title: title,
        id: show.id,
        language: show.language
      })
      return show
    })
}

var tvdbGetEpisodesForShow = function (show) {
  var data = {
    title: show.name,
    id: show.id,
    language: show.language
  }
  events.emit('tvdb_getting_episodes', data)
  return tvdb.getEpisodes(show)
    .then(function (episodes) {
      events.emit('tvdb_got_episodes', _.assign({episodes: episodes}, data))
      return episodes
    })
}

var tvdbGetEpisodes = function (title) {
  return tvdbFindShow(title)
    .then(tvdbGetEpisodesForShow)
    .then(function (episodes) {
      episodes = filterEpisodes(episodes, config.options.includeUnaired)
      return groupBySeason(episodes, 'number', KEY_MAP_TVDB)
    })
}

var kodiConnect = function () {
  events.emit('kodi_connecting')
  return kodi.connect()
    .then(function () {
      events.emit('kodi_connected')
    })
}

var kodiDisconnect = function () {
  events.emit('kodi_disconnecting')
  return kodi.disconnect()
    .then(function () {
      events.emit('kodi_disconnected')
    })
}

var kodiGetEpisodes = function (title, id) {
  var data = {
    title: title,
    id: id
  }
  events.emit('kodi_getting_episodes', data)
  return kodi.getEpisodes(title, id)
    .then(function (episodes) {
      events.emit('kodi_got_episodes', _.assign({episodes: episodes}, data))
      episodes = filterEpisodes(episodes, true)
      return groupBySeason(episodes, 'episode', KEY_MAP_KODI)
    })
}

var removeSeasonsBefore = function (firstSeason, tvdbEps) {
  var seasons = Object.keys(tvdbEps).map(toInt)
    .filter(function (season) {
      return (season && season < firstSeason)
    })
  seasons.forEach(function (season) {
    delete tvdbEps[season]
  })
  return seasons
}

var removeEpisodesBefore = function (firstSeason, firstEpisode, tvdbEps) {
  var episodes = Object.keys(tvdbEps[firstSeason]).map(toInt)
    .filter(function (episode) {
      return (episode < firstEpisode)
    })
  episodes.forEach(function (episode) {
    delete tvdbEps[firstSeason][episode]
  })
  return episodes
}

var removeOldEpisodes = function (title, tvdbEps, kodiEps) {
  var firstSeason = _.min(Object.keys(kodiEps).filter(_.identity).map(toInt))
  if (firstSeason) {
    var firstEpisode = _.min(Object.keys(kodiEps[firstSeason]).map(toInt))
    if (firstSeason > 1 || firstEpisode > 1) {
      var data = {
        title: title,
        season: firstSeason,
        episode: firstEpisode
      }
      events.emit('excluding_episodes_before', data)
      data = _.assign({}, data)
      data.seasons = removeSeasonsBefore(firstSeason, tvdbEps)
      data.episodes = removeEpisodesBefore(firstSeason, firstEpisode, tvdbEps)
      events.emit('excluded_episodes_before', data)
    }
  }
}

var buildSeasonFilter = function (tvdbEps, kodiEps, missingSeasons) {
  return function (tvdbSeason) {
    if (!kodiEps.hasOwnProperty(tvdbSeason)) {
      var episodeNums = Object.keys(tvdbEps[tvdbSeason])
      var firstAired = episodeNums
        .map(function (episodeNum) {
          return tvdbEps[tvdbSeason][episodeNum].firstAired
        })
        .filter(function (firstAired) {
          return (firstAired != null)
        })
        .reduce(function (prev, curr) {
          return (curr < prev) ? curr : prev
        })
      missingSeasons.push({
        season: tvdbSeason,
        episodeCount: episodeNums.length,
        firstAired: firstAired
      })
      return false
    } else {
      return true
    }
  }
}

var buildEpisodeWalker = function (tvdbEps, kodiEps, missingEpisodes) {
  return function (tvdbSeasonNum) {
    Object.keys(tvdbEps[tvdbSeasonNum])
      .map(toInt)
      .filter(function (tvdbEpisodeNum) {
        return !kodiEps[tvdbSeasonNum].hasOwnProperty(tvdbEpisodeNum)
      })
      .sort(compareNum)
      .forEach(function (tvdbEpisodeNum) {
        var tvdbEpisode = tvdbEps[tvdbSeasonNum][tvdbEpisodeNum]
        missingEpisodes.push({
          season: tvdbSeasonNum,
          number: tvdbEpisodeNum,
          title: tvdbEpisode.title,
          firstAired: tvdbEpisode.firstAired
        })
      })
  }
}

var matchEpisodeInfo = function (title, tvdbEps, kodiEps) {
  var missingSeasons = []
  var missingEpisodes = []
  if (config.options.excludeOlder) {
    removeOldEpisodes(title, tvdbEps, kodiEps)
  }
  Object.keys(tvdbEps)
    .map(toInt)
    .filter(buildSeasonFilter(tvdbEps, kodiEps, missingSeasons))
    .sort(compareNum)
    .forEach(buildEpisodeWalker(tvdbEps, kodiEps, missingEpisodes))
  return {
    seasons: missingSeasons,
    episodes: missingEpisodes
  }
}

var processShow = function (data) {
  var title = data.label
  var id = data.tvshowid
  events.emit('processing_show', {
    title: title,
    id: id
  })
  return Q.all([title, tvdbGetEpisodes(title), kodiGetEpisodes(title, id)])
    .spread(matchEpisodeInfo)
    .then(function (missing) {
      events.emit('processed_show', _.assign({title: title}, missing))
    })
}

var processShows = function (shows) {
  events.emit('processing_shows', {shows: shows})
  var showsSorted = _.sortBy(shows, 'label')
  var limit = qlimit(config.options.concurrency || 1)
  return Q.all(showsSorted.map(limit(processShow)))
    .then(function () {
      events.emit('processed_shows', {shows: shows})
    })
}

var listAndProcessShows = function () {
  events.emit('kodi_listing_shows')
  return kodi.getShows()
    .then(function (shows) {
      events.emit('kodi_listed_shows', {shows: shows})
      return processShows(shows)
    })
}

var run = function () {
  return Q.all([tvdbInit(), kodiConnect()])
    .then(listAndProcessShows)
}

var handleError = function (err) {
  console.error(err.stack || JSON.stringify(err))
  process.exit(1)
}

run()
  .fail(handleError)
  .fin(kodiDisconnect)
