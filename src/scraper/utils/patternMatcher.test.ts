import { describe, expect, it } from "vitest";
import { DEFAULT_EXCLUSION_PATTERNS } from "./defaultPatterns";
import {
  extractPathAndQuery,
  isRegexPattern,
  matchesAnyHostPattern,
  matchesAnyPattern,
  patternToRegExp,
  shouldIncludeUrl,
} from "./patternMatcher";

describe("patternMatcher", () => {
  it("isRegexPattern detects regex", () => {
    expect(isRegexPattern("/foo.*/")).toBe(true);
    expect(isRegexPattern("foo.*/")).toBe(false);
    expect(isRegexPattern("/foo.*/")).toBe(true);
    expect(isRegexPattern("foo.*")).toBe(false);
  });

  it("patternToRegExp auto-detects regex and glob", () => {
    expect(patternToRegExp("/foo.*/").test("foo123")).toBe(true);
    expect(patternToRegExp("foo*bar").test("fooxbar")).toBe(true);
    expect(patternToRegExp("foo*bar").test("fooyyybar")).toBe(true);
    expect(patternToRegExp("foo*bar").test("foo/bar")).toBe(false);
  });

  it("matchesAnyPattern works for globs and regex", () => {
    expect(matchesAnyPattern("foo/abc/bar", ["foo/*/bar"])).toBe(true);
    expect(matchesAnyPattern("foo/abc/bar", ["/foo/.*/bar/"])).toBe(true);
    expect(matchesAnyPattern("foo/abc/bar", ["baz/*"])).toBe(false);
  });

  it("extractPathAndQuery extracts path and query", () => {
    expect(extractPathAndQuery("https://example.com/foo/bar?x=1")).toBe("/foo/bar?x=1");
    expect(extractPathAndQuery("/foo/bar?x=1")).toBe("/foo/bar?x=1");
  });

  describe("shouldIncludeUrl with explicit patterns", () => {
    it("should apply exclude over include when patterns are explicitly provided", () => {
      // Exclude wins
      expect(shouldIncludeUrl("https://x.com/foo", ["foo*"], ["/foo/"])).toBe(false);
      // Include only
      expect(shouldIncludeUrl("https://x.com/foo", ["foo*"], [])).toBe(true);
      // Exclude only
      expect(shouldIncludeUrl("https://x.com/foo", undefined, ["foo*"])).toBe(false);
    });

    it("should preserve default exclusions when user provides empty array", () => {
      // User passing empty array still preserves defaults
      expect(shouldIncludeUrl("https://example.com/CHANGELOG.md", undefined, [])).toBe(
        false,
      );
      expect(shouldIncludeUrl("https://example.com/LICENSE", undefined, [])).toBe(false);
      expect(shouldIncludeUrl("https://example.com/docs/guide", undefined, [])).toBe(
        true,
      );
    });

    it("should support regex patterns with flags and not mistake multi-segment globs for regex", () => {
      expect(isRegexPattern("/foo/i")).toBe(true);
      expect(patternToRegExp("/foo/i").test("FOO")).toBe(true);
      expect(patternToRegExp("/foo/").test("FOO")).toBe(false);

      // Multi-segment path globs with unescaped slashes must NOT be treated as regex literals
      expect(isRegexPattern("/api/v1/users/d")).toBe(false);
      expect(isRegexPattern("/docs/guide/i")).toBe(false);
      expect(isRegexPattern("/docs/**/")).toBe(false);

      // Regex with escaped slashes IS a valid regex
      expect(isRegexPattern("/^\\/docs\\/guide/i")).toBe(true);
    });

    it("should ensure regex caching is idempotent and does not suffer from lastIndex state mutation", () => {
      const re = patternToRegExp("/foo/i");
      expect(re.test("foo")).toBe(true);
      expect(re.test("foo")).toBe(true);
      expect(matchesAnyPattern("/foo/bar", ["/foo/i"])).toBe(true);
      expect(matchesAnyPattern("/foo/baz", ["/foo/i"])).toBe(true);
      expect(matchesAnyHostPattern("foo.example.com", ["/foo/i"])).toBe(true);
      expect(matchesAnyHostPattern("foo.example.com", ["/foo/i"])).toBe(true);
    });

    it("should exclude path-based non-English locales even with query parameters", () => {
      expect(shouldIncludeUrl("https://developer.chrome.com/docs/ja?page=2")).toBe(false);
      expect(shouldIncludeUrl("https://developer.chrome.com/de?v=1")).toBe(false);
      expect(shouldIncludeUrl("https://developer.chrome.com/docs/en?page=2")).toBe(true);
    });

    it("should not exclude English URLs containing hash fragments", () => {
      expect(
        shouldIncludeUrl("https://developer.chrome.com/docs/extensions?hl=en#manifest"),
      ).toBe(true);
      expect(
        shouldIncludeUrl(
          "https://developer.chrome.com/docs/extensions?hl=en-US#overview",
        ),
      ).toBe(true);
      expect(shouldIncludeUrl("https://example.com/docs/guide?lang=en#setup")).toBe(true);
      expect(
        shouldIncludeUrl("https://developer.chrome.com/docs/extensions?hl=ja#manifest"),
      ).toBe(false);
    });

    it("should include single-language documentation in locale folders when startUrl specifies it", () => {
      const startUrl = "https://example.com/zh-cn/docs";
      expect(
        shouldIncludeUrl(
          "https://example.com/zh-cn/docs/guide",
          undefined,
          undefined,
          startUrl,
        ),
      ).toBe(true);
      // Other locales must still be excluded
      expect(
        shouldIncludeUrl(
          "https://example.com/zh-tw/docs/guide",
          undefined,
          undefined,
          startUrl,
        ),
      ).toBe(false);
      expect(
        shouldIncludeUrl(
          "https://example.com/ja/docs/guide",
          undefined,
          undefined,
          startUrl,
        ),
      ).toBe(false);
    });

    it("should exclude non-English query parameter variants by default", () => {
      // Non-English hl query parameters (Google DevSite style)
      expect(shouldIncludeUrl("https://developer.chrome.com/docs/extensions?hl=vi")).toBe(
        false,
      );
      expect(
        shouldIncludeUrl("https://developer.chrome.com/docs/extensions?hl=zh-cn"),
      ).toBe(false);
      expect(shouldIncludeUrl("https://developer.chrome.com/docs/extensions?hl=ar")).toBe(
        false,
      );
      expect(shouldIncludeUrl("https://developer.chrome.com/docs/extensions?hl=ru")).toBe(
        false,
      );
      expect(
        shouldIncludeUrl("https://developer.chrome.com/docs/extensions?param=1&hl=es"),
      ).toBe(false);

      // Other non-English query parameters
      expect(shouldIncludeUrl("https://example.com/guide?lang=ja")).toBe(false);
      expect(shouldIncludeUrl("https://example.com/guide?locale=fr")).toBe(false);
      expect(shouldIncludeUrl("https://example.com/guide?language=de")).toBe(false);

      // English query parameters or regular parameters must be included
      expect(shouldIncludeUrl("https://developer.chrome.com/docs/extensions?hl=en")).toBe(
        true,
      );
      expect(
        shouldIncludeUrl("https://developer.chrome.com/docs/extensions?hl=en-US"),
      ).toBe(true);
      expect(shouldIncludeUrl("https://example.com/guide?lang=en")).toBe(true);
      expect(shouldIncludeUrl("https://example.com/guide?lang=en_US")).toBe(true);
      expect(shouldIncludeUrl("https://example.com/guide?lang=english")).toBe(true);
      expect(shouldIncludeUrl("https://developer.chrome.com/docs/extensions")).toBe(true);
      expect(shouldIncludeUrl("https://example.com/api?version=1.0")).toBe(true);

      // Programming language selection parameters must NEVER be blocked
      expect(shouldIncludeUrl("https://example.com/docs/api?lang=python")).toBe(true);
      expect(shouldIncludeUrl("https://example.com/docs/api?lang=javascript")).toBe(true);
      expect(shouldIncludeUrl("https://example.com/docs/api?lang=rust")).toBe(true);
      expect(shouldIncludeUrl("https://example.com/docs/api?language=typescript")).toBe(
        true,
      );
      expect(shouldIncludeUrl("https://example.com/docs/api?language=python")).toBe(true);
    });

    it("should never block DOM attributes, REST API IDs, or technical paths containing 'id'", () => {
      // MDN DOM attribute documentation
      expect(
        shouldIncludeUrl("https://developer.mozilla.org/en-US/docs/Web/API/Element/id"),
      ).toBe(true);
      expect(
        shouldIncludeUrl(
          "https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/id",
        ),
      ).toBe(true);
      expect(
        shouldIncludeUrl(
          "https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/id",
        ),
      ).toBe(true);

      // REST API endpoints with ID parameter or subresource
      expect(shouldIncludeUrl("https://example.com/api/users/id")).toBe(true);
      expect(shouldIncludeUrl("https://example.com/api/users/id/posts")).toBe(true);
      expect(shouldIncludeUrl("https://example.com/docs/item/id/details")).toBe(true);
      expect(shouldIncludeUrl("https://example.com/api/v1/projects/id")).toBe(true);

      // Technical paths and abbreviations (ARKit, Elasticsearch)
      expect(
        shouldIncludeUrl("https://developer.apple.com/documentation/arkit/ar/intro"),
      ).toBe(true);
      expect(shouldIncludeUrl("https://example.com/docs/elasticsearch")).toBe(true);
    });

    it("should safely handle glob patterns with slashes and invalid flags without throwing SyntaxError", () => {
      // Directory glob with slashes must not crash regex constructor
      expect(() => patternToRegExp("/docs/**/")).not.toThrow();
      expect(patternToRegExp("/docs/**/").test("/docs/guide/")).toBe(true);

      // Pattern looking like flags must not crash
      expect(() => patternToRegExp("/something/test")).not.toThrow();
    });

    it("should preserve regex patterns in stripSlash for file:// URLs", () => {
      expect(shouldIncludeUrl("file:///path/to/test.md")).toBe(true);
      expect(shouldIncludeUrl("file:///path/to/Element/id/index.html")).toBe(true);
    });

    it("should handle single non-English documentation without blocking itself", () => {
      // If startUrl explicitly targets Japanese, don't block that Japanese target
      const jpStartUrl = "https://example.jp/docs?hl=ja";
      expect(
        shouldIncludeUrl(
          "https://example.jp/docs/api?hl=ja",
          undefined,
          undefined,
          jpStartUrl,
        ),
      ).toBe(true);
      // But still block other non-target languages
      expect(
        shouldIncludeUrl(
          "https://example.jp/docs/api?hl=vi",
          undefined,
          undefined,
          jpStartUrl,
        ),
      ).toBe(false);

      // If a documentation site has only 1 language without language query params, it is not blocked
      expect(shouldIncludeUrl("https://docs.example.vn/cai-dat")).toBe(true);
    });

    it("should include test runner documentation and specifications on web documentation sites", () => {
      const bunStartUrl = "https://bun.com/docs";
      // Bun test runner subpages must be included
      expect(
        shouldIncludeUrl(
          "https://bun.com/docs/test/writing-tests",
          undefined,
          undefined,
          bunStartUrl,
        ),
      ).toBe(true);
      expect(
        shouldIncludeUrl(
          "https://bun.com/docs/test/mocks",
          undefined,
          undefined,
          bunStartUrl,
        ),
      ).toBe(true);
      expect(
        shouldIncludeUrl(
          "https://bun.com/docs/test/snapshots",
          undefined,
          undefined,
          bunStartUrl,
        ),
      ).toBe(true);
      expect(
        shouldIncludeUrl(
          "https://bun.com/docs/test/configuration",
          undefined,
          undefined,
          bunStartUrl,
        ),
      ).toBe(true);

      // Web specifications must not be blocked by spec
      expect(
        shouldIncludeUrl(
          "https://html.spec.whatwg.org/multipage/",
          undefined,
          undefined,
          "https://html.spec.whatwg.org/",
        ),
      ).toBe(true);
      expect(
        shouldIncludeUrl(
          "https://spec.openapis.org/oas/v3.1.0",
          undefined,
          undefined,
          "https://spec.openapis.org/",
        ),
      ).toBe(true);
      expect(
        shouldIncludeUrl(
          "https://tc39.es/ecma262/spec/",
          undefined,
          undefined,
          "https://tc39.es/",
        ),
      ).toBe(true);

      // Preserves locale and archive exclusions even within test docs
      expect(
        shouldIncludeUrl(
          "https://bun.com/docs/test/writing-tests?hl=vi",
          undefined,
          undefined,
          bunStartUrl,
        ),
      ).toBe(false);
      expect(
        shouldIncludeUrl(
          "https://bun.com/docs/archive/v1/test",
          undefined,
          undefined,
          bunStartUrl,
        ),
      ).toBe(false);
      // Preserves test code file exclusions
      expect(
        shouldIncludeUrl(
          "https://bun.com/docs/examples/app.test.ts",
          undefined,
          undefined,
          bunStartUrl,
        ),
      ).toBe(false);
    });

    it("should exclude root test directories while including docs/test in repository scrapes", () => {
      const githubUrl = "https://github.com/oven-sh/bun";
      // Test fixtures and root test directory in GitHub repo must be excluded
      expect(
        shouldIncludeUrl("tests/fixtures/mock.json", undefined, undefined, githubUrl),
      ).toBe(false);
      expect(shouldIncludeUrl("test/helpers.ts", undefined, undefined, githubUrl)).toBe(
        false,
      );
      expect(
        shouldIncludeUrl(
          "src/components/__tests__/mock.ts",
          undefined,
          undefined,
          githubUrl,
        ),
      ).toBe(false);

      // But markdown docs under docs/ in a GitHub repo must be included
      expect(
        shouldIncludeUrl("docs/test/runner.md", undefined, undefined, githubUrl),
      ).toBe(true);
    });

    it("should exclude root test directories while including docs/test in local repository scrapes", () => {
      const localRepoUrl = "file:///Users/dev/my-project";
      // Test fixtures and root test directory in local repo must be excluded
      expect(
        shouldIncludeUrl(
          "file:///Users/dev/my-project/test/helper.ts",
          undefined,
          undefined,
          localRepoUrl,
        ),
      ).toBe(false);
      expect(
        shouldIncludeUrl(
          "file:///Users/dev/my-project/tests/fixture.json",
          undefined,
          undefined,
          localRepoUrl,
        ),
      ).toBe(false);
      expect(
        shouldIncludeUrl(
          "file:///Users/dev/my-project/packages/core/test/mock.ts",
          undefined,
          undefined,
          localRepoUrl,
        ),
      ).toBe(false);

      // But markdown docs under docs/ in a local repo must be included
      expect(
        shouldIncludeUrl(
          "file:///Users/dev/my-project/docs/test/runner.md",
          undefined,
          undefined,
          localRepoUrl,
        ),
      ).toBe(true);
    });
  });

  describe("shouldIncludeUrl with default patterns", () => {
    it("should apply default exclusions when no user exclude patterns provided", () => {
      // Default patterns should exclude common documentation files
      expect(
        shouldIncludeUrl("https://example.com/CHANGELOG.md", undefined, undefined),
      ).toBe(false);
      expect(
        shouldIncludeUrl("https://example.com/changelog.md", undefined, undefined),
      ).toBe(false);
      expect(shouldIncludeUrl("https://example.com/LICENSE", undefined, undefined)).toBe(
        false,
      );
      expect(
        shouldIncludeUrl("https://example.com/LICENSE.md", undefined, undefined),
      ).toBe(false);
      expect(
        shouldIncludeUrl("https://example.com/CODE_OF_CONDUCT.md", undefined, undefined),
      ).toBe(false);
    });

    it("should apply default folder exclusions", () => {
      // Archive folders
      expect(
        shouldIncludeUrl("https://example.com/archive/old-docs.md", undefined, undefined),
      ).toBe(false);
      expect(
        shouldIncludeUrl("https://example.com/archived/legacy.md", undefined, undefined),
      ).toBe(false);
      expect(
        shouldIncludeUrl("https://example.com/old/stuff.md", undefined, undefined),
      ).toBe(false);
      expect(
        shouldIncludeUrl("https://example.com/docs/old/readme.md", undefined, undefined),
      ).toBe(false);

      // Deprecated/legacy folders
      expect(
        shouldIncludeUrl("https://example.com/deprecated/api.md", undefined, undefined),
      ).toBe(false);
      expect(
        shouldIncludeUrl("https://example.com/legacy/guide.md", undefined, undefined),
      ).toBe(false);
      expect(
        shouldIncludeUrl("https://example.com/previous/version.md", undefined, undefined),
      ).toBe(false);

      // i18n folders
      expect(
        shouldIncludeUrl("https://example.com/i18n/zh-cn/guide.md", undefined, undefined),
      ).toBe(false);
      expect(
        shouldIncludeUrl("https://example.com/i18n/es/tutorial.md", undefined, undefined),
      ).toBe(false);
      expect(
        shouldIncludeUrl("https://example.com/i18n/fr/docs.md", undefined, undefined),
      ).toBe(false);

      // Locale folders
      expect(
        shouldIncludeUrl(
          "https://example.com/zh-cn/documentation.md",
          undefined,
          undefined,
        ),
      ).toBe(false);
      expect(
        shouldIncludeUrl("https://example.com/zh-tw/guide.md", undefined, undefined),
      ).toBe(false);
    });

    it("should include normal documentation files when using defaults", () => {
      expect(
        shouldIncludeUrl("https://example.com/docs/guide.md", undefined, undefined),
      ).toBe(true);
      expect(
        shouldIncludeUrl("https://example.com/api/reference.md", undefined, undefined),
      ).toBe(true);
      expect(
        shouldIncludeUrl("https://example.com/tutorials/basic.md", undefined, undefined),
      ).toBe(true);
      expect(
        shouldIncludeUrl("https://example.com/README.md", undefined, undefined),
      ).toBe(true);
    });

    it("should work with file:// URLs and basename matching", () => {
      // Should exclude based on basename for file:// URLs
      expect(
        shouldIncludeUrl("file:///docs/subdir/CHANGELOG.md", undefined, undefined),
      ).toBe(false);
      expect(shouldIncludeUrl("file:///project/LICENSE", undefined, undefined)).toBe(
        false,
      );

      // Should include normal files
      expect(shouldIncludeUrl("file:///docs/README.md", undefined, undefined)).toBe(true);
      expect(shouldIncludeUrl("file:///guide/tutorial.md", undefined, undefined)).toBe(
        true,
      );
    });

    it("should apply defaults correctly with include patterns", () => {
      // Include docs/* but still exclude defaults
      expect(
        shouldIncludeUrl("https://example.com/docs/guide.md", ["docs/*"], undefined),
      ).toBe(true);
      expect(
        shouldIncludeUrl("https://example.com/docs/CHANGELOG.md", ["docs/*"], undefined),
      ).toBe(false);
      expect(
        shouldIncludeUrl("https://example.com/other/guide.md", ["docs/*"], undefined),
      ).toBe(false);
    });
  });

  describe("default patterns behavior verification", () => {
    it("should have expected default exclusion patterns", () => {
      expect(DEFAULT_EXCLUSION_PATTERNS.length).toBeGreaterThan(0);
      expect(DEFAULT_EXCLUSION_PATTERNS).toContain("**/CHANGELOG.md");
      expect(DEFAULT_EXCLUSION_PATTERNS).toContain("**/LICENSE");
      expect(DEFAULT_EXCLUSION_PATTERNS).toContain("**/archive/**");
      expect(DEFAULT_EXCLUSION_PATTERNS).toContain("**/i18n/zh*/**");
    });
  });

  describe("double asterisk (**) pattern matching", () => {
    it("should match files at any depth with **/filename pattern", () => {
      // Root level
      expect(matchesAnyPattern("/README.md", ["**/README.md"])).toBe(true);
      expect(matchesAnyPattern("/foo", ["**/foo"])).toBe(true);

      // Nested levels
      expect(matchesAnyPattern("/docs/README.md", ["**/README.md"])).toBe(true);
      expect(matchesAnyPattern("/docs/foo", ["**/foo"])).toBe(true);

      // Deep nested
      expect(matchesAnyPattern("/project/docs/sub/README.md", ["**/README.md"])).toBe(
        true,
      );
      expect(matchesAnyPattern("/project/docs/sub/foo", ["**/foo"])).toBe(true);

      // Should not match different filenames
      expect(matchesAnyPattern("/CHANGELOG.md", ["**/README.md"])).toBe(false);
      expect(matchesAnyPattern("/docs/bar", ["**/foo"])).toBe(false);
    });

    it("should work with shouldIncludeUrl for HTTP URLs", () => {
      // Root level matches
      expect(shouldIncludeUrl("https://example.com/foo", ["**/foo"])).toBe(true);
      expect(shouldIncludeUrl("https://example.com/README.md", ["**/README.md"])).toBe(
        true,
      );

      // Nested level matches
      expect(shouldIncludeUrl("https://example.com/docs/foo", ["**/foo"])).toBe(true);
      expect(
        shouldIncludeUrl("https://example.com/docs/README.md", ["**/README.md"]),
      ).toBe(true);

      // Deep nested matches
      expect(shouldIncludeUrl("https://example.com/docs/sub/foo", ["**/foo"])).toBe(true);
      expect(
        shouldIncludeUrl("https://example.com/project/docs/sub/README.md", [
          "**/README.md",
        ]),
      ).toBe(true);

      // No matches
      expect(shouldIncludeUrl("https://example.com/bar", ["**/foo"])).toBe(false);
      expect(
        shouldIncludeUrl("https://example.com/docs/CHANGELOG.md", ["**/README.md"]),
      ).toBe(false);
    });

    it("should work with file:// URLs and basename matching", () => {
      // file:// URLs get both path and basename matching
      expect(shouldIncludeUrl("file:///path/to/README.md", ["**/README.md"])).toBe(true);
      expect(shouldIncludeUrl("file:///path/to/README.md", ["README.md"])).toBe(true); // basename
      expect(shouldIncludeUrl("file:///project/docs/foo", ["**/foo"])).toBe(true);
      expect(shouldIncludeUrl("file:///project/docs/foo", ["foo"])).toBe(true); // basename
    });

    it("should support complex glob patterns with **", () => {
      // Directory wildcards
      expect(matchesAnyPattern("/docs/api/v1/spec.json", ["**/api/*/spec.json"])).toBe(
        true,
      );
      expect(
        matchesAnyPattern("/project/docs/api/v2/spec.json", ["**/api/*/spec.json"]),
      ).toBe(true);
      expect(matchesAnyPattern("/docs/api/spec.json", ["**/api/*/spec.json"])).toBe(
        false,
      ); // missing version

      // Extension wildcards
      expect(matchesAnyPattern("/docs/readme.md", ["**/readme.*"])).toBe(true);
      expect(matchesAnyPattern("/project/docs/readme.txt", ["**/readme.*"])).toBe(true);
      expect(matchesAnyPattern("/docs/changelog.md", ["**/readme.*"])).toBe(false);
    });

    it("should support directory-based patterns (foo/** and **/foo/**)", () => {
      // foo/** - matches foo directory at root level and anything under it
      expect(matchesAnyPattern("/foo/bar", ["foo/**"])).toBe(true);
      expect(matchesAnyPattern("/foo/bar/baz", ["foo/**"])).toBe(true);
      expect(matchesAnyPattern("/foo", ["foo/**"])).toBe(false); // foo itself, not under foo
      expect(matchesAnyPattern("/other/foo/bar", ["foo/**"])).toBe(false); // foo not at root

      // **/foo/** - matches foo directory anywhere and anything under it
      expect(matchesAnyPattern("/foo/bar", ["**/foo/**"])).toBe(true);
      expect(matchesAnyPattern("/docs/foo/bar", ["**/foo/**"])).toBe(true);
      expect(matchesAnyPattern("/project/docs/foo/baz", ["**/foo/**"])).toBe(true);
      expect(matchesAnyPattern("/foo", ["**/foo/**"])).toBe(false); // foo itself, not under foo
      expect(matchesAnyPattern("/docs/foo", ["**/foo/**"])).toBe(false); // foo itself, not under foo
      expect(matchesAnyPattern("/foobar/test", ["**/foo/**"])).toBe(false); // foobar != foo
    });

    it("should find shortest patterns for matching subdirectory foo", () => {
      // Different ways to match "foo" as a subdirectory component
      const testPath = "/project/docs/foo/readme.md";

      // Exact directory match anywhere: **/foo/**
      expect(matchesAnyPattern(testPath, ["**/foo/**"])).toBe(true);

      // Directory component match: */foo/* (single level before and after)
      expect(matchesAnyPattern("/docs/foo/readme.md", ["*/foo/*"])).toBe(true);
      expect(matchesAnyPattern(testPath, ["*/foo/*"])).toBe(false); // too many levels before

      // Multiple level variants
      expect(matchesAnyPattern(testPath, ["*/*/foo/*"])).toBe(true); // exactly 2 levels before, 1 after
      expect(matchesAnyPattern(testPath, ["**/foo/*"])).toBe(true); // any levels before, 1 after

      // Shortest universal pattern for "foo" directory anywhere: **/foo/**
      expect(matchesAnyPattern("/foo/", ["**/foo/**"])).toBe(true); // root level
      expect(matchesAnyPattern("/foo/bar", ["**/foo/**"])).toBe(true); // root level
      expect(matchesAnyPattern("/a/foo/bar", ["**/foo/**"])).toBe(true); // nested
      expect(matchesAnyPattern("/a/b/foo/c/d", ["**/foo/**"])).toBe(true); // deep nested
    });

    it("should demonstrate shortest patterns for common use cases", () => {
      // Shortest pattern to match any subdirectory named "foo": **/foo/**
      expect(shouldIncludeUrl("https://example.com/foo/index.html", ["**/foo/**"])).toBe(
        true,
      );
      expect(
        shouldIncludeUrl("https://example.com/src/foo/utils.js", ["**/foo/**"]),
      ).toBe(true);
      expect(
        shouldIncludeUrl("https://example.com/project/lib/foo/main.ts", ["**/foo/**"]),
      ).toBe(true);

      // Alternative patterns for different use cases
      expect(shouldIncludeUrl("https://example.com/foo", ["**/foo"])).toBe(true); // exact directory name
      expect(shouldIncludeUrl("https://example.com/foo/file", ["**/foo/**"])).toBe(true); // foo directory contents
      expect(shouldIncludeUrl("https://example.com/foobar", ["**/foo*"])).toBe(true); // starts with foo

      // Most specific: exact directory contents only **/foo/**
      expect(shouldIncludeUrl("https://example.com/foo", ["**/foo/**"])).toBe(false); // directory itself
      expect(shouldIncludeUrl("https://example.com/foobar", ["**/foo/**"])).toBe(false); // not exact match
    });

    it("should test URL patterns with directory matching", () => {
      const dirPatterns = ["**/docs/**", "**/api/**", "**/foo/**"];

      // Should match directory anywhere in URL path
      expect(shouldIncludeUrl("https://example.com/docs/guide.html", dirPatterns)).toBe(
        true,
      );
      expect(
        shouldIncludeUrl("https://example.com/project/docs/api.html", dirPatterns),
      ).toBe(true);
      expect(
        shouldIncludeUrl("https://example.com/v1/api/endpoints.json", dirPatterns),
      ).toBe(true);
      expect(shouldIncludeUrl("https://example.com/lib/foo/utils.js", dirPatterns)).toBe(
        true,
      );

      // Should not match directory name as part of filename
      expect(shouldIncludeUrl("https://example.com/myapi.html", dirPatterns)).toBe(false);
      expect(shouldIncludeUrl("https://example.com/foodocs.html", dirPatterns)).toBe(
        false,
      );

      // Should not match the directory itself (only contents under it)
      expect(shouldIncludeUrl("https://example.com/docs", dirPatterns)).toBe(false);
      expect(shouldIncludeUrl("https://example.com/project/api", dirPatterns)).toBe(
        false,
      );
    });
  });

  describe("pattern edge cases", () => {
    it("should handle patterns without leading/trailing slashes", () => {
      // Patterns without leading slash should still work
      expect(matchesAnyPattern("/docs/file.md", ["docs/file.md"])).toBe(true);
      expect(matchesAnyPattern("/docs/file.md", ["docs/*"])).toBe(true);

      // Multiple variations should work
      expect(shouldIncludeUrl("https://example.com/docs/file.md", ["docs/file.md"])).toBe(
        true,
      );
      // Note: /docs/file.md pattern expects exact match but URL has leading slash normalization
      expect(shouldIncludeUrl("https://example.com/docs/file.md", ["docs/file.md"])).toBe(
        true,
      );
    });

    it("should handle query parameters in URLs", () => {
      // Query parameters are included in the path for pattern matching
      expect(shouldIncludeUrl("https://example.com/docs/api?v=1", ["docs/*"])).toBe(true);
      expect(shouldIncludeUrl("https://example.com/docs/api?v=1", ["docs/api*"])).toBe(
        true,
      ); // * matches query
      expect(
        shouldIncludeUrl("https://example.com/docs/api?v=1&format=json", ["docs/api*"]),
      ).toBe(true);

      // **/api won't match because the path ends with "?v=1", not "api"
      expect(shouldIncludeUrl("https://example.com/docs/api?v=1", ["**/api"])).toBe(
        false,
      );
      // But this will match:
      expect(shouldIncludeUrl("https://example.com/docs/api", ["**/api"])).toBe(true); // no query params
      expect(shouldIncludeUrl("https://example.com/docs/api?v=1", ["**/api*"])).toBe(
        true,
      ); // wildcard after api
    });

    it("should handle multiple patterns (OR logic)", () => {
      const patterns = ["docs/*", "api/*", "**/README.md"];

      expect(shouldIncludeUrl("https://example.com/docs/guide", patterns)).toBe(true);
      expect(shouldIncludeUrl("https://example.com/api/v1", patterns)).toBe(true);
      expect(shouldIncludeUrl("https://example.com/project/README.md", patterns)).toBe(
        true,
      );
      expect(shouldIncludeUrl("https://example.com/other/file", patterns)).toBe(false);
    });

    it("should handle common documentation file patterns", () => {
      const docPatterns = [
        "**/README.md",
        "**/CHANGELOG.md",
        "**/package.json",
        "**/index.html",
      ];

      // Root level
      expect(shouldIncludeUrl("https://example.com/README.md", docPatterns)).toBe(true);
      expect(shouldIncludeUrl("https://example.com/package.json", docPatterns)).toBe(
        true,
      );

      // Nested
      expect(shouldIncludeUrl("https://example.com/docs/README.md", docPatterns)).toBe(
        true,
      );
      expect(
        shouldIncludeUrl("https://example.com/src/components/README.md", docPatterns),
      ).toBe(true);
      expect(shouldIncludeUrl("https://example.com/api/index.html", docPatterns)).toBe(
        true,
      );

      // Should not match
      expect(shouldIncludeUrl("https://example.com/src/code.js", docPatterns)).toBe(
        false,
      );
    });
  });

  describe("regex pattern behavior", () => {
    it("should handle regex patterns with ** equivalent", () => {
      // Regex equivalent of **/foo
      expect(shouldIncludeUrl("https://example.com/foo", ["/.*\\/foo$/"])).toBe(true);
      expect(shouldIncludeUrl("https://example.com/docs/foo", ["/.*\\/foo$/"])).toBe(
        true,
      );
      expect(shouldIncludeUrl("https://example.com/docs/sub/foo", ["/.*\\/foo$/"])).toBe(
        true,
      );

      // Should also match root level (no leading slash in path)
      expect(shouldIncludeUrl("https://example.com/foo", ["/.*foo$/"])).toBe(true);
    });

    it("should handle mixed glob and regex patterns", () => {
      const mixedPatterns = ["**/README.md", "/api\\/v\\d+/", "docs/*"];

      expect(shouldIncludeUrl("https://example.com/README.md", mixedPatterns)).toBe(true); // glob
      expect(shouldIncludeUrl("https://example.com/api/v1", mixedPatterns)).toBe(true); // regex
      expect(shouldIncludeUrl("https://example.com/docs/guide", mixedPatterns)).toBe(
        true,
      ); // glob
      expect(shouldIncludeUrl("https://example.com/other/file", mixedPatterns)).toBe(
        false,
      );
    });

    it("should match regex patterns anchored on a full URL", () => {
      // Regression test: previously the matcher prepended `/` to inputs that
      // didn't start with one, which broke regex patterns anchored with
      // `^https://` because the URL became `/https://...` before testing.
      const pythonDocs = [
        "/^https:\\/\\/docs\\.python\\.org\\/3\\/(library|reference|howto)\\//",
      ];

      expect(
        shouldIncludeUrl("https://docs.python.org/3/library/functions.html", pythonDocs),
      ).toBe(true);
      expect(
        shouldIncludeUrl(
          "https://docs.python.org/3/reference/datamodel.html",
          pythonDocs,
        ),
      ).toBe(true);
      expect(
        shouldIncludeUrl("https://docs.python.org/3/howto/regex.html", pythonDocs),
      ).toBe(true);

      // Other sections on the same host should not match.
      expect(
        shouldIncludeUrl("https://docs.python.org/3/tutorial/index.html", pythonDocs),
      ).toBe(false);
      // Other hosts should not match.
      expect(shouldIncludeUrl("https://example.com/3/library/foo.html", pythonDocs)).toBe(
        false,
      );
    });

    it("should support multi-host regex include patterns", () => {
      // A single regex can allow specific subdomains while excluding others.
      const patterns = ["/^https:\\/\\/(docs|api)\\.example\\.com\\/v\\d+\\//"];

      expect(shouldIncludeUrl("https://docs.example.com/v1/guide", patterns)).toBe(true);
      expect(shouldIncludeUrl("https://api.example.com/v2/ref", patterns)).toBe(true);
      expect(shouldIncludeUrl("https://blog.example.com/v1/post", patterns)).toBe(false);
    });
  });

  describe("full URL vs pathname pattern matching", () => {
    it("should match patterns against both full URL and pathname", () => {
      const testUrl = "https://example.com/docs/v3/guide";

      // Full URL patterns should work
      expect(
        shouldIncludeUrl(testUrl, undefined, ["https://example.com/docs/v3/**"]),
      ).toBe(false);
      expect(
        shouldIncludeUrl(testUrl, undefined, ["https://example.com/docs/v2/**"]),
      ).toBe(true); // different version, should NOT exclude

      // Path-based patterns should also work
      expect(shouldIncludeUrl(testUrl, undefined, ["/docs/v3/**"])).toBe(false);
      expect(shouldIncludeUrl(testUrl, undefined, ["/docs/v2/**"])).toBe(true); // different version, should NOT exclude

      // Relative path patterns should work
      expect(shouldIncludeUrl(testUrl, undefined, ["docs/v3/**"])).toBe(false);
      expect(shouldIncludeUrl(testUrl, undefined, ["docs/v2/**"])).toBe(true); // different version, should NOT exclude
    });

    it("should match directory paths with trailing slash", () => {
      const testUrl = "https://example.com/docs/v3/";

      // Pattern should match both with and without trailing slash
      expect(shouldIncludeUrl(testUrl, undefined, ["/docs/v3/**"])).toBe(false);
      expect(
        shouldIncludeUrl(testUrl, undefined, ["https://example.com/docs/v3/**"]),
      ).toBe(false);
      expect(shouldIncludeUrl(testUrl, undefined, ["docs/v3/**"])).toBe(false);
    });

    it("should support includePatterns with both full URL and pathname", () => {
      const testUrl = "https://example.com/docs/guide";

      // Full URL include pattern
      expect(shouldIncludeUrl(testUrl, ["https://example.com/docs/**"])).toBe(true);
      expect(shouldIncludeUrl(testUrl, ["https://example.com/api/**"])).toBe(false);

      // Path-based include pattern
      expect(shouldIncludeUrl(testUrl, ["/docs/**"])).toBe(true);
      expect(shouldIncludeUrl(testUrl, ["/api/**"])).toBe(false);

      // Relative path include pattern
      expect(shouldIncludeUrl(testUrl, ["docs/**"])).toBe(true);
      expect(shouldIncludeUrl(testUrl, ["api/**"])).toBe(false);
    });

    it("should handle v3 exclusion with full URL pattern", () => {
      const v3Url = "https://example.com/docs/v3/";
      const v3GuideUrl = "https://example.com/docs/v3/getting-started";

      // Full URL pattern should exclude v3 URLs
      expect(shouldIncludeUrl(v3Url, undefined, ["https://example.com/docs/v3/**"])).toBe(
        false,
      );
      expect(
        shouldIncludeUrl(v3GuideUrl, undefined, ["https://example.com/docs/v3/**"]),
      ).toBe(false);
    });

    it("should handle v3 exclusion with absolute path pattern", () => {
      const v3Url = "https://example.com/docs/v3/";
      const v3GuideUrl = "https://example.com/docs/v3/getting-started";

      // Absolute path pattern should exclude v3 URLs
      expect(shouldIncludeUrl(v3Url, undefined, ["/docs/v3/**"])).toBe(false);
      expect(shouldIncludeUrl(v3GuideUrl, undefined, ["/docs/v3/**"])).toBe(false);
    });

    it("should handle v3 exclusion with relative path pattern", () => {
      const v3Url = "https://example.com/docs/v3/";
      const v3GuideUrl = "https://example.com/docs/v3/getting-started";

      // Relative path pattern should exclude v3 URLs
      expect(shouldIncludeUrl(v3Url, undefined, ["docs/v3/**"])).toBe(false);
      expect(shouldIncludeUrl(v3GuideUrl, undefined, ["docs/v3/**"])).toBe(false);
    });

    it("should support wildcards in domain for full URL patterns", () => {
      const testUrl = "https://docs.example.com/guide";

      // Exact domain match
      expect(shouldIncludeUrl(testUrl, undefined, ["https://docs.example.com/**"])).toBe(
        false,
      );

      // Different domain should not match
      expect(shouldIncludeUrl(testUrl, undefined, ["https://api.example.com/**"])).toBe(
        true,
      );

      // Wildcard subdomain (using regex)
      expect(
        shouldIncludeUrl(testUrl, undefined, ["/https:\\/\\/.*\\.example\\.com\\/.*/"]),
      ).toBe(false);
    });

    it("should maintain backward compatibility with existing patterns", () => {
      // All existing tests should still pass with the enhanced matching
      const testUrl = "https://example.com/docs/archive/old.md";

      // Pattern without leading slash (relative)
      expect(shouldIncludeUrl(testUrl, undefined, ["**/archive/**"])).toBe(false);

      // Pattern with leading slash (absolute path)
      expect(shouldIncludeUrl(testUrl, undefined, ["/docs/archive/**"])).toBe(false);

      // Basename matching for file:// URLs
      expect(
        shouldIncludeUrl("file:///path/to/CHANGELOG.md", undefined, ["**/CHANGELOG.md"]),
      ).toBe(false);
    });
  });
});

