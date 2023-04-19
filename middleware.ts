// Copyright 2023-latest the httpland authors. All rights reserved. MIT license.
// This module is browser compatible.

import {
  append,
  CORSHeader,
  type Handler,
  isNumber,
  isString,
  mergeHeaders,
  Method,
  type Middleware,
  Status,
} from "./deps.ts";
import {
  assertNonNegativeInteger,
  assertTokenFormat,
  fromResponse,
  isCORSPreflightRequest,
  isCORSRequest,
  match,
  stringifyInstancePath,
} from "./utils.ts";
import { Header } from "./constants.ts";

/** Headers for CORS request. */
export interface CORSHeaders {
  /** Allowed origin list.
   * - `*` - Add `Access-Control-Allow-Origin`: `*`
   * - list - Compare with `Origin`. If match, add `Access-Control-Allow-Origin`: Origin field value, otherwise; null
   * @default "*"
   */
  readonly allowOrigins?: "*" | readonly (string | RegExp)[];

  /** `Access-Control-Allow-Credentials`. */
  readonly allowCredentials?: true | "true";

  /** `Access-Control-Expose-Headers`.
   * Each element must be [`<field-name>`](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1-2).
   */
  readonly exposeHeaders?: readonly string[];
}

/** Headers for CORS preflight request. */
export interface CORSPreflightHeaders
  extends Omit<CORSHeaders, "exposeHeaders"> {
  /** `Access-Control-Allow-Methods`.
   * Each element must be [`<method>`](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.1-4).
   */
  readonly allowMethods?: readonly string[];

  /** `Access-Control-Allow-Headers`.
   * Each element must be [`<field-name>`](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1-2).
   */
  readonly allowHeaders?: readonly string[];

  /** `Access-Control-Max-Age`.
   * Must be non-negative integer.
   */
  readonly maxAge?: number;
}

/** Create CORS request middleware.
 *
 * @example
 * ```ts
 * import {
 *   cors,
 *   type Handler,
 * } from "https://deno.land/x/cors_middleware@$VERSION/mod.ts";
 * import { assert } from "https://deno.land/std/testing/asserts.ts";
 *
 * const middleware = cors();
 * const corsRequest = new Request("test:", {
 *   headers: { origin: "<origin>" },
 * });
 * declare const handler: Handler;
 *
 * const response = await middleware(corsRequest, handler);
 *
 * assert(response.headers.has("access-control-allow-origin"));
 * ```
 *
 * @throws {Error} If the {@link CORSHeaders.exposeHeaders} includes invalid member.
 */
export function cors(options: CORSHeaders = {}): Middleware {
  const { allowOrigins = Char.Star, allowCredentials, exposeHeaders } = options;

  exposeHeaders?.forEach(
    createAssertTokens(Property.ExposeHeaders, ABNF.FieldName),
  );

  const matchOrigin = allowOrigins === Char.Star
    ? undefined
    : createOriginMatcher(allowOrigins);

  return _cors.bind(null, {
    matchOrigin,
    allowCredentials: allowCredentials?.toString(),
    exposeHeaders: exposeHeaders?.join(Char.Separator),
  });
}

/**
 * @internal
 */
export async function _cors(
  context: Readonly<
    { [k in keyof Omit<CORSHeaders, "allowOrigins">]?: string } & {
      matchOrigin?: (origin: string) => boolean;
    }
  >,
  request: Request,
  next: Handler,
): Promise<Response> {
  const response = await next(request);
  const varyValue = response.headers.get(Header.Vary) ?? "";
  const finalVary = append(varyValue, Header.Origin);
  const headers = mergeHeaders(
    response.headers,
    new Headers({ [Header.Vary]: finalVary }),
  );

  if (!isCORSRequest(request)) return fromResponse(response, { headers });

  const { matchOrigin, allowCredentials, exposeHeaders } = context;
  const origin = request.headers.get(Header.Origin);
  const left = new Headers({
    [CORSHeader.AccessControlAllowOrigin]: getAllowedOrigin(
      origin,
      matchOrigin,
    ),
  });

  if (allowCredentials) {
    left.set(CORSHeader.AccessControlAllowCredentials, allowCredentials);
  }
  if (exposeHeaders && !isCORSPreflightRequest(request)) {
    left.set(CORSHeader.AccessControlExposeHeaders, exposeHeaders);
  }

  const finalHeaders = mergeHeaders(left, headers);

  return fromResponse(response, { headers: finalHeaders });
}

/** Preflight middleware options. */
export interface PreflightOptions extends CORSPreflightHeaders {
  /** Preflight response status code.
   * @default 204
   */
  readonly status?: Status.OK | Status.NoContent;
}

