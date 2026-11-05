import type { Cache, Memo, Windows } from '../core/cache.js';
import type { RestClient } from '../core/rest.js';
import type { Tag } from './types.js';

export class TagsApi {
  /** `list(true)` skips the memo, for anything about to write using tag names. */
  readonly list: Memo<Tag[]>;

  /** `recipesChanged` is called when a write here also changes recipes. */
  constructor(
    private readonly rest: RestClient,
    cache: Cache,
    windows: Windows,
    private readonly recipesChanged: () => void,
  ) {
    this.list = cache.memo('tags', windows, async () => {
      const { user_categories } = await rest.request<{ user_categories: Tag[] }>(
        'GET',
        'user/tags',
      );
      return user_categories;
    });
  }

  async create(name: string) {
    // every existing tag uses this stock image
    const image = 'chop1.jpg';
    const { tag } = await this.rest.request<{ tag: { id: number; name: string } }>(
      'PUT',
      'user/tags/',
      { json: { name, image } },
    );
    const created: Tag = { id: tag.id, name: tag.name, image };
    // the server lists tags in the order they were created, so a new one goes last
    this.list.update((tags) => [...tags, created]);
    return created;
  }

  async rename(tag: Tag, name: string) {
    await this.rest.request('PATCH', `user/tags/${tag.id}`, {
      json: { id: tag.id, name, image: tag.image },
    });
    this.list.update((tags) => tags.map((t) => (t.id === tag.id ? { ...t, name } : t)));
  }

  async delete(tag: Tag) {
    await this.rest.request('DELETE', `user/tags/${tag.id}`, { json: { id: tag.id } });
    this.list.update((tags) => tags.filter((t) => t.id !== tag.id));
    // the server also takes the tag off every recipe that had it
    this.recipesChanged();
  }
}
