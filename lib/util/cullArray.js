export const cullArray = (data, predicate) => {
  let i = data.length - 1
  while (i >= 0) {
    if (!predicate(data[i])) {
      data.splice(i, 1)
    }
    --i
  }
}
