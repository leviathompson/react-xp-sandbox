import { describe, expect, it } from "vitest";
import { sameBaseDomain } from "../utils/general";

describe("sameBaseDomain", () => {
    it("matches hosts on the same base domain", () => {
        expect(sameBaseDomain("https://games.neopets.com", "https://www.neopets.com")).toBe(true);
    });

    it("does not match unrelated hosts", () => {
        expect(sameBaseDomain("https://www.neopets.com", "https://www.habbo.com")).toBe(false);
    });
});
