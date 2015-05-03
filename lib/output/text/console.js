module.exports = function(config) {
  var fmt = require('./formatting')(config);

  return function(func, format) {
    format = format || func;
    format = fmt[format];
    func = console[func];
    return function() {
      var args = Array.prototype.slice.call(arguments);
      args[0] = format(args[0]);
      func.apply(console, args);
    };
  };
};
