var XBMC = require('xbmc'),
    TVDB = require('tvdb'),
    Q = require('q'),
    qlimit = require('qlimit'),
    yargs = require('yargs'),
    _ = require('lodash');

Q.longStackSupport = true;

var config = require('./config.json');
config.options = _.assign(config.options || {}, yargs.argv);

var output = require('./lib/output')(config);
var prefix = require('./lib/prefix')(config);

var xbmc, tvdbs;

var compareNum = function(a, b) {
  return a - b;
};

var toInt = function(str) {
  return parseInt(str, 10);
};

var isFutureDate = function(date) {
  return (new Date(date) > new Date());
};

var tvdbGetEpisodes = function(title) {
  output.debug('Finding TheTVDB ID for %s', output.emph(title));
  var tvdb = null;
  return tvdbs.reduce(function(prev, curr) {
    return prev.then(function(results) {
      if (results.length) {
        return results;
      }
      tvdb = curr;
      return Q.ninvoke(curr, 'findTvShow', title);
    });
  }, Q([]))
  .then(function(results) {
    if (!results.length) {
      throw new Error('Show not found: ' + title);
    }
    return results[0];
  })
  .then(function(meta) {
    output.debug('Getting TheTVDB/%s episodes for %s (#%s)',
      meta.language, output.emph(title), meta.id);
    return Q.ninvoke(tvdb, 'getInfo', meta.id);
  })
  .then(function(info) {
    output.debug('TheTVDB episode count for %s: %d', output.emph(title),
      info.episodes.length);
    var tvdbEps = {};
    info.episodes.filter(function(episode) {
      return ((!config.options.excludeSpecials || episode.season > 0) &&
        (config.options.includeUnaired || !isFutureDate(episode.firstAired)));
    }).forEach(function(episode) {
      tvdbEps[episode.season] = tvdbEps[episode.season] || {};
      tvdbEps[episode.season][episode.number] = {
        id: episode.id,
        title: episode.name
      };
    });
    return tvdbEps;
  });
};

var xbmcGetEpisodes = function(title, id) {
  output.debug('Getting Kodi episodes for %s (#%d)',
    output.emph(title), id);
  return Q(xbmc.media.episodes(id, null, {
    properties: ['season', 'episode', 'originaltitle']
  }))
  .then(function(episodes) {
    output.debug('Kodi episode count for %s: %d',
      output.emph(title), episodes.length);
    var xbmcEps = {};
    episodes.filter(function(episode) {
      return (!config.options.excludeSpecials || episode.season > 0);
    }).forEach(function(episode) {
      xbmcEps[episode.season] = xbmcEps[episode.season] || {};
      xbmcEps[episode.season][episode.episode] = {
        id: episode.episodeid,
        title: episode.originaltitle
      };
    });
    return xbmcEps;
  });
};

var formatEpisodeNumber = function(season, number) {
  return 'S' + (season < 10 ? '0' : '') + season +
    'E' + (number < 10 ? '0' : '') + number;
};

var removeOldEpisodes = function(title, tvdbEps, xbmcEps) {
  var firstSeason = _.min(Object.keys(xbmcEps).filter(_.identity).map(toInt));
  if (firstSeason) {
    var firstEpisode = _.min(Object.keys(xbmcEps[firstSeason]).map(toInt));
    if (firstSeason > 1 || firstEpisode > 1) {
      output.debug('Excluding episodes of %s older than %s',
        output.emph(title),
        output.emph(formatEpisodeNumber(firstSeason, firstEpisode)));
      Object.keys(tvdbEps).map(toInt).filter(function(season) {
        return (season && season < firstSeason);
      }).forEach(function(season) {
        delete tvdbEps[season];
      });
      Object.keys(tvdbEps[firstSeason]).map(toInt).filter(function(episode) {
        return (episode < firstEpisode);
      }).forEach(function(episode) {
        delete tvdbEps[firstSeason][episode];
      });
    }
  }
};

