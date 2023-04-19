import { _cors, cors } from "./middleware.ts";
import {
  assert,
  assertIsError,
  CORSHeader,
  describe,
  equalsResponse,
  Header,
  it,
  Method,
} from "./_dev_deps.ts";

const ORIGIN = "http://test.example";

describe("_cors", () => {
  it("should return same response with vary if the request is not CORS request", async () => {
    const response = await _cors(
      {},
      new Request("test:"),
      () => new Response(null, { headers: { [Header.Vary]: "User-Agent" } }),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [Header.Vary]: `User-Agent, ${Header.Origin}`,
          },
        }),
        true,
      ),
    );
  });

  it("should return response what includes ACAO header", async () => {
    const response = await _cors(
      {},
      new Request("test:", { headers: { [Header.Origin]: ORIGIN } }),
      () => new Response(),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: "*",
            [Header.Vary]: Header.Origin,
          },
        }),
        true,
      ),
    );
  });

  it("should keep ACAO header from init response", async () => {
    const response = await _cors(
      {},
      new Request("test:", { headers: { [Header.Origin]: ORIGIN } }),
      () =>
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: "",
          },
        }),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: "",
            [Header.Vary]: Header.Origin,
          },
        }),
        true,
      ),
    );
  });

  it("should pass allow origin if the function return true", async () => {
    const response = await _cors(
      { matchOrigin: () => true },
      new Request("test:", { headers: { [Header.Origin]: ORIGIN } }),
      () => new Response(null),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: ORIGIN,
            [Header.Vary]: Header.Origin,
          },
        }),
        true,
      ),
    );
  });

  it("should not pass allow origin if the function return false", async () => {
    const response = await _cors(
      { matchOrigin: () => false },
      new Request("test:", { headers: { [Header.Origin]: ORIGIN } }),
      () => new Response(null),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: "",
            [Header.Vary]: Header.Origin,
          },
        }),
        true,
      ),
    );
  });

  it("should include ACAC header", async () => {
    const response = await _cors(
      { allowCredentials: "true" },
      new Request("test:", { headers: { [Header.Origin]: ORIGIN } }),
      () => new Response(null),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: "*",
            [CORSHeader.AccessControlAllowCredentials]: "true",
            [Header.Vary]: Header.Origin,
          },
        }),
        true,
      ),
    );
  });

  it("should respect headers what already exist", async () => {
    const response = await _cors(
      { allowCredentials: "true" },
      new Request("test:", { headers: { [Header.Origin]: ORIGIN } }),
      () =>
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowCredentials]: "test",
          },
        }),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: "*",
            [CORSHeader.AccessControlAllowCredentials]: "test",
            [Header.Vary]: Header.Origin,
          },
        }),
        true,
      ),
    );
  });

  it("should include ACEH header", async () => {
    const response = await _cors(
      { exposeHeaders: "x-test" },
      new Request("test:", { headers: { [Header.Origin]: ORIGIN } }),
      () => new Response(null),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: "*",
            [CORSHeader.AccessControlExposeHeaders]: "x-test",
            [Header.Vary]: Header.Origin,
          },
        }),
        true,
      ),
    );
  });

  it("should not include ACEH header if the request is CORS preflight request", async () => {
    const response = await _cors(
      { exposeHeaders: "x-test" },
      new Request("test:", {
        headers: {
          [Header.Origin]: ORIGIN,
          [CORSHeader.AccessControlRequestHeaders]: "",
          [CORSHeader.AccessControlRequestMethod]: "",
        },
        method: Method.Options,
      }),
      () => new Response(null),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: "*",
            [Header.Vary]: Header.Origin,
          },
        }),
        true,
      ),
    );
  });

  it("should respect ACEH headers what already exist", async () => {
    const response = await _cors(
      { exposeHeaders: "x-test" },
      new Request("test:", { headers: { [Header.Origin]: ORIGIN } }),
      () =>
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlExposeHeaders]: "x-exist",
          },
        }),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: "*",
            [CORSHeader.AccessControlExposeHeaders]: "x-exist",
            [Header.Vary]: Header.Origin,
          },
        }),
        true,
      ),
    );
  });

  it("complex case", async () => {
    const response = await _cors(
      {
        exposeHeaders: "x-test",
        allowCredentials: "true",
        matchOrigin: (origin) => origin === ORIGIN,
      },
      new Request("test:", { headers: { [Header.Origin]: ORIGIN } }),
      () =>
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlExposeHeaders]: "x-exist",
          },
        }),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: ORIGIN,
            [CORSHeader.AccessControlAllowCredentials]: "true",
            [CORSHeader.AccessControlExposeHeaders]: "x-exist",
            [Header.Vary]: Header.Origin,
          },
        }),
        true,
      ),
    );
  });
});

describe("cors", () => {
  it("should return response what includes ACAO header", async () => {
    const middleware = cors();
    const response = await middleware(
      new Request("test:", {
        headers: { [Header.Origin]: ORIGIN },
      }),
      () => new Response(),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: "*",
            [Header.Vary]: "origin",
          },
        }),
        true,
      ),
    );
  });

  it("should return response what includes ACAO header", async () => {
    const middleware = cors({
      allowOrigins: [""],
    });
    const response = await middleware(
      new Request("test:", {
        headers: { [Header.Origin]: ORIGIN },
      }),
      () => new Response(),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: "",
            [Header.Vary]: "origin",
          },
        }),
        true,
      ),
    );
  });

  it("should return response what includes ACAO header", async () => {
    const middleware = cors({
      allowOrigins: [/^http/],
      allowCredentials: true,
      exposeHeaders: ["x-test", "x-test2"],
    });
    const response = await middleware(
      new Request("test:", {
        headers: { [Header.Origin]: ORIGIN },
      }),
      () => new Response(),
    );

    assert(
      await equalsResponse(
        response,
        new Response(null, {
          headers: {
            [CORSHeader.AccessControlAllowOrigin]: ORIGIN,
            [CORSHeader.AccessControlAllowCredentials]: "true",
            [CORSHeader.AccessControlExposeHeaders]: "x-test, x-test2",
            [Header.Vary]: "origin",
          },
        }),
        true,
      ),
    );
  });

  it("should throw error if the exposeHeaders include invalid member", () => {
    let err;

    try {
      cors({ exposeHeaders: [""] });
    } catch (e) {
      err = e;
    } finally {
      assertIsError(
        err,
        Error,
        `exposeHeaders[0] is invalid <field-name> format. ""`,
      );
    }
  });
});