describe("compiled pattern caching", () => {
  // Patterns are recompiled per URL without a cache, which dominates link
  // filtering: every discovered URL is tested against ~70 default exclusions,
  // twice. Caching must not change any verdict.
  it("returns the same compiled RegExp for a repeated pattern", () => {
    const first = patternToRegExp("**/*.test.*");
    const second = patternToRegExp("**/*.test.*");
    expect(second).toBe(first);
  });

  it("keeps distinct patterns distinct", () => {
    expect(patternToRegExp("**/*.md")).not.toBe(patternToRegExp("**/*.mdx"));
  });

  it("gives the same verdict on repeated evaluation", () => {
    const patterns = ["**/archive/**", "/\\.(ini|cfg)$/", "**/*.min.js"];
    const urls = [
      "https://example.com/docs/archive/old.html",
      "https://example.com/docs/guide.html",
      "https://example.com/app.min.js",
      "https://example.com/settings.ini",
    ];
    const first = urls.map((u) => matchesAnyPattern(u, patterns));
    const second = urls.map((u) => matchesAnyPattern(u, patterns));
    expect(second).toEqual(first);
    expect(first).toEqual([true, false, true, true]);
  });

  it("does not let a host-pattern match leak into URL matching", () => {
    // matchesAnyHostPattern lowercases its pattern before compiling; the cache
    // is keyed on the compiled string, so the two callers must not collide.
    expect(matchesAnyHostPattern("EXAMPLE.com", ["example.com"])).toBe(true);
    expect(matchesAnyPattern("/example.com", ["example.com"])).toBe(true);
  });
});
