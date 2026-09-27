/**
 * Default exclusion patterns for documentation scraping.
 * These patterns are always applied unless user explicitly provides their own exclude patterns.
 * Patterns use glob/regex syntax supported by the pattern matcher.
 */

/**
 * Default file exclusion patterns - files commonly found in documentation that should be excluded.
 * These patterns match files anywhere in the path structure.
 */
export const DEFAULT_FILE_EXCLUSIONS = [
  // CHANGELOG files (case variations)
  "**/CHANGELOG.md",
  "**/changelog.md",
  "**/CHANGELOG.mdx",
  "**/changelog.mdx",

  // LICENSE files (case variations)
  "**/LICENSE",
  "**/LICENSE.md",
  "**/license.md",

  // CODE_OF_CONDUCT files (case variations)
  "**/CODE_OF_CONDUCT.md",
  "**/code_of_conduct.md",

  // Test files
  "**/*.test.*",
  "**/*.spec.*",
  "**/*_test.py",
  "**/*_test.go",
  "**/*_spec.rb",

  // Package manager lock files
  "**/*.lock",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/go.sum",

  // Build artifacts
  "**/*.min.js",
  "**/*.min.css",
  "**/*.map",
  "**/*.d.ts",

  // IDE/System files
  "**/.DS_Store",
  "**/Thumbs.db",
  "**/*.swp",
  "**/*.swo",

  // Internal config files (using regex pattern)
  "/.*\\.(ini|cfg|conf|log|pid)$/",
];

/**
 * Repository test folder exclusion patterns - used when crawling source code repositories
 * (e.g. GitHub repos, local projects). Root-anchored and monorepo package anchored to prevent
 * indexing test fixtures, helpers, and mocks, while preserving valid documentation paths
 * (such as docs/test/... or docs/spec/...).
 */
export const DEFAULT_REPO_TEST_FOLDER_EXCLUSIONS = [
  "test/**",
  "tests/**",
  "__tests__/**",
  "**/__tests__/**",
  "packages/*/test/**",
  "packages/*/tests/**",
  "packages/*/spec/**",
  "src/**/__tests__/**",
];

/**
 * Default folder/path exclusion patterns - directories commonly found in documentation that should be excluded.
 */
