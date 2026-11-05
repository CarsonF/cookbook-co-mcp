import { itemActionTool } from './item-action.js';

export const removeItems = itemActionTool({
  name: 'remove_items',
  verb: 'Remove',
  action: 'remove',
});
