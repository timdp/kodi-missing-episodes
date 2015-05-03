var TVDB = require('tvdb')
var Q = require('q')
var _ = require('lodash')

module.exports = function () {
  var tvdbs

  var init = function () {
    var tvdbConfig = _.assign({}, this.config.tvdb)
    var tvdbLangs = tvdbConfig.languages || ['en']
    delete tvdbConfig.languages
    tvdbs = tvdbLangs.map(function (lang) {
      return new TVDB(_.assign({}, tvdbConfig, {language: lang}))
    })
  }.bind(this)

  var findShow = function (title) {
    var tvdbIdx = -1
    return tvdbs.reduce(function (prev, curr, idx) {
      return prev.then(function (results) {
        if (results.length) {
          return results
        }
        tvdbIdx = idx
        return Q.ninvoke(curr, 'findTvShow', title)
      })
    }, Q([]))
      .then(function (results) {
        if (!results.length) {
          throw new Error('Show not found: ' + title)
        }
        var show = results[0]
        show._tvdb = tvdbIdx
        return show
      })
  }

  var getEpisodes = function (show) {
    return Q.ninvoke(tvdbs[show._tvdb], 'getInfo', show.id)
      .then(function (info) {
        return info.episodes
      })
  }

  return {
    init: init,
    findShow: findShow,
    getEpisodes: getEpisodes
  }
}
