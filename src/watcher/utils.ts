export function isPrefixOf(value: string) {
  return function(prefix: string) {
    return value.indexOf(prefix) === 0
  }
}

export function isRegExpMatch(value: string) {
  return function(regExp: string) {
    return new RegExp(regExp).test(value)
  }
}
