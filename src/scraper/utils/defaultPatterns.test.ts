import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXCLUSION_PATTERNS,
  DEFAULT_FILE_EXCLUSIONS,
  DEFAULT_FOLDER_EXCLUSIONS,
  DEFAULT_LOCALE_PATH_PATTERN,
  DEFAULT_LOCALE_QUERY_PATTERN,
  getEffectiveExclusionPatterns,
} from "./defaultPatterns";

describe("defaultPatterns", () => {
  describe("DEFAULT_FILE_EXCLUSIONS", () => {
    it("should have file exclusion patterns defined", () => {
      expect(DEFAULT_FILE_EXCLUSIONS).toBeDefined();
      expect(DEFAULT_FILE_EXCLUSIONS.length).toBeGreaterThan(0);
    });

    it("should include sample common documentation files", () => {
      expect(DEFAULT_FILE_EXCLUSIONS).toContain("**/CHANGELOG.md");
      expect(DEFAULT_FILE_EXCLUSIONS).toContain("**/LICENSE");
      expect(DEFAULT_FILE_EXCLUSIONS).toContain("**/CODE_OF_CONDUCT.md");
    });
  });

  describe("DEFAULT_FOLDER_EXCLUSIONS", () => {
    it("should have folder exclusion patterns defined", () => {
      expect(DEFAULT_FOLDER_EXCLUSIONS).toBeDefined();
      expect(DEFAULT_FOLDER_EXCLUSIONS.length).toBeGreaterThan(0);
    });

    it("should include sample archive and i18n folder patterns", () => {
      expect(DEFAULT_FOLDER_EXCLUSIONS).toContain("**/archive/**");
      expect(DEFAULT_FOLDER_EXCLUSIONS).toContain("**/deprecated/**");
      expect(DEFAULT_FOLDER_EXCLUSIONS).toContain("**/i18n/zh*/**");
    });
  });

  describe("DEFAULT_EXCLUSION_PATTERNS", () => {
    it("should combine file and folder patterns", () => {
      expect(DEFAULT_EXCLUSION_PATTERNS).toHaveLength(
        DEFAULT_FILE_EXCLUSIONS.length + DEFAULT_FOLDER_EXCLUSIONS.length,
      );
      expect(DEFAULT_EXCLUSION_PATTERNS.length).toBeGreaterThan(0);
    });
  });

  describe("getEffectiveExclusionPatterns", () => {
    it("should return default patterns when no user patterns provided", () => {
      const result = getEffectiveExclusionPatterns(undefined);
      expect(result).toEqual(DEFAULT_EXCLUSION_PATTERNS);
    });

    it("should merge user patterns with default patterns when provided", () => {
      const userPatterns = ["custom/*", "user-specific.md"];
      const result = getEffectiveExclusionPatterns(userPatterns);
      // Defaults must be preserved
      for (const def of DEFAULT_EXCLUSION_PATTERNS) {
        expect(result).toContain(def);
      }
      // User patterns must also be present
      expect(result).toContain("custom/*");
      expect(result).toContain("user-specific.md");
    });

    it("should preserve default patterns even if user provides empty array", () => {
      const result = getEffectiveExclusionPatterns([]);
      expect(result).toEqual(DEFAULT_EXCLUSION_PATTERNS);
    });

    it("should not contain duplicates when user patterns overlap with defaults", () => {
      const userPatterns = ["**/archive/**", "custom/*"];
      const result = getEffectiveExclusionPatterns(userPatterns);
      const occurrences = result.filter((p) => p === "**/archive/**");
      expect(occurrences).toHaveLength(1);
    });

    it("should adapt locale patterns when startUrl specifies non-English query language", () => {
      const startUrl = "https://example.jp/docs?hl=ja";
      const result = getEffectiveExclusionPatterns(undefined, startUrl);
      // The query pattern should allow ja
      const queryPattern = result.find((p) => p.includes("hl="));
      expect(queryPattern).toBeDefined();
      expect(queryPattern).toContain("ja");
    });

    it("should adapt locale patterns when startUrl path has explicit non-English locale", () => {
      const startUrl = "https://example.de/de/tutorial";
      const result = getEffectiveExclusionPatterns(undefined, startUrl);
      // The path pattern should exclude de from the blocked locales list
      const pathPattern = result.find((p) => p.startsWith("/^\\/"));
      expect(pathPattern).toBeDefined();
      expect(pathPattern).not.toMatch(/\(ar\|.*\|de\|/);
    });

    it("should unblock hardcoded locale folder exclusions when startUrl specifies non-English locale", () => {
      const startUrlZh = "https://example.com/zh-cn/docs";
      const resultZh = getEffectiveExclusionPatterns(undefined, startUrlZh);
      expect(resultZh).not.toContain("**/zh-cn/**");
      expect(resultZh).not.toContain("**/i18n/zh*/**");
      // Other locales must remain blocked
      expect(resultZh).toContain("**/zh-tw/**");
      expect(resultZh).toContain("**/i18n/ja*/**");
      expect(resultZh).toContain("**/archive/**");

      const startUrlJa = "https://example.com/i18n/ja/guide";
      const resultJa = getEffectiveExclusionPatterns(undefined, startUrlJa);
      expect(resultJa).not.toContain("**/i18n/ja*/**");
      expect(resultJa).toContain("**/zh-cn/**");
      expect(resultJa).toContain("**/i18n/zh*/**");
    });

    it("should match path locales accompanied by query parameters", () => {
      const re = new RegExp(
        DEFAULT_LOCALE_PATH_PATTERN.slice(
          1,
          DEFAULT_LOCALE_PATH_PATTERN.lastIndexOf("/"),
        ),
        "i",
      );
      expect(re.test("/docs/ja?page=2")).toBe(true);
      expect(re.test("/de?v=1")).toBe(true);
      expect(re.test("/docs/guide/id?page=1")).toBe(false);
      expect(re.test("/docs/en?page=1")).toBe(false);
    });

    it("should match Polish ?lang=pl and ?locale=pl in query patterns", () => {
      const re = new RegExp(
        DEFAULT_LOCALE_QUERY_PATTERN.slice(
          1,
          DEFAULT_LOCALE_QUERY_PATTERN.lastIndexOf("/"),
        ),
        "i",
      );
      expect(re.test("?lang=pl")).toBe(true);
      expect(re.test("?locale=pl")).toBe(true);
      expect(re.test("?lang=python")).toBe(false);
    });
  });
});
