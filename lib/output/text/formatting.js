var chalk = require('chalk'),
    _ = require('lodash');

module.exports = function(config) {
  var fmt = {};
  if (config.options.color) {
    fmt.error = chalk.bold.red;
    fmt.warn = chalk.yellow;
    fmt.info = chalk.cyan;
    fmt.debug = _.identity;
  } else {
    _.each(['error', 'warn', 'info', 'debug'], function(fn) {
      fmt[fn] = _.identity;
    });
  }
  return fmt;
};
