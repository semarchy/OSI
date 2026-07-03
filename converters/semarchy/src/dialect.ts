/**
 * Dialect selection with the OSI fallback chain.
 *
 * Per the converter guide: prefer the vendor dialect, fall back to ANSI_SQL,
 * and warn (or error) if neither is present. Never silently drop an expression.
 */
import type { OSIDialect, OSIExpression } from "./osi-types.js";

export const SEMARCHY_DIALECT: OSIDialect = "SEMARCHY";
export const ANSI_DIALECT: OSIDialect = "ANSI_SQL";

export interface DialectSelection {
  dialect: OSIDialect;
  expression: string;
}

/**
 * Select the best expression for the Semarchy target using the fallback chain
 * SEMARCHY -> ANSI_SQL. Returns `undefined` and pushes a warning if neither is
 * available; callers decide whether that is a warning or a hard error.
 */
export function selectExpression(
  expr: OSIExpression | undefined,
  context: string,
  warnings: string[],
): DialectSelection | undefined {
  if (!expr || expr.dialects.length === 0) {
    warnings.push(`[dialect] ${context}: no expression defined`);
    return undefined;
  }

  const semarchy = expr.dialects.find((d) => d.dialect === SEMARCHY_DIALECT);
  if (semarchy) {
    return { dialect: SEMARCHY_DIALECT, expression: semarchy.expression };
  }

  const ansi = expr.dialects.find((d) => d.dialect === ANSI_DIALECT);
  if (ansi) {
    warnings.push(
      `[dialect] ${context}: no SEMARCHY dialect, falling back to ANSI_SQL`,
    );
    return { dialect: ANSI_DIALECT, expression: ansi.expression };
  }

  warnings.push(
    `[dialect] ${context}: neither SEMARCHY nor ANSI_SQL present ` +
      `(have: ${expr.dialects.map((d) => d.dialect).join(", ")})`,
  );
  return undefined;
}
