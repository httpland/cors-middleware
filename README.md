# cors-middleware

[![deno land](http://img.shields.io/badge/available%20on-deno.land/x-lightgrey.svg?logo=deno)](https://deno.land/x/cors_middleware)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/cors_middleware/mod.ts)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/httpland/cors-middleware)](https://github.com/httpland/cors-middleware/releases)
[![codecov](https://codecov.io/github/httpland/cors-middleware/branch/main/graph/badge.svg)](https://codecov.io/gh/httpland/cors-middleware)
[![GitHub](https://img.shields.io/github/license/httpland/cors-middleware)](https://github.com/httpland/cors-middleware/blob/main/LICENSE)

[![test](https://github.com/httpland/cors-middleware/actions/workflows/test.yaml/badge.svg)](https://github.com/httpland/cors-middleware/actions/workflows/test.yaml)
[![NPM](https://nodei.co/npm/@httpland/cors-middleware.png?mini=true)](https://nodei.co/npm/@httpland/cors-middleware/)

HTTP cross-origin resource sharing(CORS) middleware.

Compliant with
[Fetch living standard, 3.2. CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol).

## Middleware

For a definition of Universal HTTP middleware, see the
[http-middleware](https://github.com/httpland/http-middleware) project.

## CORS request and CORS preflight request

A CORS request is a request with an `Origin` header.

On the other hand, a CORS preflight request is a CORS request and satisfies the
following:

- Method is `Options`
- Includes `Access-Control-Request-Method` header
- Includes `Access-Control-Request-Headers` header

This project provides middleware for CORS requests.

## CORS request

Add a CORS header to the response in the downstream.

```ts
import {
  cors,
  type Handler,
} from "https://deno.land/x/cors_middleware@$VERSION/mod.ts";
import { assert } from "https://deno.land/std/testing/asserts.ts";

const middleware = cors();
const corsRequest = new Request("test:", {
  headers: { origin: "<origin>" },
});
declare const handler: Handler;

const response = await middleware(corsRequest, handler);

assert(response.headers.has("access-control-allow-origin"));
```

yield:

```http
Access-Control-Allow-Origin: *
Vary: Origin
```

### CORS request options

| Name             | Type                                     | Description                        |
| ---------------- | ---------------------------------------- | ---------------------------------- |
| allowOrigins     | `*` &#124; (`string` &#124; `RegExp` )[] | Allowed origin list.               |
| allowCredentials | `true` &#124; `"true"`                   | `Access-Control-Allow-Credentials` |
| exposeHeaders    | `string[]`                               | `Access-Control-Expose-Headers`    |

#### AllowOrigins

`allowOrigins` is a list of `*` or allowed origins.

The default is `*`.

If `*`, ACAO(*) is added to the response.

The list may consist of strings or regular expression objects.

The middleware compares the value of the `Origin` header with the
`allowOrigins`.

If a match is found, ACAM(`Origin`) is added to the response.

If no match, ACAM(`""`) is added to the response.

```ts
import {
  cors,
} from "https://deno.land/x/cors_middleware@$VERSION/middleware.ts";
import { assert } from "https://deno.land/std/testing/asserts.ts";

const middleware = cors({
  allowOrigins: ["https://test.example", /^https:\/\/cdn\..*/],
});
```

#### AllowCredentials

The `allowCredentials` value will serialize and added to the response as an ACAC
(`Access-Control-Allow-Credentials`) header.

```ts
import {
  cors,
} from "https://deno.land/x/cors_middleware@$VERSION/middleware.ts";

const middleware = cors({ allowCredentials: true });
```

yield:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
Vary: Origin
```

#### ExposeHeaders

The value of `exposeHeaders` will serialize and added to the response as an ACEH
(`Access-Control-Expose-Headers`) header.

However, if the request is a
[CORS preflight request](#cors-request-and-cors-preflight-request), it is not
added.

```ts
import {
  cors,
} from "https://deno.land/x/cors_middleware@$VERSION/middleware.ts";

const middleware = cors({ exposeHeaders: ["x-test"] });
```

yield:

```http
Access-Control-Allow-Origin: *
Access-Control-Expose-Headers: x-test
Vary: Origin
```

### CORS options serialization error

Each option will serialize.

If serialization fails, it throws an error as follows:

- Elements of [`exposeHeaders`](#exposeheaders) are not
  [`<field-name`](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1-2)
  format

```ts
import {
  cors,
} from "https://deno.land/x/cors_middleware@$VERSION/middleware.ts";
import { assertThrows } from "https://deno.land/std/testing/asserts.ts";

const middleware = assertThrows(() =>
  cors({ exposeHeaders: ["<invalid:field-name>"] })
);
```

## CORS preflight request

Create CORS preflight request handler.

```ts
import {
  type Handler,
  preflight,
} from "https://deno.land/x/cors_middleware@$VERSION/mod.ts";
import {
  assert,
  assertSpyCalls,
  spy,
} from "https://deno.land/std/testing/asserts.ts";

const corsPreflightRequest = new Request("test:", {
  method: "OPTIONS",
  headers: {
    origin: "<origin>",
    "access-control-request-method": "POST",
    "access-control-request-headers": "content-type",
  },
});

const next: Handler = spy(() => new Response());
const handlePreflight = preflight();
const response = await handlePreflight(corsPreflightRequest, next);

assertSpyCalls(next, 0);
assert(response.headers.status === 204);
assert(response.headers.has("access-control-allow-origin"));
assert(response.headers.has("access-control-allow-methods"));
assert(response.headers.has("access-control-allow-headers"));
assert(response.headers.has("vary"));
```

yield:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST
Access-Control-Allow-Headers: content-type
Vary: origin, access-control-request-method, access-control-request-headers
```

If the request is not a CORS preflight request, `next` will execute.

### CORS preflight options

| Name         | Type               | Description                     |
| ------------ | ------------------ | ------------------------------- |
| allowMethods | `string[]`         | `Access-Control-Allow-Methods`  |
| allowHeaders | `string[]`         | `Access-Control-Allow-Headers`  |
| maxAge       | `number`           | `Access-Control-Max-Age`        |
| status       | `200` &#124; `204` | Preflight response status code. |

#### AllowMethods

The value of `allowMethods` will serialize and added to the response as an ACAM
(`Access-Control-Allow-Methods`) header.

If not specified, ACRM (`Access-Control-Request-Method`) will add as ACAM to the
response.

```ts
import { preflight } from "https://deno.land/x/cors_middleware@$VERSION/middleware.ts";

const handler = preflight({ allowMethods: ["POST", "PUT"] });
```

yield:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, PUT
Access-Control-Allow-Headers: <Access-Control-Request-Headers>
Vary: origin, access-control-request-method, access-control-request-headers
```

#### AllowHeaders

The value of `allowHeaders` will serialize and added to the response as an ACAH
(`Access-Control-Allow-Headers`) header.

If not specified, ACRH (`Access-Control-Request-Headers`) will add as ACAH to
the response.

```ts
import { preflight } from "https://deno.land/x/cors_middleware@$VERSION/middleware.ts";

const handler = preflight({ allowHeaders: ["x-test1", "x-test2"] });
```

yield:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: <Access-Control-Request-Method>
Access-Control-Allow-Headers: x-test1, x-test2
Vary: origin, access-control-request-method, access-control-request-headers
```

#### MaxAge

The value of `maxAge` will serialize and added to the response as an ACMA
(`Access-Control-Max-Age`) header.

```ts
import { preflight } from "https://deno.land/x/cors_middleware@$VERSION/middleware.ts";

const handler = preflight({ maxAge: 86400 });
```

yield:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: <Access-Control-Request-Method>
Access-Control-Allow-Headers: <Access-Control-Request-Headers>
Access-Control-Max-Age: 86400
Vary: origin, access-control-request-method, access-control-request-headers
```

#### Status

The default is
[204 No Content](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.5).

You can change to
[200 OK](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.1).

## API

All APIs can be found in the
[deno doc](https://doc.deno.land/https/deno.land/x/cors_middleware/mod.ts).

## License

Copyright © 2023-present [httpland](https://github.com/httpland).

Released under the [MIT](./LICENSE) license