import {
  unstable_defineRouter,
  unstable_getRscPath,
  unstable_getRscParams,
  unstable_rerenderRoute,
  unstable_notFound,
  unstable_redirect,
} from './define-router.js';

export const defineRouter = unstable_defineRouter;
export const getRscPath = unstable_getRscPath;
export const getRscParams = unstable_getRscParams;
export const rerenderRoute = unstable_rerenderRoute;
export const notFound = unstable_notFound;
export const redirect = unstable_redirect;

export type { ApiHandler } from './define-router.js';
