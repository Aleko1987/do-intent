import { CallOpts } from "encore.dev/api";

type Parameters<T> = T extends (...args: infer P) => unknown ? P : never;
type WithCallOpts<T extends (...args: any) => any> = (
  ...args: [...Parameters<T>, opts?: CallOpts]
) => ReturnType<T>;

import { create as create_handler } from "../../../../content\\create_item.js";
declare const create: WithCallOpts<typeof create_handler>;
export { create };

import { deleteItem as deleteItem_handler } from "../../../../content\\delete_item.js";
declare const deleteItem: WithCallOpts<typeof deleteItem_handler>;
export { deleteItem };

import { list as list_handler } from "../../../../content\\list_items.js";
declare const list: WithCallOpts<typeof list_handler>;
export { list };

import { logPost as logPost_handler } from "../../../../content\\log_post.js";
declare const logPost: WithCallOpts<typeof logPost_handler>;
export { logPost };

import { update as update_handler } from "../../../../content\\update_item.js";
declare const update: WithCallOpts<typeof update_handler>;
export { update };


