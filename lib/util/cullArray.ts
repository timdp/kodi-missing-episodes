export const cullArray = <T>(data: T[], predicate: (elem: T) => boolean) => {
  let i = data.length - 1
  while (i >= 0) {
    if (!predicate(data[i])) {
      data.splice(i, 1)
    }
    --i
  }
}
