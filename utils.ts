// Copyright 2023-latest the httpland authors. All rights reserved. MIT license.
// This module is browser compatible.

import { CORSHeader, isString, Method } from "./deps.ts";
import { Header } from "./constants.ts";
import { reFieldName } from "./_abnf.ts";

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

/** Assert the input is `field-name`. */
export function assertFieldNameFormat(
  input: string,
  msg?: string,
): asserts input {
  if (!reFieldName.test(input)) throw Error(msg);
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