/** Create middleware for CORS preflight request.
 *
 * @example
 * ```ts
 * import {
 *   type Handler,
 *   preflight,
 * } from "https://deno.land/x/cors_middleware@$VERSION/mod.ts";
 * import { assert } from "https://deno.land/std/testing/asserts.ts";
 * import { assertSpyCalls, spy } from "https://deno.land/std/testing/mock.ts";
 *
 * const corsPreflightRequest = new Request("test:", {
 *   method: "OPTIONS",
 *   headers: {
 *     origin: "<origin>",
 *     "access-control-request-method": "POST",
 *     "access-control-request-headers": "content-type",
 *   },
 * });
 *
 * declare const handler: Handler;
 * const next = spy(handler);
 * const handlePreflight = preflight();
 * const response = await handlePreflight(corsPreflightRequest, next);
 *
 * assertSpyCalls(next, 0);
 * assert(response.status === 204);
 * assert(response.headers.has("access-control-allow-origin"));
 * assert(response.headers.has("access-control-allow-methods"));
 * assert(response.headers.has("access-control-allow-headers"));
 * assert(response.headers.has("vary"));
 * ```
 *
 * @throws {Error} If the options include invalid member.
 */
export function preflight(options: PreflightOptions = {}): Middleware {
  const {
    allowOrigins = Char.Star,
    allowCredentials,
    allowHeaders,
    allowMethods,
    maxAge,
    status = Status.NoContent,
  } = options;

  isNumber(maxAge) &&
    assertNonNegativeInteger(
      maxAge,
      `${Property.MaxAge} must be non-negative integer. ${maxAge}`,
    );

  allowHeaders?.forEach(
    createAssertTokens(Property.AllowHeaders, ABNF.FieldName),
  );
  allowMethods?.forEach(createAssertTokens(Property.AllowMethods, ABNF.Method));

  const allowHeadersValue = allowHeaders?.join(Char.Separator);
  const allowMethodsValue = allowMethods?.join(Char.Separator);
  const matchOrigin = allowOrigins === Char.Star
    ? undefined
    : createOriginMatcher(allowOrigins);

  return _preflight.bind(null, {
    status,
    maxAge: maxAge?.toString(),
    allowCredentials: allowCredentials?.toString(),
    matchOrigin,
    allowHeaders: allowHeadersValue,
    allowMethods: allowMethodsValue,
  });
}

const varyCandidates = [
  Header.Origin,
  CORSHeader.AccessControlRequestMethod,
  CORSHeader.AccessControlRequestHeaders,
];

export async function _preflight(
  context: Readonly<
    & {
      [k in keyof Omit<CORSPreflightHeaders, "allowOrigins">]?: string;
    }
    & { matchOrigin?: (origin: string) => boolean }
    & { status?: Status.OK | Status.NoContent }
  >,
  request: Request,
  next: Handler,
): Promise<Response> {
  if (request.method !== Method.Options) return next(request);

  if (!isCORSPreflightRequest(request)) {
    const response = await next(request);
    const varyValue = response.headers.get(Header.Vary) ?? "";
    const finalVary = append(varyValue, varyCandidates);
    const headers = mergeHeaders(
      response.headers,
      new Headers({ [Header.Vary]: finalVary }),
    );

    return fromResponse(response, { headers });
  }

  const {
    allowHeaders,
    matchOrigin,
    allowMethods,
    allowCredentials,
    maxAge,
    status = Status.NoContent,
  } = context;
  const origin = request.headers.get(Header.Origin)!;
  const headers = new Headers([
    [
      CORSHeader.AccessControlAllowOrigin,
      getAllowedOrigin(origin, matchOrigin),
    ],
    [
      CORSHeader.AccessControlAllowHeaders,
      allowHeaders ??
        request.headers.get(CORSHeader.AccessControlRequestHeaders)!,
    ],
    [
      CORSHeader.AccessControlAllowMethods,
      allowMethods ??
        request.headers.get(CORSHeader.AccessControlRequestMethod)!,
    ],
    [Header.Vary, varyCandidates.join(Char.Separator)],
  ]);

  if (isString(maxAge)) {
    headers.set(CORSHeader.AccessControlMaxAge, maxAge);
  }

  if (isString(allowCredentials)) {
    headers.set(CORSHeader.AccessControlAllowCredentials, allowCredentials);
  }

  return new Response(null, { status, headers });
}

const enum Char {
  Star = "*",
  Comma = ",",
  Sp = " ",
  Separator = `${Char.Comma}${Char.Sp}`,
}

const enum Property {
  AllowHeaders = "allowHeaders",
  AllowMethods = "allowMethods",
  ExposeHeaders = "exposeHeaders",
  MaxAge = "maxAge",
}

const enum ABNF {
  FieldName = "<field-name>",
  Method = "<method>",
}

export function getAllowedOrigin(
  origin: string,
  check: ((origin: string) => boolean) | undefined,
): string {
  if (!check) return Char.Star;

  return check(origin) ? origin : "";
}

function createAssertTokens(subject: string, expected: string) {
  return (input: string, i: number): asserts input => {
    assertTokenFormat(
      input,
      `${
        stringifyInstancePath(subject, i)
      } is invalid ${expected} format. "${input}"`,
    );
  };
}

function createOriginMatcher(
  allowOrigins: readonly (string | RegExp)[],
): (origin: string) => boolean {
  return (origin: string) =>
    allowOrigins.some((pattern) => match(origin, pattern));
}
