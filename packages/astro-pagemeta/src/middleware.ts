// eslint-disable-next-line workspaces/no-absolute-imports -- if I understand right, import is relative to the user's project in which this middleware is injected
import { middleware } from "@grepco/astro-pagemeta/runtime";

export const onRequest = middleware();
