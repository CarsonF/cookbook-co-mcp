/** The server's instructions for the agent; read-only mode appends a note. */
export function serverInstructions(readOnly: boolean, defaultList: string) {
  const text = instructions(defaultList);
  return readOnly ? `${text}\n${READ_ONLY_NOTE}` : text;
}

const READ_ONLY_NOTE =
  'READ-ONLY MODE: only tools that read are available; nothing can be created, changed or deleted.';

const instructions = (defaultList: string) => `CookBook recipe manager: the user's personal recipe library, tags and meal planner.
Find recipes with search_recipes or get_recent_recipes, then read one with get_recipe.\nscale_recipe shows scaled ingredient amounts without saving anything.\nset_recipe_photo replaces a recipe's main photo from a file path or URL.\nShopping lists: "${defaultList}" is the default list; recipe and planned-meal adds skip staples (water, salt, pepper, cooking oils) and report them, and preview before writing.\nAisles for new items come from the app's remembered products, else a crude keyword guess: pass the aisle yourself whenever you know it, and fix a wrong one with set_item_aisle or teach_aisle.
Cooking and rating are separate: mark_cooked logs a cook (adds to the count, sets the last-cooked date, optional rating and date); rate_recipe only sets the stars.\nEdit tools (set_tags, set_favourite, rate_recipe, rename_recipe, set_recipe_photo, update_recipe) need that recipe's \`changed\` value from get_recipe and refuse if it is stale.
update_recipe and import_recipe_from_url preview by default: show the user the preview and call again with apply=true only once they agree.
create_recipe saves a recipe you have read from a PDF, image or text (read the source yourself, then call it; it previews first); export_recipe writes a .cookbook file or a PDF locally, share_recipe_link publishes a public link (only when the user wants that), and import_recipe_file reads .cookbook files back in; delete_recipe previews until apply=true.\nRecipes carry tags by name (set_tags); new tag names are Title Case and existing tags keep their spelling. Unknown tag names are asked about: the user is prompted if the client supports it, otherwise ask them yourself, then pass unknown_tags create or skip. rename_tag and delete_tag take a tag id from list_tags; delete_tag previews until apply=true.
get_shopping_list shows items by name (pass ids if a name is ambiguous). Planner entries come from get_planned_meals; update_planned_meal and unschedule_meal take an entry id from there.
When you show the user a recipe name, make it a markdown link to the recipe in the CookBook web app: [Name](https://app.cookbookmanager.com/recipe/<id>), using the recipe id from any tool result.
Ingredient units are short names: tbsp, tsp, cup, oz, lb, fl oz. Plain oz is weight, so write fl oz for fluid ounces; drink recipes (Drinks tag or a drink name) may use plain oz for fluid.`;
