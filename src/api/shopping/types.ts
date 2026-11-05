export interface ShoppingItem {
  id: string;
  name: string;
  item: string;
  qty: number;
  measure: string;
  aisle: string;
  complete: boolean;
  serving: number;
  recipe: number;
}

/** An aisle the app remembers for an item name (`cb/<user>/products`). */
export interface Product {
  id: string;
  item: string;
  aisle: string;
}
