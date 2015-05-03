module.exports = function () {
  var prefix = {}
  if (this.config.options.decorate) {
    prefix.pass = '√ '
    prefix.fail = '× '
    prefix.list = '  • '
  } else {
    prefix.pass = prefix.fail = ''
    prefix.list = '- '
  }
  return prefix
}
