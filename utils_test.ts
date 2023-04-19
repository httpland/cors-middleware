import { fromResponse } from "./utils.ts";
import { assert, describe, equalsResponse, it, Status } from "./_dev_deps.ts";

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
