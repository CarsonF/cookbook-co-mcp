import type { CookbookClient, Recipe, Tag } from '../../api/index.js';

export async function freshRecipe(client: CookbookClient, id: number): Promise<Recipe | undefined> {
  return (await client.recipes.list(true)).find((r) => r.id === id);
}

export function staleError(recipe: Recipe, changed: string): string | undefined {
  if (recipe.changed === changed) return undefined;
  return `Recipe changed at ${recipe.changed}, not ${changed}; re-read it with get_recipe first.`;
}

export function writeResult(recipe: Recipe) {
  return { id: recipe.id, name: recipe.name, changed: recipe.changed, fave: recipe.fave };
}

export function tagNames(tags: Tag[]): Map<number, string> {
  return new Map(tags.map((t) => [t.id, t.name]));
}

export function tagLabels(recipe: Recipe, names: Map<number, string>): string[] {
  return recipe.category.map((id) => names.get(id) ?? String(id));
}
