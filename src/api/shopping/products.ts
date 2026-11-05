import type { LiveCollection } from '../firestore/liveCollection.js';

/** Explicit aisle memory (cb/<user>/products): the app saves one when an item's aisle is edited. */
export class ProductsApi {
  constructor(private readonly products: LiveCollection) {}

  async list() {
    const docs = await this.products.docs();
    return docs.map((d) => ({
      id: d.id,
      item: String(d.data.item ?? ''),
      aisle: String(d.data.aisle ?? ''),
    }));
  }

  /** Remembers an aisle per item name, updating an existing entry for the same name. */
  async remember(entries: { item: string; aisle: string }[]) {
    const docs = await this.list();
    await this.products.write((batch) => {
      for (const { item, aisle } of entries) {
        const existing = docs.find((p) => p.item.toLowerCase() === item.toLowerCase());
        if (existing) batch.patch(existing.id, { item: existing.item, aisle });
        // a later entry for the same name patches this one
        else docs.push({ id: batch.add({ item, aisle }), item, aisle });
      }
    });
  }

  /** Removes remembered aisles for an item name; returns how many were removed. */
  async forget(item: string) {
    const docs = await this.list();
    const matches = docs.filter((p) => p.item.toLowerCase() === item.toLowerCase());
    await this.products.write((batch) => batch.delete(matches.map((p) => p.id)));
    return matches.length;
  }
}
