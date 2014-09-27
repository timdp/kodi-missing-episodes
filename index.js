var XBMC = require('xbmc');
var TVDB = require('tvdb');

var SORT_NUMERIC = function(a, b) {
  return a - b;
};

var config = require('./config.json');
config.options = config.options || {};

var xbmc = new XBMC.XbmcApi({
  connection: new XBMC.TCPConnection(config.xbmc),
  silent: true
});

var tvdb = new TVDB(config.tvdb);

var isFutureDate = function(date) {
  return (new Date(date) > new Date());
};

var tvdbGetEpisodes = function(title, cb) {
  tvdb.findTvShow(title, function(err, results) {
    if (err) {
      return cb(err);
    }
    if (results.length === 0) {
      return cb(null, []);
    }
    tvdb.getInfo(results[0].id, function(err, info) {
      if (err) {
        return cb(err);
      }
      var tvdbEps = {};
      info.episodes.forEach(function(episode) {
        if ((config.options.skipSpecials && episode.season === '0') ||
            (!config.options.includeUnaired && isFutureDate(episode.firstAired))) {
          return;
        }
        tvdbEps[episode.season] = tvdbEps[episode.season] || {};
        tvdbEps[episode.season][episode.number] = {
          id: episode.id,
          title: episode.name
        };
      });
      cb(null, tvdbEps);
    });
  });
};

var xbmcGetEpisodes = function(id, cb) {
  xbmc.media.episodes(id, null, {
    properties: ['season', 'episode', 'originaltitle']
  }, function(episodes) {
    var xbmcEps = {};
    episodes.forEach(function(episode) {
      if (config.options.skipSpecials && episode.season === 0) {
        return;
      }
      xbmcEps[episode.season] = xbmcEps[episode.season] || {};
      xbmcEps[episode.season][episode.episode] = {
        id: episode.episodeid,
        title: episode.originaltitle
      };
    });
    cb(null, xbmcEps);
  }).then(null, function(err) {
    cb(err);
  });
};

var matchInfo = function(tvdbEps, xbmcEps) {
  var missingSeasons = [], missingEpisodes = [];
  Object.keys(tvdbEps).sort(SORT_NUMERIC).filter(function(tvdbSeason) {
    if (!xbmcEps.hasOwnProperty(tvdbSeason)) {
      missingSeasons.push(tvdbSeason);
      return false;
    } else {
      return true;
    }
  }).forEach(function(tvdbSeason) {
    Object.keys(tvdbEps[tvdbSeason]).sort(SORT_NUMERIC).filter(function(tvdbEpisode) {
      return !xbmcEps[tvdbSeason].hasOwnProperty(tvdbEpisode);
    }).forEach(function(tvdbEpisode) {
      missingEpisodes.push({
        season: tvdbSeason,
        number: tvdbEpisode,
        title: tvdbEps[tvdbSeason][tvdbEpisode].title
      });
    });
  });
  if (missingSeasons.length) {
    console.info('Missing seasons:');
    missingSeasons.forEach(function(tvdbSeason) {
      console.info('- ' +
        (tvdbSeason > 0 ? 'Season ' + tvdbSeason : 'Specials') +
        ' (episodes: ' + Object.keys(tvdbEps[tvdbSeason]).length + ')');
    });
  }
  if (missingEpisodes.length) {
    console.info('Missing episodes:');
    missingEpisodes.forEach(function(item) {
      console.info('- ' +
        'S' + (item.season < 10 ? '0' : '') + item.season +
        'E' + (item.number < 10 ? '0' : '') + item.number + ': ' +
        item.title);
    });
  }
  if (!missingSeasons.length && !missingEpisodes.length) {
    console.info('No missing episodes');
  }
};

console.info('Getting show list from Kodi');
xbmc.media.tvshows(null, function(shows) {
  var cnt = 0;
  var total = shows.length;
  var nextShow = function() {
    if (!shows.length) {
      return xbmc.disconnect();
    }
    var show = shows.shift();
    console.info('\n== ' + show.label + ' (' + (++cnt) + '/' + total + ') ==');
    console.info('Searching TheTVDB.com');
    tvdbGetEpisodes(show.label, function(err, tvdbEps) {
      if (err) {
        console.warn(err);
        return nextShow();
      }
      console.info('Getting episode information from Kodi');
      xbmcGetEpisodes(show.tvshowid, function(err, xbmcEps) {
        if (err) {
          console.warn(err);
          return nextShow();
        }
        matchInfo(tvdbEps, xbmcEps);
        nextShow();
      });
    });
  };
  nextShow();
});
