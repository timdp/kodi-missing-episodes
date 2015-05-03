module.exports = function () {
  var RE = /^/gm
  var wrote = false

  this.events.on('processing_shows', function () {
    process.stdout.write('[')
  })

  this.events.on('processed_shows', function () {
    console.log('\n]')
  })

  this.events.on('processed_show', function (data) {
    if (!data.seasons.length && !data.episodes.length) {
      return
    }
    if (wrote) {
      process.stdout.write(',')
    } else {
      wrote = true
    }
    console.log()
    process.stdout.write(JSON.stringify({
      title: data.title,
      seasons: data.seasons,
      episodes: data.episodes
    }, null, 2).replace(RE, '  '))
  })
}
