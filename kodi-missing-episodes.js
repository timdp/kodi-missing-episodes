var Q = require('q'),
    qlimit = require('qlimit'),
    yargs = require('yargs'),
    _ = require('lodash'),
    EventEmitter = require('events').EventEmitter;

Q.longStackSupport = true;

var events = new EventEmitter();
var config = require('./config.json');
config.options = _.assign(config.options || {}, yargs.argv);

var context = {
  events: events,
  config: config
};
var format = config.options.format || 'text';
require('./lib/output/' + format).call(context);
var kodi = require('./lib/kodi').call(context);
var tvdb = require('./lib/tvdb').call(context);

var compareNum = function(a, b) {
  return a - b;
};

var toInt = function(str) {
  return parseInt(str, 10);
};

var isFutureDate = function(date) {
  return (new Date(date) > new Date());
};

var filterEpisodes = function(episodes, noSpecials, noUnaired) {
  return episodes.filter(function(episode) {
    return ((!noSpecials || episode.season > 0) &&
      (!noUnaired || !isFutureDate(episode.firstAired)));
  });
};

var groupBySeason = function(episodes, numberKey, titleKey, idKey) {
  var result = {};
  episodes.forEach(function(episode) {
    var season = episode.season, number = episode[numberKey];
    result[season] = result[season] || {};
    result[season][number] = {
      id: episode[idKey],
      title: episode[titleKey]
    };
  });
  return result;
};

var tvdbInit = function() {
  events.emit('tvdb_initializing');
  tvdb.init();
  events.emit('tvdb_initialized');
};

var tvdbFindShow = function(title) {
  events.emit('tvdb_finding_show', {title: title});
  return tvdb.findShow(title)
    .then(function(show) {
      events.emit('tvdb_found_show', {
        title: title,
        id: show.id,
        language: show.language
      });
      return show;
    });
};

var tvdbGetEpisodesForShow = function(show) {
  var data = {
    title: show.name,
    id: show.id,
    language: show.language
  };
  events.emit('tvdb_getting_episodes', data);
  return tvdb.getEpisodes(show)
    .then(function(episodes) {
      events.emit('tvdb_got_episodes', _.assign({episodes: episodes}, data));
      return episodes;
    });
};

var tvdbGetEpisodes = function(title) {
  return tvdbFindShow(title)
    .then(tvdbGetEpisodesForShow)
    .then(function(episodes) {
      episodes = filterEpisodes(episodes, config.options.excludeSpecials,
        !config.options.includeUnaired);
      return groupBySeason(episodes, 'number', 'name', 'id');
    });
};

var kodiConnect = function() {
  events.emit('kodi_connecting');
  return kodi.connect()
    .then(function() {
      events.emit('kodi_connected');
    });
};

var kodiDisconnect = function() {
  events.emit('kodi_disconnecting');
  return kodi.disconnect()
    .then(function() {
      events.emit('kodi_disconnected');
    });
};

var kodiGetEpisodes = function(title, id) {
  var data = {
    title: title,
    id: id
  };
  events.emit('kodi_getting_episodes', data);
  return kodi.getEpisodes(title, id)
    .then(function(episodes) {
      events.emit('kodi_got_episodes', _.assign({episodes: episodes}, data));
      episodes = filterEpisodes(episodes, config.options.excludeSpecials);
      return groupBySeason(filterEpisodes(episodes),
        'episode', 'originaltitle', 'episodeid');
    });
};

var removeSeasonsBefore = function(firstSeason, tvdbEps) {
  var seasons = Object.keys(tvdbEps).map(toInt)
    .filter(function(season) {
      return (season && season < firstSeason);
    });
  seasons.forEach(function(season) {
    delete tvdbEps[season];
  });
  return seasons;
};

var removeEpisodesBefore = function(firstSeason, firstEpisode, tvdbEps) {
  var episodes = Object.keys(tvdbEps[firstSeason]).map(toInt)
    .filter(function(episode) {
      return (episode < firstEpisode);
    });
  episodes.forEach(function(episode) {
    delete tvdbEps[firstSeason][episode];
  });
  return episodes;
};

var removeOldEpisodes = function(title, tvdbEps, kodiEps) {
  var firstSeason = _.min(Object.keys(kodiEps).filter(_.identity).map(toInt));
  if (firstSeason) {
    var firstEpisode = _.min(Object.keys(kodiEps[firstSeason]).map(toInt));
    if (firstSeason > 1 || firstEpisode > 1) {
      var data = {
        title: title,
        season: firstSeason,
        episode: firstEpisode
      };
      events.emit('excluding_episodes_before', data);
      data = _.assign({}, data);
      data.seasons = removeSeasonsBefore(firstSeason, tvdbEps);
      data.episodes = removeEpisodesBefore(firstSeason, firstEpisode, tvdbEps);
      events.emit('excluded_episodes_before', data);
    }
  }
};

var buildSeasonFilter = function(tvdbEps, kodiEps, missingSeasons) {
  return function(tvdbSeason) {
    if (!kodiEps.hasOwnProperty(tvdbSeason)) {
      missingSeasons.push({
        season: tvdbSeason,
        episodes: Object.keys(tvdbEps[tvdbSeason]).length
      });
      return false;
    } else {
      return true;
    }
  };
};

var buildEpisodeWalker = function(tvdbEps, kodiEps, missingEpisodes) {
  return function(tvdbSeason) {
    Object.keys(tvdbEps[tvdbSeason])
      .map(toInt)
      .filter(function(tvdbEpisode) {
        return !kodiEps[tvdbSeason].hasOwnProperty(tvdbEpisode);
      })
      .sort(compareNum)
      .forEach(function(tvdbEpisode) {
        missingEpisodes.push({
          season: tvdbSeason,
          number: tvdbEpisode,
          title: tvdbEps[tvdbSeason][tvdbEpisode].title
        });
      });
  };
};

var matchEpisodeInfo = function(title, tvdbEps, kodiEps) {
  var missingSeasons = [], missingEpisodes = [];
  if (config.options.excludeOlder) {
    removeOldEpisodes(title, tvdbEps, kodiEps);
  }
  Object.keys(tvdbEps)
    .map(toInt)
    .filter(buildSeasonFilter(tvdbEps, kodiEps, missingSeasons))
    .sort(compareNum)
    .forEach(buildEpisodeWalker(tvdbEps, kodiEps, missingEpisodes));
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
  return Q.all([title, tvdbGetEpisodes(title), kodiGetEpisodes(title, id)])
    .spread(matchEpisodeInfo)
    .then(function(missing) {
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

var listAndProcessShows = function() {
  events.emit('kodi_listing_shows');
  return kodi.getShows()
    .then(function(shows) {
      events.emit('kodi_listed_shows', {shows: shows});
      return processShows(shows);
    });
};

var run = function() {
  return Q.all([tvdbInit(), kodiConnect()])
    .then(listAndProcessShows);
};

var handleError = function(err) {
  console.error(err.stack || JSON.stringify(err));
  process.exit(1);
};

run()
  .fail(handleError)
  .fin(kodiDisconnect);
