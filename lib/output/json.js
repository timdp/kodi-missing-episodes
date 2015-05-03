module.exports = function() {
  var result = [];

  this.events.on('processed_show', function(data) {
    if (!data.seasons.length && !data.episodes.length) {
      return;
    }
    result.push({
      title: data.title,
      seasons: data.seasons,
      episodes: data.episodes
    });
  });

  this.events.on('processed_shows', function() {
    console.log(JSON.stringify(result, null, 2));
  });
};
