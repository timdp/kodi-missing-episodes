'use strict'

var chalk = require('chalk')
var _ = require('lodash')

var formatEpisodeNumber = function (season, number) {
  return 'S' + (season < 10 ? '0' : '') + season +
    'E' + (number < 10 ? '0' : '') + number
}

module.exports = function () {
  var cons = require('./text/console').call(this),
    prefix = require('./text/prefix').call(this)

  var emph = this.config.options.color ? chalk.bold : _.identity
  var output = {
    error: cons('error'),
    warn: cons('warn'),
    info: cons('info'),
    debug: this.config.options.verbose ? cons('info', 'debug') : _.noop
  }

  var showCount, showIndex

  this.events.on('kodi_connecting', function () {
    output.debug('Connecting to Kodi')
  })

  this.events.on('kodi_disconnecting', function () {
    output.debug('Disconnecting from Kodi')
  })

  this.events.on('kodi_listing_shows', function () {
    output.debug('Getting show list from Kodi')
  })

  this.events.on('kodi_listed_shows', function (data) {
    output.debug('Found Kodi shows: %d',
      data.shows.length)
  })

  this.events.on('kodi_getting_episodes', function (data) {
    output.debug('Getting Kodi episodes for %s (#%d)',
      emph(data.title),
      data.id)
  })

  this.events.on('kodi_got_episodes', function (data) {
    output.debug('Kodi episode count for %s: %d',
      emph(data.title),
      data.episodes.length)
  })

  this.events.on('tvdb_finding_show', function (data) {
    output.debug('Finding TheTVDB ID for %s',
      emph(data.title))
  })

  this.events.on('tvdb_getting_episodes', function (data) {
    output.debug('Getting TheTVDB/%s episodes for %s (#%s)',
      data.language,
      emph(data.title),
      data.id)
  })

  this.events.on('tvdb_got_episodes', function (data) {
    output.debug('TheTVDB episode count for %s: %d',
      emph(data.title),
      data.episodes.length)
  })

  this.events.on('excluding_episodes_before', function (data) {
    output.debug('Excluding episodes of %s older than %s',
      emph(data.title),
      emph(formatEpisodeNumber(data.season, data.episode)))
  })

  this.events.on('processing_shows', function (data) {
    showCount = data.shows.length
    showIndex = 0
    output.debug('Processing %d shows',
      showCount)
  })

  this.events.on('processed_shows', function (data) {
    output.debug('Processed %d shows',
      data.shows.length)
  })

  this.events.on('processing_show', function (data) {
    output.debug('Processing show %d of %d: %s',
      ++showIndex,
      showCount,
      emph(data.title))
  })

  this.events.on('processed_show', function (data) {
    if (data.seasons.length) {
      output.warn('%sMissing seasons for %s:',
        prefix.fail,
        emph(data.title))
      data.seasons.forEach(function (item) {
        output.warn('%s%s (episodes: %s)',
          prefix.list,
          emph(item.season > 0 ? 'Season ' + item.season : 'Specials'),
          item.episodes)
      })
    }
    if (data.episodes.length) {
      output.warn('%sMissing episodes for %s:',
        prefix.fail,
        emph(data.title))
      data.episodes.forEach(function (item) {
        output.warn('%s%s: %s',
          prefix.list,
          emph(formatEpisodeNumber(item.season, item.number)),
          item.title)
      })
    }
    if (!data.seasons.length && !data.episodes.length) {
      output.info(prefix.pass + 'No missing episodes for %s',
        emph(data.title))
    }
  })
}
