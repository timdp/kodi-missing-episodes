module.exports = function(config) {
  var prefix = {};
  if (config.options.decorate) {
    prefix.pass = '√ ';
    prefix.fail = '× ';
    prefix.list = '  • ';
  } else {
    prefix.pass = prefix.fail = '';
    prefix.list = '- ';
  }
  return prefix;
};
