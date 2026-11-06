import { describe, expect, it } from "vitest";
import { findCountry, splitInternational, toInternational, COUNTRIES } from "@/lib/countries";

describe("international phone numbers", () => {
  it("adds the chosen country code and drops a leading zero", () => {
    expect(toInternational(findCountry("GB")!, "07911 123456")).toBe("+44 7911123456");
  });
  it("does not double the code when the user typed it", () => {
    expect(toInternational(findCountry("ET")!, "+251 911 223 344")).toBe("+251 911223344");
  });
  it("rejects numbers that are too short", () => {
    expect(toInternational(findCountry("US")!, "12")).toBeNull();
  });
  it("splits a stored number back into its country", () => {
    const r = splitInternational("+971 501234567");
    expect(r.country?.iso).toBe("AE");
    expect(r.local).toBe("501234567");
  });
  it("lists every country with a flag", () => {
    expect(COUNTRIES.length).toBeGreaterThan(190);
    expect(findCountry("ET")!.flag).toBe("🇪🇹");
  });
});
