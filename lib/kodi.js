'use strict'

var XBMC = require('xbmc')
var Q = require('q')

module.exports = function () {
  var xbmc

  var connect = function () {
    var dfd = Q.defer()
    xbmc = new XBMC.XbmcApi({
      connection: new XBMC.TCPConnection(this.config.kodi || this.config.xbmc),
      silent: true
    })
    xbmc.on('connection:open', dfd.resolve)
    xbmc.on('connection:error', dfd.reject)
    return dfd.promise
  }.bind(this)

  var disconnect = function () {
    return Q(xbmc.disconnect())
  }

  var getShows = function () {
    return Q(xbmc.media.tvshows())
  }

  var getEpisodes = function (title, id) {
    return Q(
      xbmc.media.episodes(id, null, {
        properties: ['season', 'episode', 'originaltitle']
      })
    )
  }

  return {
    connect: connect,
    disconnect: disconnect,
    getShows: getShows,
    getEpisodes: getEpisodes
  }
}
