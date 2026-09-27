import { Minimatch, minimatch } from "minimatch";
import { getEffectiveExclusionPatterns } from "./defaultPatterns";

/**
 * Utility functions for pattern matching (glob and regex) for URL filtering.
 * Supports auto-detection and conversion of glob patterns to RegExp.
 *
 * Default exclusion patterns are applied when no user-provided exclude patterns are specified.
 * This includes common documentation files (CHANGELOG.md, LICENSE, etc.) and folders
 * (archive directories, non-English locales, etc.).
 *
 * Patterns starting and ending with '/' are treated as regex, otherwise as glob (minimatch syntax).
 * Glob wildcards supported: '*' (any chars except '/'), '**' (any chars, including '/').
 *
 * @module patternMatcher
 */

/**
 * Compiled-pattern caches.
 *
 * Every discovered URL is matched against the full exclusion set — around 70
 * default patterns, tested against both the full URL and the pathname — so
 * recompiling each pattern per URL dominates the cost of link filtering.
 * Compilation depends only on the pattern string (options are fixed), and the
 * key space is the set of distinct patterns in use rather than anything
 * URL-derived, so these stay naturally bounded.
 */
const regExpCache = new Map<string, RegExp>();
const globCache = new Map<string, Minimatch>();

/**
 * Returns a compiled matcher for a glob pattern, reusing a previous one when the
 * same pattern has been seen before.
 *
 * @param pattern The glob pattern to compile.
 * @returns A reusable Minimatch instance.
 */
function getGlobMatcher(pattern: string): Minimatch {
  let matcher = globCache.get(pattern);
  if (!matcher) {
    matcher = new Minimatch(pattern, { dot: true });
    globCache.set(pattern, matcher);
  }
  return matcher;
}

/**
 * Regex matching pattern that starts with '/' and ends with '/' plus optional valid regex flags.
 * Excludes stateful flags (g, y) and indices flag (d) to prevent cache state corruption.
 */
const REGEX_PATTERN = /^\/(.+)\/([imsuv]*)$/;

/**
 * Detects if a pattern is a regex (starts with '/' and ends with '/' plus optional valid flags).
 * - Flags are restricted to valid non-stateful flags [imsuv]*.
 * - If flags are present and body contains unescaped slashes, it is treated as a path glob (e.g. /docs/guide/i).
 * - If the body is not a valid RegExp (e.g. /docs/** with trailing slash), it is treated as a glob.
 */
export function isRegexPattern(pattern: string): boolean {
  const match = pattern.match(REGEX_PATTERN);
  if (!match) return false;
  const [, body, flags] = match;
  // If flags are present but body contains unescaped slashes, it's a multi-segment path glob, not a regex
  if (flags.length > 0 && /(?<!\\)(?:\\\\)*\//.test(body)) {
    return false;
  }
  try {
    new RegExp(body, flags || undefined);
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a pattern string to a RegExp instance (auto-detects glob/regex with flags).
 * For globs, uses minimatch's internal conversion.
 * If regex construction fails (e.g. invalid regex syntax in glob),
 * safely falls back to minimatch glob compilation.
 */
export function patternToRegExp(pattern: string): RegExp {
  const cached = regExpCache.get(pattern);
  if (cached) {
    cached.lastIndex = 0;
    return cached;
  }

  let re: RegExp | false = false;
  if (isRegexPattern(pattern)) {
    const match = pattern.match(REGEX_PATTERN);
    if (match) {
      const [, body, rawFlags] = match;
      const flags = (rawFlags || "").replace(/[gy]/g, "");
      try {
        re = new RegExp(body, flags || undefined);
      } catch {
        // Fallback to glob if regex syntax is invalid
        re = minimatch.makeRe(pattern, { dot: true });
      }
    }
  } else {
    // For globs, minimatch.makeRe returns a RegExp
    re = minimatch.makeRe(pattern, { dot: true });
  }
  if (!re) throw new Error(`Invalid glob pattern: ${pattern}`);

  re.lastIndex = 0;
  regExpCache.set(pattern, re);
  return re;
}

/**
 * Matches an absolute URL with a scheme (e.g. `https://`, `file://`).
 * Used to avoid prepending a `/` to inputs that are already full URLs.
 */
const URL_WITH_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Checks if a given path matches any pattern in the list.
 * For globs, uses minimatch. For regex, uses RegExp.
 */
export function matchesAnyPattern(path: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) return false;
  // Always match from a leading slash for path-based globs, but leave full
  // URLs (with scheme) untouched so anchored regex patterns like `^https://`
  // still match.
  const isFullUrl = URL_WITH_PROTOCOL_RE.test(path);
  const normalizedPath = isFullUrl || path.startsWith("/") ? path : `/${path}`;
  return patterns.some((pattern) => {
    if (isRegexPattern(pattern)) {
      const re = patternToRegExp(pattern);
      re.lastIndex = 0;
      return re.test(normalizedPath);
    }
    // For glob patterns:
    // - If pattern starts with '/', strip leading slash from BOTH pattern and path for minimatch
    // - Otherwise, strip leading slash only from path
    const pathForMatch = normalizedPath.replace(/^\//, "");
    const patternForMatch = pattern.startsWith("/") ? pattern.slice(1) : pattern;
    return getGlobMatcher(patternForMatch).match(pathForMatch);
  });
}

/**
 * Matches a flat string (hostname, label, etc.) against patterns without any
 * path normalization. Patterns use the same syntax as URL patterns: a glob
 * processed by minimatch, or a regex wrapped in `/.../`. Matching is
 * case-insensitive, which matches DNS semantics for the hostname use case.
 */
export function matchesAnyHostPattern(value: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) return false;
  const normalized = value.toLowerCase();
  return patterns.some((pattern) => {
    if (isRegexPattern(pattern)) {
      const re = patternToRegExp(pattern);
      re.lastIndex = 0;
      return re.test(value);
    }
    return getGlobMatcher(pattern.toLowerCase()).match(normalized);
  });
}

/**
 * Extracts the path and query from a URL string (no domain).
 */
export function extractPathAndQuery(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || "");
  } catch {
    return url; // fallback: return as-is
  }
}

