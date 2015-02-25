var XBMC = require('xbmc');
var TVDB = require('tvdb');
var Q = require('q');
var qlimit = require('qlimit');
var chalk = require('chalk');
var yargs = require('yargs');
var _ = require('lodash');

var config = require('./config.json');
config.options = _.assign(config.options || {}, yargs.argv);

Q.longStackSupport = true;

var FMT_ERROR, FMT_INFO, FMT_EMPH;
var verbose;
if (config.options.verbose) {
  FMT_ERROR = chalk.bold.red;
  FMT_INFO = chalk.cyan;
  FMT_EMPH = chalk.bold;
  verbose = console.info;
} else {
  FMT_ERROR = FMT_INFO = FMT_EMPH = function(s) {
    return s;
  };
  verbose = function() {};
}

var xbmc, tvdb;

var SORT_NUMERIC = function(a, b) {
  return a - b;
};

var TO_INT = function(str) {
  return parseInt(str, 10);
};

var isFutureDate = function(date) {
  return (new Date(date) > new Date());
};

var tvdbGetEpisodes = function(title) {
  verbose('Finding TheTVDB ID for %s', FMT_EMPH(title));
  return Q.nfcall(tvdb.findTvShow.bind(tvdb), title)
  .then(function(results) {
    if (!results.length) {
      throw new Error('Show not found: ' + title);
    }
    return results[0].id;
  })
  .then(function(id) {
    verbose('Getting TheTVDB episodes for %s (#%s)', FMT_EMPH(title), id);
    return Q.nfcall(tvdb.getInfo.bind(tvdb), id);
  })
  .then(function(info) {
    verbose('TheTVDB Episode count for %s: %d', FMT_EMPH(title),
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
  verbose('Getting Kodi episodes for %s (#%d)', FMT_EMPH(title), id);
  return Q(xbmc.media.episodes(id, null, {
    properties: ['season', 'episode', 'originaltitle']
  }))
  .then(function(episodes) {
    verbose('Kodi episode count for %s: %d', FMT_EMPH(title), episodes.length);
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
  var firstSeason = _.min(Object.keys(xbmcEps).filter(_.identity).map(TO_INT));
  if (firstSeason) {
    var firstEpisode = _.min(Object.keys(xbmcEps[firstSeason]).map(TO_INT));
    if (firstSeason > 1 || firstEpisode > 1) {
      verbose('Excluding episodes of %s older than %s', FMT_EMPH(title),
        FMT_EMPH(formatEpisodeNumber(firstSeason, firstEpisode)));
      Object.keys(tvdbEps).map(TO_INT).filter(function(season) {
        return (season && season < firstSeason);
      }).forEach(function(season) {
        delete tvdbEps[season];
      });
      Object.keys(tvdbEps[firstSeason]).map(TO_INT).filter(function(episode) {
        return (episode < firstEpisode);
      }).forEach(function(episode) {
        delete tvdbEps[firstSeason][episode];
      });
    }
  }
};

var reportMissing = function(title, missingSeasons, missingEpisodes) {
  var bullet = String.fromCharCode(0x2022);
  if (missingSeasons.length) {
    console.info(FMT_INFO('Missing seasons for %s:'), FMT_EMPH(title));
    missingSeasons.forEach(function(item) {
      console.info('%s %s (episodes: %s)',
        bullet,
        FMT_EMPH(item.season > 0 ? 'Season ' + item.season : 'Specials'),
        item.episodes);
    });
  }
  if (missingEpisodes.length) {
    console.info(FMT_INFO('Missing episodes for %s:'), FMT_EMPH(title));
    missingEpisodes.forEach(function(item) {
      console.info('%s %s: %s',
        bullet,
        FMT_EMPH(formatEpisodeNumber(item.season, item.number)),
        item.title);
    });
  }
  if (!missingSeasons.length && !missingEpisodes.length) {
    verbose(FMT_INFO('No missing episodes for %s'), FMT_EMPH(title));
  }
};

var matchEpisodeInfo = function(title, tvdbEps, xbmcEps) {
  var missingSeasons = [], missingEpisodes = [];
  if (config.options.excludeOlder) {
    removeOldEpisodes(title, tvdbEps, xbmcEps);
  }
  var tvdbSeasons = Object.keys(tvdbEps).map(TO_INT);
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
  }).sort(SORT_NUMERIC).forEach(function(tvdbSeason) {
    var tvdbEpisodes = Object.keys(tvdbEps[tvdbSeason]).map(TO_INT);
    tvdbEpisodes.filter(function(tvdbEpisode) {
      return !xbmcEps[tvdbSeason].hasOwnProperty(tvdbEpisode);
    }).sort(SORT_NUMERIC).forEach(function(tvdbEpisode) {
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
  verbose('Processing show %d of %d: %s', index + 1, total, FMT_EMPH(title));
  return Q.all([
    title,
    tvdbGetEpisodes(title),
    xbmcGetEpisodes(title, id)
  ]).spread(matchEpisodeInfo);
};

var processShows = function(shows) {
  verbose('Found Kodi shows: %d', shows.length);
  var limit = qlimit(config.options.concurrency || 3);
  return Q.all(shows.map(limit(processShow)));
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
    console.error(FMT_ERROR(err.stack || JSON.stringify(err)));
  })
  .fin(function() {
    verbose('Disconnecting from Kodi');
    xbmc.disconnect();
  });
