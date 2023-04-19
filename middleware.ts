import {
  append,
  CORSHeader,
  createResponse,
  type Handler,
  mergeHeaders,
  type Middleware,
} from "./deps.ts";
import {
  assertFieldNameFormat,
  isCORSPreflightRequest,
  isCORSRequest,
  match,
  stringifyInstancePath,
} from "./utils.ts";
import { Header } from "./constants.ts";

const enum Char {
  Star = "*",
  Comma = ",",
  Sp = " ",
  Separator = `${Char.Comma}${Char.Sp}`,
}

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
  const instanceName = stringifyInstancePath.bind(null, "exposeHeaders");
  const matchOrigin = allowOrigins === Char.Star
    ? undefined
    : createOriginMatcher(allowOrigins);

  function assertExposeHeader(input: string, i: number): asserts input {
    assertFieldNameFormat(
      input,
      `${instanceName(i)} is invalid <field-name> format. "${input}"`,
    );
  }

  exposeHeaders?.forEach(assertExposeHeader);

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