/**
 * Determines if a URL should be included based on include/exclude patterns.
 * Exclude patterns take precedence. If no include patterns, all are included by default.
 *
 * If no user exclude patterns are provided, default exclusion patterns are automatically applied.
 * These defaults exclude common documentation files (CHANGELOG.md, LICENSE, etc.) and folders
 * (archives, non-English locales, etc.).
 *
 * Patterns are matched against both the full URL and the pathname for maximum flexibility:
 * - Full URL: `https://example.com/docs/v3/**` matches `https://example.com/docs/v3/guide`
 * - Pathname: `/docs/v3/**` matches `https://example.com/docs/v3/guide`
 */
export function shouldIncludeUrl(
  url: string,
  includePatterns?: string[],
  excludePatterns?: string[],
  startUrl?: string,
): boolean {
  // Extract pathname for path-based pattern matching
  const path = extractPathAndQuery(url);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // For file:// URLs, also match against the basename (strip leading slash from pattern for basename matching)
  let basename: string | undefined;
  if (url.startsWith("file://")) {
    try {
      const u = new URL(url);
      basename = u.pathname ? u.pathname.split("/").pop() : undefined;
    } catch {}
  }

  // Extract relative path from startUrl when available (supports root-anchored repo patterns e.g. "test/**", "packages/*/test/**")
  let relativePath: string | undefined;
  if (startUrl) {
    try {
      const startObj = new URL(startUrl);
      const urlObj = new URL(url);
      if (startObj.protocol === urlObj.protocol && startObj.host === urlObj.host) {
        const basePath = startObj.pathname.replace(/\/$/, "");
        if (urlObj.pathname.startsWith(basePath)) {
          const rel = urlObj.pathname.slice(basePath.length).replace(/^\//, "");
          if (rel) {
            relativePath = rel + (urlObj.search || "");
          }
        }
      }
    } catch {}
  }

  // Helper to strip leading slash from glob patterns for basename matching (preserves regex patterns)
  const stripSlash = (patterns?: string[]) =>
    patterns?.map((p) => (!isRegexPattern(p) && p.startsWith("/") ? p.slice(1) : p));

  // Get effective exclusion patterns (merges defaults with user patterns, respecting startUrl)
  const effectiveExcludePatterns = getEffectiveExclusionPatterns(
    excludePatterns,
    startUrl,
  );

  // Exclude patterns take precedence
  // Match against full URL, pathname, relativePath, and basename for maximum flexibility
  if (
    matchesAnyPattern(url, effectiveExcludePatterns) ||
    matchesAnyPattern(normalizedPath, effectiveExcludePatterns) ||
    (relativePath && matchesAnyPattern(relativePath, effectiveExcludePatterns)) ||
    (basename && matchesAnyPattern(basename, stripSlash(effectiveExcludePatterns)))
  )
    return false;
  if (!includePatterns || includePatterns.length === 0) return true;
  // Match against full URL, pathname, relativePath, and basename for maximum flexibility
  return (
    matchesAnyPattern(url, includePatterns) ||
    matchesAnyPattern(normalizedPath, includePatterns) ||
    (relativePath ? matchesAnyPattern(relativePath, includePatterns) : false) ||
    (basename ? matchesAnyPattern(basename, stripSlash(includePatterns)) : false)
  );
}
