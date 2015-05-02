var XBMC = require('xbmc'),
    TVDB = require('tvdb'),
    Q = require('q'),
    qlimit = require('qlimit'),
    chalk = require('chalk'),
    yargs = require('yargs'),
    _ = require('lodash');

Q.longStackSupport = true;

var config = require('./config.json');
config.options = _.assign(config.options || {}, yargs.argv);

var consoleGet = (function() {
  var fmt = {};
  if (config.options.color) {
    fmt.error = chalk.bold.red;
    fmt.warn = chalk.yellow;
    fmt.info = chalk.cyan;
    fmt.debug = _.identity;
    fmt.emph = chalk.bold;
  } else {
    _.each(['error', 'warn', 'info', 'debug', 'emph'], function(fn) {
      fmt[fn] = _.identity;
    });
  }
  return function(func, format) {
    format = format || func;
    format = fmt[format];
    func = console[func];
    return function() {
      var args = Array.prototype.slice.call(arguments);
      args[0] = format(args[0]);
      func.apply(console, args);
    };
  };
})();

var error = consoleGet('error');
var warn = consoleGet('warn');
var info = consoleGet('info');
var debug = config.options.verbose ? consoleGet('info', 'debug') : _.noop;
var emph = config.options.color ? chalk.bold : _.identity;

var prefix = {};
if (config.options.decorate) {
  prefix.pass = '√ ';
  prefix.fail = '× ';
  prefix.list = '  • ';
} else {
  prefix.pass = prefix.fail = '';
  prefix.list = '- ';
}

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
  debug('Finding TheTVDB ID for %s', emph(title));
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
    debug('Getting TheTVDB/%s episodes for %s (#%s)',
      meta.language, emph(title), meta.id);
    return Q.ninvoke(tvdb, 'getInfo', meta.id);
  })
  .then(function(info) {
    debug('TheTVDB episode count for %s: %d', emph(title),
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
  debug('Getting Kodi episodes for %s (#%d)', emph(title), id);
  return Q(xbmc.media.episodes(id, null, {
    properties: ['season', 'episode', 'originaltitle']
  }))
  .then(function(episodes) {
    debug('Kodi episode count for %s: %d', emph(title), episodes.length);
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
      debug('Excluding episodes of %s older than %s', emph(title),
        emph(formatEpisodeNumber(firstSeason, firstEpisode)));
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
    warn('%sMissing seasons for %s:', prefix.fail, emph(title));
    missingSeasons.forEach(function(item) {
      warn('%s%s (episodes: %s)',
        prefix.list,
        emph(item.season > 0 ? 'Season ' + item.season : 'Specials'),
        item.episodes);
    });
  }
  if (missingEpisodes.length) {
    warn('%sMissing episodes for %s:', prefix.fail, emph(title));
    missingEpisodes.forEach(function(item) {
      warn('%s%s: %s',
        prefix.list,
        emph(formatEpisodeNumber(item.season, item.number)),
        item.title);
    });
  }
  if (!missingSeasons.length && !missingEpisodes.length) {
    info(prefix.pass + 'No missing episodes for %s', emph(title));
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
  debug('Processing show %d of %d: %s', index + 1, total, emph(title));
  return Q.all([
    title,
    tvdbGetEpisodes(title),
    xbmcGetEpisodes(title, id)
  ]).spread(matchEpisodeInfo);
};

var processShows = function(shows) {
  debug('Found Kodi shows: %d', shows.length);
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
  debug('Connecting to Kodi');
  xbmc = new XBMC.XbmcApi({
    connection: new XBMC.TCPConnection(config.xbmc),
    silent: true
  });
  xbmc.on('connection:open', function() {
    debug('Getting show list from Kodi');
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
    error(err.stack || JSON.stringify(err));
  })
  .fin(function() {
    debug('Disconnecting from Kodi');
    xbmc.disconnect();
  });
