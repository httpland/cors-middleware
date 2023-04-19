import {
  append,
  CORSHeader,
  createResponse,
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
  isCORSPreflightRequest,
  isCORSRequest,
  match,
  stringifyInstancePath,
} from "./utils.ts";
import { Header } from "./constants.ts";

export interface CORSOptions extends CORSResponseHeaders {
  readonly exposeHeaders?: readonly string[];
}

export interface CORSResponseHeaders {
  /**
   * @default "*"
   */
  readonly allowOrigins?: "*" | readonly (string | RegExp)[];
  readonly allowCredentials?: true | "true";
}

export interface CORSPreflightResponseHeaders extends CORSResponseHeaders {
  readonly allowMethods?: readonly string[];
  readonly allowHeaders?: readonly string[];
  readonly maxAge?: number;
}

/** Create CORS request middleware.
 *
 * @throws {Error} If the {@link CORSOptions.exposeHeaders} includes invalid member.
 */
export function cors(options: CORSOptions = {}): Middleware {
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

function createOriginMatcher(
  allowOrigins: readonly (string | RegExp)[],
): (origin: string) => boolean {
  return (origin: string) =>
    allowOrigins.some((pattern) => match(origin, pattern));
}

/**
 * @internal
 */
export async function _cors(
  context: Readonly<
    { [k in keyof Omit<CORSOptions, "allowOrigins">]?: string } & {
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

  if (!isCORSRequest(request)) return createResponse(response, { headers });

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

  return createResponse(response, { headers: finalHeaders });
}

export function getAllowedOrigin(
  origin: string,
  check: ((origin: string) => boolean) | undefined,
): string {
  if (!check) return Char.Star;

  return check(origin) ? origin : "";
}

export interface PreflightOptions extends CORSPreflightResponseHeaders {
  /** Preflight response status code.
   * @default 204
   */
  readonly status?: Status.OK | Status.NoContent;
}

/** Create middleware for CORS preflight request.
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
      [k in keyof Omit<CORSPreflightResponseHeaders, "allowOrigins">]?: string;
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

    return createResponse(response, { headers });
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
