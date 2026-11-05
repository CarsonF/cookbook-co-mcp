import { Auth } from './core/auth.js';
import { type Cache, createCache } from './core/cache.js';
import { type CacheSettings, withCacheSettings } from './core/cache-settings.js';
import { type Http, http as defaultHttp } from './core/http.js';
import { RestClient } from './core/rest.js';
import { FirestoreLive } from './firestore/FirestoreLive.js';
import { MealPlanApi } from './meal-plan/meal-plan.js';
import { ImagesApi } from './recipes/images.js';
import { RecipesApi } from './recipes/recipes.js';
import { ProductsApi } from './shopping/products.js';
import { ShoppingApi } from './shopping/shopping.js';
import { TagsApi } from './tags/tags.js';

/** The CookBook web app's own API, grouped by feature. Unofficial: the endpoints may change. */
export class CookbookClient implements AsyncDisposable {
  readonly recipes: RecipesApi;
  readonly tags: TagsApi;
  readonly shopping: ShoppingApi;
  readonly products: ProductsApi;
  readonly mealPlan: MealPlanApi;
  readonly images: ImagesApi;

  private readonly auth: Auth;
  private readonly cache: Cache;
  private readonly firestore: FirestoreLive;

  /** `log` receives background refresh failures; `cache` holds the refresh timings. */
  constructor(
    token: string,
    {
      http = defaultHttp,
      log = console.error,
      cache: settings = withCacheSettings(),
    }: { http?: Http; log?: (message: string) => void; cache?: CacheSettings } = {},
  ) {
    const cache = createCache({ log });
    this.cache = cache;
    this.auth = new Auth(http, token);
    const rest = new RestClient(http, this.auth);
    const firestore = new FirestoreLive(this.auth, log);
    this.firestore = firestore;
    this.tags = new TagsApi(rest, cache, settings.tags, () => this.recipes.list.refresh());
    this.mealPlan = new MealPlanApi(rest, cache, settings.mealPlan);
    this.recipes = new RecipesApi(
      rest,
      firestore.collection('recents'),
      this.tags,
      this.mealPlan,
      cache,
      settings.recipes,
    );
    this.shopping = new ShoppingApi((path) => firestore.collection(path));
    this.products = new ProductsApi(firestore.collection('products'));
    this.images = new ImagesApi(rest, http);
  }

  /** Opens the Firestore listeners now, so the first read is already served from memory. */
  warm() {
    this.firestore.warm();
    // opens a listener for each list's items
    void this.shopping.lists().catch(() => {});
  }

  /** Stops the background refreshes and the listeners; nothing is reloaded afterwards. */
  async [Symbol.asyncDispose]() {
    await this.cache[Symbol.asyncDispose]();
    await this.firestore[Symbol.asyncDispose]();
  }

  /** Signs in with the token to prove it works; never returns the token or the email. */
  whoami() {
    return this.auth.whoami();
  }
}