export const DEFAULT_FOLDER_EXCLUSIONS = [
  // Archive and deprecated content (matches anywhere in path)
  "**/archive/**",
  "**/archived/**",
  "**/deprecated/**",
  "**/legacy/**",
  "**/old/**",
  "**/outdated/**",
  "**/previous/**",
  "**/superseded/**",

  // Specific paths that don't follow the general pattern
  "docs/old/**",

  // Build output directories
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/target/**",
  "**/.next/**",
  "**/.nuxt/**",

  // IDE directories
  "**/.vscode/**",
  "**/.idea/**",

  // Internationalization folders - non-English locales
  "**/i18n/ar*/**",
  "**/i18n/de*/**",
  "**/i18n/es*/**",
  "**/i18n/fr*/**",
  "**/i18n/hi*/**",
  "**/i18n/it*/**",
  "**/i18n/ja*/**",
  "**/i18n/ko*/**",
  "**/i18n/nl*/**",
  "**/i18n/pl*/**",
  "**/i18n/pt*/**",
  "**/i18n/ru*/**",
  "**/i18n/sv*/**",
  "**/i18n/th*/**",
  "**/i18n/tr*/**",
  "**/i18n/vi*/**",
  "**/i18n/zh*/**",

  // Common locale folder patterns
  "**/zh-cn/**",
  "**/zh-hk/**",
  "**/zh-mo/**",
  "**/zh-sg/**",
  "**/zh-tw/**",

  // Query parameter language switcher patterns (e.g. ?hl=vi, ?lang=ja, ?locale=fr)
  // Auto-excludes non-English human locales while allowing English (en, en-US, en_GB, english)
  // and strictly avoiding programming language selection parameters (python, javascript, typescript, rust, etc.).
  // Handles URL hash fragments (#) safely to avoid false positives on English anchor URLs.
  "/[?&](hl=(?!(?:en([-_][a-zA-Z0-9]+)?|english)(?:[#&]|$))[^&#]+|(?:locale|lang|language)=(?!(?:en([-_][a-zA-Z0-9]+)?|english)(?:[#&]|$))(?:[a-z]{2,3}[-_][a-zA-Z0-9]+|ar|bn|de|es|fa|fr|he|hi|it|ja|ko|nl|pl|pt|ru|th|tr|vi|zh)(?:[#&]|$))/i",

  // Path-based non-English documentation locales anchored to root or docs prefixes
  // (e.g. /de/..., /docs/fr/..., /ja/...). Does NOT match bare 'id' to avoid dropping Element.id / REST API IDs.
  "/^\\/(?:(?:docs|documentation|manual|guide|intl|i18n|v[0-9]+)\\/)?(ar|bn|de|es|fa|fr|he|hi|it|ja|ko|nl|pl|pt|pt-br|pt-pt|ru|th|tr|vi|zh|zh-cn|zh-tw|es-419|id-id|id_id)(\\/|\\?|$)/i",
];

/**
 * Curated list of non-English path locale identifiers.
 */
export const NON_ENGLISH_PATH_LOCALES = [
  "ar",
  "bn",
  "de",
  "es",
  "fa",
  "fr",
  "he",
  "hi",
  "it",
  "ja",
  "ko",
  "nl",
  "pl",
  "pt",
  "pt-br",
  "pt-pt",
  "ru",
  "th",
  "tr",
  "vi",
  "zh",
  "zh-cn",
  "zh-tw",
  "es-419",
  "id-id",
  "id_id",
];

/**
 * Default query pattern for non-English locales.
 */
export const DEFAULT_LOCALE_QUERY_PATTERN =
  "/[?&](hl=(?!(?:en([-_][a-zA-Z0-9]+)?|english)(?:[#&]|$))[^&#]+|(?:locale|lang|language)=(?!(?:en([-_][a-zA-Z0-9]+)?|english)(?:[#&]|$))(?:[a-z]{2,3}[-_][a-zA-Z0-9]+|ar|bn|de|es|fa|fr|he|hi|it|ja|ko|nl|pl|pt|ru|th|tr|vi|zh)(?:[#&]|$))/i";

/**
 * Default path pattern for non-English locales.
 */
export const DEFAULT_LOCALE_PATH_PATTERN =
  "/^\\/(?:(?:docs|documentation|manual|guide|intl|i18n|v[0-9]+)\\/)?(ar|bn|de|es|fa|fr|he|hi|it|ja|ko|nl|pl|pt|pt-br|pt-pt|ru|th|tr|vi|zh|zh-cn|zh-tw|es-419|id-id|id_id)(\\/|\\?|$)/i";

/**
 * Combined default exclusion patterns (files + folders).
 * These are applied when no user-provided exclude patterns are specified.
 */
export const DEFAULT_EXCLUSION_PATTERNS = [
  ...DEFAULT_FILE_EXCLUSIONS,
  ...DEFAULT_FOLDER_EXCLUSIONS,
];

/**
 * Unblock locale folder exclusions when a specific locale is explicitly requested.
 */
function unblockLocaleFolderExclusions(
  patterns: string[],
  allowedLocale: string,
): string[] {
  const norm = allowedLocale.toLowerCase().replace(/_/g, "-");
  const base = norm.split(/[-_]/)[0];
  return patterns.filter((pattern) => {
    if (pattern.startsWith("**/") && pattern.endsWith("/**")) {
      const folder = pattern.slice(3, -3).toLowerCase();
      // Match exact locale folder e.g. "zh-cn"
      if (folder === norm) return false;
      // Match i18n prefixes e.g. "i18n/ja*" matching "ja", or "i18n/zh*" matching "zh-cn"
      if (folder.startsWith("i18n/")) {
        const prefix = folder.slice(5).replace(/\*$/, "");
        if (norm.startsWith(prefix) || base === prefix) return false;
      }
    }
    return true;
  });
}

/**
 * Determines whether a start URL targets a code repository (e.g. GitHub repo, local directory)
 * rather than a web documentation website.
 */
export function isRepositoryTarget(startUrl?: string): boolean {
  if (!startUrl) return false;
  if (startUrl.startsWith("file://") || startUrl.startsWith("github-file://")) {
    return true;
  }
  try {
    const parsed = new URL(startUrl);
    const hostname = parsed.hostname.toLowerCase();
    if (
      (hostname === "github.com" || hostname === "www.github.com") &&
      !parsed.pathname.includes("/wiki")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Determines whether a start URL targets a web documentation site as opposed to a code repository.
 */
export function isWebDocTarget(startUrl?: string): boolean {
  if (!startUrl) return true;
  return !isRepositoryTarget(startUrl);
}

/**
 * Get effective exclusion patterns by merging defaults with user patterns.
 * Default exclusion patterns are always preserved and merged with any user patterns.
 *
 * If startUrl specifies a non-English language (e.g. ?hl=ja or /ja/), that language
 * is permitted as the requested documentation language and not excluded.
 */
export function getEffectiveExclusionPatterns(
  userPatterns?: string[],
  startUrl?: string,
): string[] {
  let defaults = DEFAULT_EXCLUSION_PATTERNS;

  // Code repositories (GitHub repos, local codebases) exclude root and package-level test folders
  // to prevent indexing unit test fixtures, helpers, and mocks. Web documentation sites omit these
  // so test runner documentation and specifications are fully indexed.
  if (isRepositoryTarget(startUrl)) {
    defaults = [...defaults, ...DEFAULT_REPO_TEST_FOLDER_EXCLUSIONS];
  }

  if (startUrl) {
    try {
      const parsedStart = new URL(startUrl);

      // 1. Check if startUrl explicitly requests a non-English language via query param
      const startLang =
        parsedStart.searchParams.get("hl") ||
        parsedStart.searchParams.get("lang") ||
        parsedStart.searchParams.get("locale") ||
        parsedStart.searchParams.get("language");
      if (startLang && !/^(?:en([-_][a-zA-Z0-9]+)?|english)$/i.test(startLang)) {
        const escapedLang = startLang.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const customLangRegex = `/[?&](hl=(?!(?:en([-_][a-zA-Z0-9]+)?|english|${escapedLang})(?:[#&]|$))[^&#]+|(?:locale|lang|language)=(?!(?:en([-_][a-zA-Z0-9]+)?|english|${escapedLang})(?:[#&]|$))(?:[a-z]{2,3}[-_][a-zA-Z0-9]+|ar|bn|de|es|fa|fr|he|hi|it|ja|ko|nl|pl|pt|ru|th|tr|vi|zh)(?:[#&]|$))/i`;
        defaults = defaults.map((p) =>
          p === DEFAULT_LOCALE_QUERY_PATTERN ? customLangRegex : p,
        );
        defaults = unblockLocaleFolderExclusions(defaults, startLang);
      }

      // 2. Check if startUrl path has an explicit non-English locale segment
      const pathSegments = parsedStart.pathname.toLowerCase().split("/").filter(Boolean);
      const matchedPathLocale = pathSegments.find((seg) =>
        NON_ENGLISH_PATH_LOCALES.includes(seg),
      );
      if (matchedPathLocale) {
        const locales = NON_ENGLISH_PATH_LOCALES.filter(
          (l) => l.toLowerCase() !== matchedPathLocale.toLowerCase(),
        );
        const customPathRegex = `/^\\/(?:(?:docs|documentation|manual|guide|intl|i18n|v[0-9]+)\\/)?(${locales.join("|")})(\\/|\\?|$)/i`;
        defaults = defaults.map((p) =>
          p === DEFAULT_LOCALE_PATH_PATTERN ? customPathRegex : p,
        );
        defaults = unblockLocaleFolderExclusions(defaults, matchedPathLocale);
      }
    } catch {}
  }

  if (!userPatterns || userPatterns.length === 0) {
    return defaults;
  }

  // Merge defaults with user patterns, eliminating duplicates
  const merged = new Set([...defaults, ...userPatterns]);
  return Array.from(merged);
}
