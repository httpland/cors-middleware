// Copyright 2023-latest the httpland authors. All rights reserved. MIT license.
// This module is browser compatible.

import { CORSHeader, isNonNegativeInteger, isString, Method } from "./deps.ts";
import { Header } from "./constants.ts";
import { reToken } from "./_abnf.ts";

export function isCORSRequest(
  request: Request,
): request is Request & { headers: { get(name: "origin"): string } } {
  return request.headers.has(Header.Origin);
}

/** Whether the request is preflight request or not.
 * Living Standard - Fetch, 3.2.2 HTTP requests
 */
export function isCORSPreflightRequest(
  request: Request,
): boolean {
  return isCORSRequest(request) &&
    request.method === Method.Options &&
    request.headers.has(CORSHeader.AccessControlRequestMethod) &&
    request.headers.has(CORSHeader.AccessControlRequestHeaders);
}

/** Assert the input is [`<token>`](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.2-2).
 * @throws {Error} If the input is invalid [`<token>`](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.2-2).
 */
export function assertTokenFormat(input: string, msg?: string): asserts input {
  if (!reToken.test(input)) throw Error(msg);
}

export function stringifyInstancePath(
  ...paths: readonly (string | number)[]
): string {
  return paths.reduce<string>(
    (acc, cur, i) => {
      if (!i) return cur.toString();

      return acc + (isString(cur) ? `.${cur}` : `[${cur}]`);
    },
    "" as string,
  );
}

export function match(input: string, pattern: string | RegExp): boolean {
  if (isString(pattern)) return input === pattern;

  return pattern.test(input);
}

/** Assert the input is non-negative integer.
 * @throws {Error} If the input is not non-negative integer.
 */
export function assertNonNegativeInteger(
  input: number,
  msg?: string,
): asserts input {
  if (!isNonNegativeInteger(input)) throw Error(msg);
}
