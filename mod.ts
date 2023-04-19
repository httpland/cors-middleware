// Copyright 2023-latest the httpland authors. All rights reserved. MIT license.
// This module is browser compatible.

export {
  cors,
  type CORSHeaders,
  type CORSPreflightHeaders,
  preflight,
  type PreflightOptions,
} from "./middleware.ts";
export { type Handler, type Middleware } from "./deps.ts";
