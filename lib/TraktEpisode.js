import { Episode } from './Episode.js'

export class TraktEpisode extends Episode {
  constructor (id, imdbId, seasonNumber, episodeNumber, title, firstAired) {
    super(id, imdbId, seasonNumber, episodeNumber, title)
    this._firstAired = firstAired
  }

  get firstAired () {
    return this._firstAired
  }

  toString () {
    return (
      `${this._seasonNumber}x${this._episodeNumber < 10 ? '0' : ''}${
        this._episodeNumber
      }. ${super.toString()} - ` +
      (this._firstAired != null
        ? 'aired ' + this._firstAired.toLocaleDateString('en-US')
        : 'unknown air date')
    )
  }
}
