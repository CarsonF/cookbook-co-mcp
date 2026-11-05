import { itemActionTool } from './item-action.js';

export const checkItems = itemActionTool({
  name: 'check_items',
  verb: 'Check off',
  action: 'check',
});