var reportMissing = function(title, missingSeasons, missingEpisodes) {
  if (missingSeasons.length) {
    output.warn('%sMissing seasons for %s:', prefix.fail, output.emph(title));
    missingSeasons.forEach(function(item) {
      output.warn('%s%s (episodes: %s)',
        prefix.list,
        output.emph(item.season > 0 ? 'Season ' + item.season : 'Specials'),
        item.episodes);
    });
  }
  if (missingEpisodes.length) {
    output.warn('%sMissing episodes for %s:', prefix.fail, output.emph(title));
    missingEpisodes.forEach(function(item) {
      output.warn('%s%s: %s',
        prefix.list,
        output.emph(formatEpisodeNumber(item.season, item.number)),
        item.title);
    });
  }
  if (!missingSeasons.length && !missingEpisodes.length) {
    output.info(prefix.pass + 'No missing episodes for %s', output.emph(title));
  }
};

var matchEpisodeInfo = function(title, tvdbEps, xbmcEps) {
  var missingSeasons = [], missingEpisodes = [];
  if (config.options.excludeOlder) {
    removeOldEpisodes(title, tvdbEps, xbmcEps);
  }
  var tvdbSeasons = Object.keys(tvdbEps).map(toInt);
  tvdbSeasons.filter(function(tvdbSeason) {
    if (!xbmcEps.hasOwnProperty(tvdbSeason)) {
      missingSeasons.push({
        season: tvdbSeason,
        episodes: Object.keys(tvdbEps[tvdbSeason]).length
      });
      return false;
    } else {
      return true;
    }
  }).sort(compareNum).forEach(function(tvdbSeason) {
    var tvdbEpisodes = Object.keys(tvdbEps[tvdbSeason]).map(toInt);
    tvdbEpisodes.filter(function(tvdbEpisode) {
      return !xbmcEps[tvdbSeason].hasOwnProperty(tvdbEpisode);
    }).sort(compareNum).forEach(function(tvdbEpisode) {
      missingEpisodes.push({
        season: tvdbSeason,
        number: tvdbEpisode,
        title: tvdbEps[tvdbSeason][tvdbEpisode].title
      });
    });
  });
  reportMissing(title, missingSeasons, missingEpisodes);
};

var processShow = function(data, index, arr) {
  var title = data.label, id = data.tvshowid, total = arr.length;
  output.debug('Processing show %d of %d: %s',
    index + 1, total, output.emph(title));
  return Q.all([
    title,
    tvdbGetEpisodes(title),
    xbmcGetEpisodes(title, id)
  ]).spread(matchEpisodeInfo);
};

var processShows = function(shows) {
  output.debug('Found Kodi shows: %d', shows.length);
  var showsSorted = _.sortBy(shows, 'label');
  var limit = qlimit(config.options.concurrency || 1);
  return Q.all(showsSorted.map(limit(processShow)));
};

var run = function() {
  var dfd = Q.defer();
  var tvdbLangs = config.tvdb.languages || ['en'];
  delete config.tvdb.languages;
  tvdbs = tvdbLangs.map(function(lang) {
    return new TVDB(_.assign({}, config.tvdb, {language: lang}));
  });
  output.debug('Connecting to Kodi');
  xbmc = new XBMC.XbmcApi({
    connection: new XBMC.TCPConnection(config.xbmc),
    silent: true
  });
  xbmc.on('connection:open', function() {
    output.debug('Getting show list from Kodi');
    Q(xbmc.media.tvshows())
      .then(processShows)
      .then(dfd.resolve)
      .fail(dfd.reject);
  });
  xbmc.on('connection:error', dfd.reject);
  return dfd.promise;
};

run()
  .fail(function(err) {
    output.error(err.stack || JSON.stringify(err));
  })
  .fin(function() {
    output.debug('Disconnecting from Kodi');
    xbmc.disconnect();
  });
