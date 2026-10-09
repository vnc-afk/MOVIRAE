import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesheetPath = fileURLToPath(new URL("../../index.css", import.meta.url));
const stylesheet = readFileSync(stylesheetPath, "utf8");

const declarationsIn = (selector: string) => {
  const selectorStart = stylesheet.indexOf(`${selector} {`);
  expect(selectorStart).toBeGreaterThanOrEqual(0);

  const blockStart = selectorStart + selector.length;
  const blockEnd = stylesheet.indexOf("\n  }", blockStart);
  expect(blockEnd).toBeGreaterThan(blockStart);

  return [...stylesheet.slice(blockStart, blockEnd).matchAll(/--([\w-]+)\s*:/g)].map(
    (match) => match[1]
  );
};

describe("global stylesheet contract", () => {
  it("has balanced braces and no unterminated comments", () => {
    expect(stylesheet).not.toMatch(/\/\*(?![\s\S]*\*\/)/);

    let depth = 0;
    for (const character of stylesheet) {
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });

  it("defines the required global entrypoints in the expected order", () => {
    expect(stylesheet).toContain('@import "tailwindcss";');
    expect(stylesheet).toContain('@config "./tailwind.config.mts";');
    expect(stylesheet.indexOf('@import "tailwindcss";')).toBeLessThan(
      stylesheet.indexOf("@layer base")
    );
  });

  it("defines every light-theme token in the dark theme", () => {
    const lightTokens = declarationsIn(":root");
    const darkTokens = declarationsIn(".dark");
    const themeTokens = lightTokens.filter((token) => token !== "radius");

    expect(lightTokens.length).toBeGreaterThan(20);
    expect(darkTokens).toHaveLength(themeTokens.length);
    expect(new Set(darkTokens)).toEqual(new Set(themeTokens));
    expect(lightTokens).toContain("radius");
    expect(darkTokens).not.toContain("radius");
  });

  it("uses valid HSL token values for semantic colors", () => {
    const semanticTokens = [
      "background",
      "foreground",
      "card",
      "primary",
      "secondary",
      "muted",
      "accent",
      "destructive",
      "border",
      "input",
      "ring",
    ];

    for (const token of semanticTokens) {
      const declaration = stylesheet.match(new RegExp(`--${token}:\\s*([^;]+);`));
      expect(declaration?.[1]).toMatch(/^\s*\d+\s+\d+%\s+\d+%\s*$/);
    }
  });

  it("does not reference an undeclared custom property", () => {
    const declared = new Set(
      [...stylesheet.matchAll(/--([\w-]+)\s*:/g)].map((match) => match[1])
    );
    const referenced = [
      ...stylesheet.matchAll(/var\(--([\w-]+)(?:\s*,[^)]*)?\)/g),
    ].map((match) => match[1]);

    expect(referenced).not.toContain("");
    for (const token of referenced) {
      expect(declared).toContain(token);
    }
  });

  it("keeps scrollbar and typography behavior in the base layer", () => {
    expect(stylesheet).toMatch(/html\s*\{[\s\S]*scrollbar-gutter:\s*stable;/);
    expect(stylesheet).toMatch(/html::-\s*webkit-scrollbar-thumb:hover|html::-\s*webkit-scrollbar-thumb:hover/);
    expect(stylesheet).toMatch(/body\s*\{[\s\S]*@apply bg-background text-foreground font-sans antialiased;/);
    expect(stylesheet).toMatch(/h1,\s*h2,\s*h3,\s*h4\s*\{[\s\S]*Libre Baskerville/);
  });

  it("keeps reusable visual utilities available", () => {
    for (const className of [
      "cinema-gradient",
      "card-shadow",
      "card-shadow-hover",
      "poster-shadow",
      "glass-surface",
      "star-filled",
      "star-empty",
      "font-display",
      "hover-lift",
      "text-gradient",
    ]) {
      expect(stylesheet).toMatch(new RegExp(`\\.${className}\\s*\\{`));
    }
  });

  it("defines hover behavior for interactive visual utilities", () => {
    expect(stylesheet).toMatch(/\.hover-lift:hover\s*\{[\s\S]*transform:\s*translateY\(-4px\);/);
    expect(stylesheet).toMatch(/\.hover-lift:hover\s*\{[\s\S]*box-shadow:\s*var\(--card-shadow-hover\);/);
    expect(stylesheet).toMatch(/html::-\s*webkit-scrollbar-thumb:hover|html::-webkit-scrollbar-thumb:hover/);
  });
});
