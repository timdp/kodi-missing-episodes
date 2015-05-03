var XBMC = require('xbmc'),
    TVDB = require('tvdb'),
    Q = require('q'),
    qlimit = require('qlimit'),
    yargs = require('yargs'),
    _ = require('lodash'),
    EventEmitter = require('events').EventEmitter;

Q.longStackSupport = true;

var xbmc, tvdbs;
var events = new EventEmitter();
var config = require('./config.json');
config.options = _.assign(config.options || {}, yargs.argv);

var format = config.options.format || 'text';
require('./lib/output/' + format)(events, config);

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
  events.emit('tvdb_finding_show', {title: title});
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
    events.emit('tvdb_found_show', {
      title: title,
      id: results[0].id,
      language: results[0].language
    });
    return results[0];
  })
  .then(function(meta) {
    events.emit('tvdb_getting_episodes', {
      title: title,
      id: meta.id,
      language: meta.language
    });
    return Q.ninvoke(tvdb, 'getInfo', meta.id);
  })
  .then(function(info) {
    events.emit('tvdb_got_episodes', {
      title: title,
      episodes: info.episodes
    });
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
  events.emit('kodi_getting_episodes', {
    title: title,
    id: id
  });
  return Q(xbmc.media.episodes(id, null, {
    properties: ['season', 'episode', 'originaltitle']
  }))
  .then(function(episodes) {
    events.emit('kodi_got_episodes', {
      title: title,
      episodes: episodes
    });
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

var removeOldEpisodes = function(title, tvdbEps, xbmcEps) {
  var firstSeason = _.min(Object.keys(xbmcEps).filter(_.identity).map(toInt));
  if (firstSeason) {
    var firstEpisode = _.min(Object.keys(xbmcEps[firstSeason]).map(toInt));
    if (firstSeason > 1 || firstEpisode > 1) {
      events.emit('excluding_episodes_before', {
        title: title,
        season: firstSeason,
        episode: firstEpisode
      });
      var seasons = Object.keys(tvdbEps).map(toInt).filter(function(season) {
        return (season && season < firstSeason);
      });
      seasons.forEach(function(season) {
        delete tvdbEps[season];
      });
      var episodes = Object.keys(tvdbEps[firstSeason]).map(toInt).filter(function(episode) {
        return (episode < firstEpisode);
      });
      episodes.forEach.forEach(function(episode) {
        delete tvdbEps[firstSeason][episode];
      });
      events.emit('excluded_episodes_before', {
        title: title,
        season: firstSeason,
        episode: firstEpisode,
        seasons: seasons,
        episodes: episodes
      });
    }
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
  return {
    seasons: missingSeasons,
    episodes: missingEpisodes
  };
};

var processShow = function(data) {
  var title = data.label, id = data.tvshowid;
  events.emit('processing_show', {
    title: title,
    id: id
  });
  return Q.all([
    title,
    tvdbGetEpisodes(title),
    xbmcGetEpisodes(title, id)
  ]).spread(matchEpisodeInfo).then(function(missing) {
    events.emit('processed_show', _.assign({title: title}, missing));
  });
};

var processShows = function(shows) {
  events.emit('processing_shows', {shows: shows});
  var showsSorted = _.sortBy(shows, 'label');
  var limit = qlimit(config.options.concurrency || 1);
  return Q.all(showsSorted.map(limit(processShow)))
    .then(function() {
      events.emit('processed_shows', {shows: shows});
    });
};

var run = function() {
  var dfd = Q.defer();
  var tvdbLangs = config.tvdb.languages || ['en'];
  delete config.tvdb.languages;
  tvdbs = tvdbLangs.map(function(lang) {
    return new TVDB(_.assign({}, config.tvdb, {language: lang}));
  });
  events.emit('kodi_connecting');
  xbmc = new XBMC.XbmcApi({
    connection: new XBMC.TCPConnection(config.xbmc),
    silent: true
  });
  xbmc.on('connection:open', function() {
    events.emit('kodi_connected');
    events.emit('kodi_listing_shows');
    Q(xbmc.media.tvshows())
      .then(function(shows) {
        events.emit('kodi_listed_shows', {shows: shows});
        return processShows(shows);
      })
      .then(dfd.resolve, dfd.reject);
  });
  xbmc.on('connection:error', dfd.reject);
  return dfd.promise;
};

run()
  .fail(function(err) {
    console.error(err.stack || JSON.stringify(err));
  })
  .fin(function() {
    events.emit('kodi_disconnecting');
    Q(xbmc.disconnect())
      .then(function() {
        events.emit('kodi_disconnected');
      });
  });
