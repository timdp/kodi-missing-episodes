var chalk = require('chalk')
var _ = require('lodash')

module.exports = function () {
  var fmt = {}
  if (this.config.options.color) {
    fmt.error = chalk.bold.red
    fmt.warn = chalk.yellow
    fmt.info = chalk.cyan
    fmt.debug = _.identity
  } else {
    _.each(['error', 'warn', 'info', 'debug'], function (fn) {
      fmt[fn] = _.identity
    })
  }
  return fmt
}
