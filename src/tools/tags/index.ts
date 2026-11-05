import type { Tool } from '../define.js';
import { createTag } from './create-tag.js';
import { deleteTag } from './delete-tag.js';
import { listTags } from './list-tags.js';
import { renameTag } from './rename-tag.js';
import { setTags } from './set-tags.js';

export const tagTools: Tool[] = [listTags, createTag, renameTag, deleteTag, setTags];
