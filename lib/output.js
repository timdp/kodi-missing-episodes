var chalk = require('chalk'),
    _ = require('lodash');

module.exports = function(config) {
  var fmt = {};
  if (config.options.color) {
    fmt.error = chalk.bold.red;
    fmt.warn = chalk.yellow;
    fmt.info = chalk.cyan;
    fmt.debug = _.identity;
    fmt.emph = chalk.bold;
  } else {
    _.each(['error', 'warn', 'info', 'debug', 'emph'], function(fn) {
      fmt[fn] = _.identity;
    });
  }

  var consoleGet = function(func, format) {
    format = format || func;
    format = fmt[format];
    func = console[func];
    return function() {
      var args = Array.prototype.slice.call(arguments);
      args[0] = format(args[0]);
      func.apply(console, args);
    };
  };

  return {
    error: consoleGet('error'),
    warn: consoleGet('warn'),
    info: consoleGet('info'),
    debug: config.options.verbose ? consoleGet('info', 'debug') : _.noop,
    emph: config.options.color ? chalk.bold : _.identity,
  };
};
