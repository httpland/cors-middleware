import { fromResponse, stringifyInstancePath } from "./utils.ts";
import {
  assert,
  assertEquals,
  describe,
  equalsResponse,
  it,
  Status,
} from "./_dev_deps.ts";

describe("fromResponse", () => {
  it("should return new response what change partial properties", async () => {
    assert(
      await equalsResponse(fromResponse(new Response()), new Response(), true),
    );
    assert(
      await equalsResponse(
        fromResponse(new Response(null, { status: Status.NoContent })),
        new Response(null, { status: Status.NoContent }),
        true,
      ),
    );
    assert(
      await equalsResponse(
        fromResponse(new Response(null, { status: Status.NoContent }), {
          status: Status.OK,
        }),
        new Response(null, { status: Status.OK }),
        true,
      ),
    );
    assert(
      await equalsResponse(
        fromResponse(
          new Response("test", {
            headers: { "x-test": "test" },
          }),
          {
            headers: {
              "content-type": "text/plain",
              "x-test2": "test",
            },
          },
        ),
        new Response("test", {
          headers: {
            "content-type": "text/plain",
            "x-test2": "test",
          },
        }),
        true,
      ),
    );
  });
});

describe("stringifyInstancePath", () => {
  const table: [(number | string)[], string][] = [
    [[], ""],
    [["a"], "a"],
    [["a", 0], "a[0]"],
    [["a", 0, "b", 1], "a[0].b[1]"],
    [[0], "0"],
    [[0, 0, 0], "0[0][0]"],
    [[0, "0", 0, "0"], "0.0[0].0"],
  ];

  table.forEach(([input, expected]) => {
    assertEquals(stringifyInstancePath(...input), expected);
  });
});
