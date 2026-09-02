import { describe, expect, it } from "vitest";
import { isDirective, parseDirective } from "../engine/directives.js";

describe("directive parsing", () => {
  it("recognises only a leading $", () => {
    expect(isDirective("$run tsk_1")).toBe(true);
    expect(isDirective("  $run tsk_1")).toBe(true);
    expect(isDirective("cost is $5")).toBe(false);
  });

  it("splits verb, positional text and flags", () => {
    const directive = parseDirective('$task Add rate limiting --brief "Protect the API" --dept build --prio 3')!;
    expect(directive.verb).toBe("task");
    expect(directive.text).toBe("Add rate limiting");
    expect(directive.flags).toEqual({ brief: "Protect the API", dept: "build", prio: "3" });
  });

  it("treats a valueless flag as a boolean switch", () => {
    const directive = parseDirective("$task Ship it --plan")!;
    expect(directive.flags.plan).toBe("true");
    expect(directive.text).toBe("Ship it");
  });

  it("accepts --flag=value as well as --flag value", () => {
    const directive = parseDirective("$task Ship --dept=build")!;
    expect(directive.flags.dept).toBe("build");
  });

  it("returns null for plain text", () => {
    expect(parseDirective("just a message")).toBeNull();
  });

  it("keeps single-quoted values intact", () => {
    const directive = parseDirective("$task X --accept 'returns 429'")!;
    expect(directive.flags.accept).toBe("returns 429");
  });
});
