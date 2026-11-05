import type { Fields } from '../firestore/fields.js';
import type { LiveCollection } from '../firestore/liveCollection.js';
import type { ShoppingItem } from './types.js';

const COMMON_LIST = 'common';

export class ShoppingApi {
  private readonly listCollection: LiveCollection;
  private readonly itemsOfList = new Map<string, LiveCollection>();

  /** `collection(path)` is a live collection at `cb/<user>/<path>`. */
  constructor(private readonly collection: (path: string) => LiveCollection) {
    this.listCollection = collection('shopping');
  }

  /** The built-in "common" list is shown as "Regular items" and may have no document. */
  async lists() {
    const docs = await this.listCollection.docs();
    const lists = docs
      .filter((d) => d.id !== COMMON_LIST)
      .sort((a, b) => String(a.data.created).localeCompare(String(b.data.created)))
      .map((d) => ({ id: d.id, name: String(d.data.name ?? '') }));
    const all = [{ id: COMMON_LIST, name: 'Regular items' }, ...lists];
    for (const { id } of all) this.openItems(id);
    for (const id of this.itemsOfList.keys()) {
      if (!all.some((list) => list.id === id)) this.closeItems(id);
    }
    return all;
  }

  async createList(name: string) {
    const id = await this.listCollection.write((batch) =>
      batch.add({ name, created: String(Date.now()) }),
    );
    this.openItems(id);
    return id;
  }

  /** Items first, so a failure leaves an empty list to delete again, never orphaned items. */
  async deleteList(id: string) {
    const items = await this.items(id);
    await this.openItems(id).write((batch) => batch.delete(items.map((item) => item.id)));
    await this.listCollection.write((batch) => batch.delete(id));
    this.closeItems(id);
  }

  async items(listId: string) {
    const docs = await this.openItems(listId).docs();
    return docs.map(({ id, data }) => ({
      id,
      name: String(data.name ?? ''),
      item: String(data.item ?? ''),
      qty: Number(data.qty ?? 0),
      measure: String(data.measure ?? ''),
      aisle: String(data.aisle ?? ''),
      complete: data.complete === true,
      serving: Number(data.serving ?? 1),
      recipe: Number(data.recipe ?? 0),
    }));
  }

  async addItems(listId: string, items: Omit<ShoppingItem, 'id'>[]) {
    await this.openItems(listId).write((batch) => {
      for (const item of items) batch.add(item);
    });
  }

  async updateItems(listId: string, updates: { id: string; fields: Fields }[]) {
    await this.openItems(listId).write((batch) => {
      for (const { id, fields } of updates) batch.patch(id, fields);
    });
  }

  async deleteItems(listId: string, ids: string[]) {
    await this.openItems(listId).write((batch) => batch.delete(ids));
  }

  private openItems(listId: string) {
    let items = this.itemsOfList.get(listId);
    if (!items) {
      items = this.collection(`shopping/${listId}/items`);
      items.open();
      this.itemsOfList.set(listId, items);
    }
    return items;
  }

  private closeItems(listId: string) {
    void this.itemsOfList.get(listId)?.[Symbol.asyncDispose]();
    this.itemsOfList.delete(listId);
  }
}
