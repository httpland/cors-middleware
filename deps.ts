// Copyright 2023-latest the httpland authors. All rights reserved. MIT license.
// This module is browser compatible.

export { isString } from "https://deno.land/x/isx@1.3.0/is_string.ts";
export { isNumber } from "https://deno.land/x/isx@1.3.0/is_number.ts";
export { Method } from "https://deno.land/x/http_utils@1.0.0/method.ts";
export { withHeader } from "https://deno.land/x/http_utils@1.0.0/message.ts";
export {
  type Handler,
  type Middleware,
} from "https://deno.land/x/http_middleware@1.0.0/mod.ts";
export { Status } from "https://deno.land/std@0.184.0/http/http_status.ts";
export { append } from "https://deno.land/x/vary@1.0.0/mod.ts";
export { assertNonNegativeInteger } from "https://deno.land/x/assertion@1.0.0/number/assert_non_negative_integer.ts";

const ACCESS_CONTROL = "access-control";

export enum CORSHeader {
  AccessControlAllowOrigin = `${ACCESS_CONTROL}-allow-origin`,
  AccessControlAllowCredentials = `${ACCESS_CONTROL}-allow-credentials`,
  AccessControlAllowMethods = `${ACCESS_CONTROL}-allow-methods`,
  AccessControlAllowHeaders = `${ACCESS_CONTROL}-allow-headers`,
  AccessControlExposeHeaders = `${ACCESS_CONTROL}-expose-headers`,
  AccessControlMaxAge = `${ACCESS_CONTROL}-max-age`,
  AccessControlRequestMethod = `${ACCESS_CONTROL}-request-method`,
  AccessControlRequestHeaders = `${ACCESS_CONTROL}-request-headers`,
}

/** Shallow merge and return new {@link Headers}.
 */
export function mergeHeaders(left: Headers, right: Headers): Headers {
  left = new Headers(left);

  for (const [key, value] of right) left.set(key, value);

  return left;
}
