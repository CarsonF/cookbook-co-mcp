import type { Cache, Memo, Windows } from '../core/cache.js';
import { retryPost } from '../core/http.js';
import type { RestClient } from '../core/rest.js';
import type { LiveCollection } from '../firestore/liveCollection.js';
import type { MealPlanApi } from '../meal-plan/meal-plan.js';
import type { TagsApi } from '../tags/tags.js';
import type { DraftRecipe, Recipe } from './types.js';

const PARSE_ROOT = 'https://parse.cookbookmanager.com/parse';

export interface RecipeChanges {
  tags?: string[];
  fave?: boolean;
  edits?: Partial<
    Pick<
      Recipe,
      | 'preptime'
      | 'cooktime'
      | 'othertime'
      | 'othertimetype'
      | 'ingredients'
      | 'instructions'
      | 'notes'
      | 'desc'
      | 'source'
      | 'serving'
      | 'servingtype'
      | 'displayphoto'
      | 'name'
      | 'rating'
    >
  >;
}

export class RecipesApi {
  /** `list(true)` skips the memo, for anything about to write. */
  readonly list: Memo<Recipe[]>;

  constructor(
    private readonly rest: RestClient,
    private readonly recents: LiveCollection,
    private readonly tags: TagsApi,
    private readonly mealPlan: MealPlanApi,
    cache: Cache,
    windows: Windows,
  ) {
    this.list = cache.memo('recipes', windows, (previous) => syncRecipes(rest, previous));
  }

  /** Recently viewed recipes (Firestore `cb/<user>/recents`), unix seconds, newest first. */
  async recentViews() {
    const docs = await this.recents.docs();
    return docs
      .map((d) => ({ id: Number(d.id), ts: Number(d.data.ts) }))
      .filter((v) => Number.isFinite(v.ts))
      .sort((a, b) => b.ts - a.ts);
  }

  /** Scrapes a recipe page into a recipe draft; nothing is saved. */
  async parseUrl(url: string) {
    const draft = await this.rest.request<DraftRecipe | undefined>('POST', '', {
      root: PARSE_ROOT,
      json: { url, tags: false, legacy: false },
    });
    if (!draft?.name) throw new Error(`Could not parse a recipe from ${url}`);
    return draft;
  }

  async create(draft: DraftRecipe, tags: string[]) {
    const recipe = {
      id: 0,
      category: [],
      fave: false,
      rating: 0,
      cookcount: 0,
      lastcook: null,
      links: [],
      created: '',
      changed: '',
      ...draft,
    } as unknown as Recipe;
    const saved = await this.rest.request<{ recipe: Recipe }>('PUT', 'user/recipe/0', {
      json: recipePatch(recipe, tags),
    });
    this.list.refresh();
    this.tags.list.refresh();
    return saved.recipe;
  }

  /** Replaces the whole recipe server-side, so every field is sent back; tags go in by name. */
  async save(recipe: Recipe, changes: RecipeChanges) {
    recipe = { ...recipe, ...changes.edits };
    const names = new Map((await this.tags.list()).map((t) => [t.id, t.name]));
    const tags = changes.tags ?? recipe.category.map((id) => names.get(id) ?? failTag(id));
    const saved = await this.rest.request<{ recipe: Recipe }>('PUT', `user/recipe/${recipe.id}`, {
      json: recipePatch(recipe, tags, changes.fave),
    });
    this.list.refresh();
    this.tags.list.refresh();
    this.mealPlan.refresh();
    return saved.recipe;
  }

  async delete(id: number) {
    await this.rest.request('DELETE', `user/recipe/${id}`);
    this.list.refresh();
    this.mealPlan.refresh();
  }

  /** `at` is a UTC `YYYY-MM-DD HH:MM:SS` timestamp; it defaults to now. */
  async markCooked(recipe: Recipe, rating: number | undefined, at?: string) {
    await this.rest.request('PATCH', `user/recipe/${recipe.id}/cooked`, {
      json: {
        id: recipe.id,
        date: at ?? new Date().toISOString().slice(0, 19).replace('T', ' '),
        cookcount: recipe.cookcount + 1,
        rating: rating ?? recipe.rating,
      },
    });
    this.list.refresh();
  }

  /** Creates or refreshes the recipe's public share code. */
  async shareCode(id: number) {
    const reply = await this.rest.request<{ share?: string }>('PATCH', `user/recipe/${id}/share`, {
      json: { id },
    });
    const code = reply.share;
    if (!code) throw new Error('The server returned no share code');
    return String(code);
  }
}

/** The request body the app sends to save a recipe, e.g. tags by name and zero-based steps. */
function recipePatch(recipe: Recipe, tags: string[], fave = recipe.fave) {
  const { category: _category, instructions, created: _c, changed: _ch, ...rest } = recipe;
  return {
    ...rest,
    fave,
    category: tags,
    categoryNames: [],
    // the app writes `directions` with zero-based id/item and a one-based itemId
    directions: instructions.map((d, i) => ({
      id: i,
      item: i,
      itemId: i + 1,
      text: d.text,
      photo: d.photo,
    })),
    ingredients: recipe.ingredients.map((ing, i) => ({
      id: i,
      quantity: ing.quantity,
      measure: ing.measure,
      name: ing.name,
      notes: ing.notes,
      group: ing.group,
    })),
  };
}

interface SyncReply {
  recipes: Recipe[];
  sync_get: Array<number | string>;
  sync_delete: Array<number | string>;
}

/**
 * Brings `known` up to date with the server, as the app does: `{id, dt}` per known recipe in,
 * only the changed or new recipes and the ids deleted elsewhere out.
 * No `known` list means everything is downloaded.
 */
async function syncRecipes(rest: RestClient, known: Recipe[] = []) {
  let current = known;
  for (let round = 0; round < MAX_SYNC_ROUNDS; round++) {
    const reply = await rest.request<SyncReply>('POST', 'user/sync', {
      json: { recipes: current.map((r) => ({ id: String(r.id), dt: r.changed || NEVER })) },
      // sync is a POST but only reads
      ...retryPost,
    });
    const received = new Map(reply.recipes.map((r) => [r.id, r]));
    // an id both deleted and sent is a re-add
    const deleted = new Set(reply.sync_delete.map(Number).filter((id) => !received.has(id)));
    const kept = current.filter((r) => !deleted.has(r.id)).map((r) => received.get(r.id) ?? r);
    const have = new Set(kept.map((r) => r.id));
    current = [...kept, ...reply.recipes.filter((r) => !have.has(r.id) && !deleted.has(r.id))];

    // the app repeats until the server has nothing left to send; this stops once all ids arrived
    if (reply.sync_get.every((id) => received.has(Number(id)) || deleted.has(Number(id)))) {
      return current;
    }
  }
  throw new Error(`Recipe sync did not settle after ${MAX_SYNC_ROUNDS} rounds`);
}

const MAX_SYNC_ROUNDS = 5;

/** What the app sends for a recipe with no `changed` value. */
const NEVER = '0000-01-01 00:00:00';

function failTag(id: number): never {
  throw new Error(`Recipe has tag id ${id} with no known name; refusing to rewrite it`);
}
