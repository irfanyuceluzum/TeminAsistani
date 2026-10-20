import { describe, expect, it } from "vitest";
import { kdvTutari } from "./vergi";

describe("kdvTutari", () => {
  it("oran 0/1/10/20", () => {
    expect(kdvTutari(10_000, 0)).toBe(0);
    expect(kdvTutari(10_000, 1)).toBe(100);
    expect(kdvTutari(10_000, 10)).toBe(1_000);
    expect(kdvTutari(10_000, 20)).toBe(2_000);
  });
  it("kuruşa yuvarlar", () => {
    expect(kdvTutari(1_234, 20)).toBe(247); // 246,8
    expect(kdvTutari(1_233, 10)).toBe(123); // 123,3
    expect(kdvTutari(1_005, 10)).toBe(101); // 100,5
  });
});
