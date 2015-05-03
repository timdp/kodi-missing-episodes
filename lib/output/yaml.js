var yaml = require('js-yaml');

module.exports = function() {
  this.events.on('processed_show', function(data) {
    if (!data.seasons.length && !data.episodes.length) {
      return;
    }
    console.log(yaml.safeDump([{
      title: data.title,
      seasons: data.seasons,
      episodes: data.episodes
    }]).trim());
  });
};
