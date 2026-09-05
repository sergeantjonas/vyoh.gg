import { HttpError } from "@/lib/http-error";
import type { SteamOwnedGame } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { resolveGameRow } from "./game-row-state";

const row = { appid: 440, name: "Team Fortress 2" } as SteamOwnedGame;
const idle = { isPending: true, isFetching: false, error: null, data: undefined };
const settled = { isPending: false, isFetching: false, error: null };

describe("resolveGameRow", () => {
  it("is ready from the list row without consulting the single-row query", () => {
    expect(resolveGameRow(row, { ...settled, data: { games: [row] } }, idle)).toEqual({
      kind: "ready",
      game: row,
    });
  });

  it("is ready from the single row while the list is still loading", () => {
    expect(resolveGameRow(undefined, idle, { ...settled, data: row })).toEqual({
      kind: "ready",
      game: row,
    });
  });

  it("is pending while the list loads and the single row has not been asked for", () => {
    expect(resolveGameRow(undefined, idle, idle)).toEqual({ kind: "pending" });
  });

  it("is pending while the single row is in flight", () => {
    const inFlight = { isPending: true, isFetching: true, error: null, data: undefined };
    expect(resolveGameRow(undefined, { ...settled, data: undefined }, inFlight)).toEqual({
      kind: "pending",
    });
  });

  it("is missing when the list came back without the row", () => {
    const list = { ...settled, data: { games: [] } };
    expect(resolveGameRow(undefined, list, idle)).toEqual({ kind: "missing" });
  });

  it("is missing while still loading when the server render already saw a 404", () => {
    const inFlight = { isPending: true, isFetching: true, error: null, data: undefined };
    expect(resolveGameRow(undefined, idle, inFlight, true)).toEqual({ kind: "missing" });
  });

  it("lets a row that arrives later override the server's 404", () => {
    expect(resolveGameRow(undefined, idle, { ...settled, data: row }, true)).toEqual({
      kind: "ready",
      game: row,
    });
  });

  it("is missing when the row endpoint answered 404", () => {
    const gone = {
      isPending: false,
      isFetching: false,
      error: new HttpError(404),
      data: undefined,
    };
    expect(resolveGameRow(undefined, idle, gone)).toEqual({ kind: "missing" });
  });

  it("is an error when the row endpoint failed for any other reason", () => {
    const down = {
      isPending: false,
      isFetching: false,
      error: new HttpError(500),
      data: undefined,
    };
    expect(
      resolveGameRow(
        undefined,
        { ...settled, data: undefined, error: new Error("x") },
        down
      )
    ).toEqual({
      kind: "error",
    });
  });
});
