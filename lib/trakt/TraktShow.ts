import { Show } from '../core/Show'
import { TraktEpisode } from './TraktEpisode'

export class TraktShow extends Show {
  readonly episodes: readonly TraktEpisode[]

  constructor (
    id: number,
    imdbId: string,
    title: string,
    episodes: readonly TraktEpisode[]
  ) {
    super(id, imdbId, title)
    this.episodes = episodes
  }
}
