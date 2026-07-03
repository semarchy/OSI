import { describe, expect, it } from "vitest";
import { selectExpression } from "../src/dialect.js";
import type { OSIExpression } from "../src/osi-types.js";

describe("selectExpression (dialect fallback chain)", () => {
  it("prefers the SEMARCHY dialect when present", () => {
    const expr: OSIExpression = {
      dialects: [
        { dialect: "ANSI_SQL", expression: "a + b" },
        { dialect: "SEMARCHY", expression: "a ++ b" },
      ],
    };
    const warnings: string[] = [];
    const sel = selectExpression(expr, "field x", warnings);
    expect(sel).toEqual({ dialect: "SEMARCHY", expression: "a ++ b" });
    expect(warnings).toHaveLength(0);
  });

  it("falls back to ANSI_SQL and warns when SEMARCHY is missing", () => {
    const expr: OSIExpression = {
      dialects: [{ dialect: "ANSI_SQL", expression: "a + b" }],
    };
    const warnings: string[] = [];
    const sel = selectExpression(expr, "field x", warnings);
    expect(sel).toEqual({ dialect: "ANSI_SQL", expression: "a + b" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("falling back to ANSI_SQL");
  });

  it("returns undefined and warns when neither SEMARCHY nor ANSI_SQL is present", () => {
    const expr: OSIExpression = {
      dialects: [{ dialect: "SNOWFLAKE", expression: "a + b" }],
    };
    const warnings: string[] = [];
    const sel = selectExpression(expr, "metric m", warnings);
    expect(sel).toBeUndefined();
    expect(warnings[0]).toContain("neither SEMARCHY nor ANSI_SQL");
  });

  it("warns when there is no expression at all", () => {
    const warnings: string[] = [];
    expect(selectExpression(undefined, "field y", warnings)).toBeUndefined();
    expect(selectExpression({ dialects: [] }, "field z", warnings)).toBeUndefined();
    expect(warnings).toHaveLength(2);
  });
});
