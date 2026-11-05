export interface Recipe {
  id: number;
  name: string;
  category: number[];
  desc: string;
  preptime: number;
  cooktime: number;
  serving: number;
  fave: boolean;
  rating: number;
  cookcount: number;
  lastcook: string | null;
  source: string;
  notes: string;
  created: string;
  changed: string;
  video: string;
  nutrition: string;
  pairings: string;
  displayphoto: string;
  photos: unknown[];
  links: unknown[];
  ingredientstype: number;
  othertime: number;
  othertimetype: string;
  servingtype: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
}

export interface Ingredient {
  id: number;
  quantity: number;
  measure: string;
  name: string;
  notes: string;
  group: string;
}

export interface Instruction {
  id: number;
  item: number;
  text: string;
  photo: string;
}

/** An unsaved recipe from the URL importer, a .cookbook file or an agent; step ids are placeholders. */
export type DraftRecipe = Pick<
  Recipe,
  | 'name'
  | 'desc'
  | 'preptime'
  | 'cooktime'
  | 'othertime'
  | 'othertimetype'
  | 'serving'
  | 'servingtype'
  | 'source'
  | 'video'
  | 'nutrition'
  | 'notes'
  | 'pairings'
  | 'displayphoto'
  | 'photos'
  | 'ingredientstype'
  | 'ingredients'
  | 'instructions'
> & { cache_id?: string };
