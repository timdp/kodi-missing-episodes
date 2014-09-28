var XBMC = require('xbmc');
var TVDB = require('tvdb');
var Q = require('q');
var chalk = require('chalk');
var minimist = require('minimist');

var config = require('./config.json');
config.options = config.options || {};

var opts = ['excludeSpecials', 'includeUnaired', 'verbose'];
var argv = minimist(process.argv.slice(2), {
  'boolean': opts
});
opts.filter(function(opt) {
  return argv[opt];
}).forEach(function(opt) {
  config.options[opt] = true;
});

var FMT_ERROR, FMT_INFO, FMT_TITLE, FMT_MISSING;
var verbose;
if (config.options.verbose) {
  FMT_ERROR = chalk.bold.red;
  FMT_INFO = chalk.cyan;
  FMT_TITLE = chalk.bold;
  FMT_MISSING = chalk.bold;
  verbose = function() {
    console.info.apply(console.info, arguments);
  };
} else {
  FMT_ERROR = FMT_INFO = FMT_TITLE = FMT_MISSING = function(s) {
    return s;
  };
  verbose = function() {};
}

var xbmc, tvdb;

var SORT_NUMERIC = function(a, b) {
  return a - b;
};

var logError = function(err) {
  console.error(FMT_ERROR(err.stack || err));
};

var isFutureDate = function(date) {
  return (new Date(date) > new Date());
};

var tvdbGetEpisodes = function(title) {
  verbose('Finding TheTVDB ID for %s', FMT_TITLE(title));
  return Q.nfcall(tvdb.findTvShow.bind(tvdb), title)
  .then(function(results) {
    if (results.length === 0) {
      throw new Error('Show not found: ' + title);
    }
    return results[0].id;
  })
  .then(function(id) {
    verbose('Getting TheTVDB episodes for %s (#%s)', FMT_TITLE(title), id);
    return Q.nfcall(tvdb.getInfo.bind(tvdb), id);
  })
  .then(function(info) {
    verbose('TheTVDB Episode count for %s: %d', FMT_TITLE(title),
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
  verbose('Getting Kodi episodes for %s (#%d)', FMT_TITLE(title), id);
  var dfd = Q.defer();
  xbmc.media.episodes(id, null, {
    properties: ['season', 'episode', 'originaltitle']
  }, function(episodes) {
    verbose('Kodi episode count for %s: %d', FMT_TITLE(title), episodes.length);
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
    dfd.resolve(xbmcEps);
  }, dfd.reject);
  return dfd.promise;
};

var reportMissing = function(title, missingSeasons, missingEpisodes) {
  var bullet = String.fromCharCode(0x2022);
  if (missingSeasons.length) {
    console.info(FMT_INFO('Missing seasons for %s:'), FMT_TITLE(title));
    missingSeasons.forEach(function(item) {
      console.info('%s %s (episodes: %s)',
        bullet,
        FMT_MISSING(item.season > 0 ? 'Season ' + item.season : 'Specials'),
        item.episodes);
    });
  }
  if (missingEpisodes.length) {
    console.info(FMT_INFO('Missing episodes for %s:'), FMT_TITLE(title));
    missingEpisodes.forEach(function(item) {
      console.info('%s %s: %s',
        bullet,
        FMT_MISSING(
          'S' + (item.season < 10 ? '0' : '') + item.season +
          'E' + (item.number < 10 ? '0' : '') + item.number
        ),
        item.title);
    });
  }
  if (!missingSeasons.length && !missingEpisodes.length) {
    verbose(FMT_INFO('No missing episodes for %s'), FMT_TITLE(title));
  }
};

var matchEpisodeInfo = function(title, tvdbEps, xbmcEps) {
  var missingSeasons = [], missingEpisodes = [];
  Object.keys(tvdbEps).sort(SORT_NUMERIC).filter(function(tvdbSeason) {
    if (!xbmcEps.hasOwnProperty(tvdbSeason)) {
      missingSeasons.push({
        season: tvdbSeason,
        episodes: Object.keys(tvdbEps[tvdbSeason]).length
      });
      return false;
    } else {
      return true;
    }
  }).forEach(function(tvdbSeason) {
    Object.keys(tvdbEps[tvdbSeason]).sort(SORT_NUMERIC)
    .filter(function(tvdbEpisode) {
      return !xbmcEps[tvdbSeason].hasOwnProperty(tvdbEpisode);
    }).forEach(function(tvdbEpisode) {
      missingEpisodes.push({
        season: tvdbSeason,
        number: tvdbEpisode,
        title: tvdbEps[tvdbSeason][tvdbEpisode].title
      });
    });
  });
  reportMissing(title, missingSeasons, missingEpisodes);
};

var getShowPromise = function(title, id, cnt, total) {
  return function() {
    verbose('Processing show %d of %d: %s', cnt, total, FMT_TITLE(title));
    return Q.all([
      title,
      tvdbGetEpisodes(title),
      xbmcGetEpisodes(title, id)
    ]).spread(matchEpisodeInfo);
  };
};

var processShows = function(shows) {
  var showCount = shows.length;
  verbose('Found Kodi shows: %d', showCount);
  var i = 0;
  return shows.reduce(function(curr, show) {
    return curr.then(getShowPromise(show.label, show.tvshowid, ++i, showCount));
  }, Q());
};

var run = function() {
  var dfd = Q.defer();
  tvdb = new TVDB(config.tvdb);
  verbose('Connecting to Kodi');
  xbmc = new XBMC.XbmcApi({
    connection: new XBMC.TCPConnection(config.xbmc),
    silent: true
  });
  xbmc.on('connection:open', function() {
    verbose('Getting show list from Kodi');
    xbmc.media.tvshows().then(function(shows) {
      processShows(shows).fail(dfd.reject);
    });
  });
  xbmc.on('connection:error', dfd.reject);
  return dfd.promise;
};

run()
  .fail(logError)
  .fin(function() {
    verbose('Disconnecting from Kodi');
    xbmc.disconnect();
  });
