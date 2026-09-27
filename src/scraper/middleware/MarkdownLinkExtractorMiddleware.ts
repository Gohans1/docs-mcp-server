import type { ContentProcessorMiddleware, MiddlewareContext } from "./types";

const inlineLinkPattern =
  /(^|[^!\\])\[[^\]\n]+\]\(([^)\s]+)(?:\s+"[^"]*"|\s+'[^']*'|\s+\([^)]*\))?\)/g;
const referenceLinkPattern = /(^|[^!\\])\[[^\]\n]+\]\[([^\]\n]+)\]/g;
const referenceDefinitionPattern = /^\s{0,3}\[([^\]\n]+)\]:\s*(\S+)(?:\s+.*)?$/gm;

/**
 * Extracts crawl links from Markdown content.
 */
export class MarkdownLinkExtractorMiddleware implements ContentProcessorMiddleware {
  /**
   * Processes the context and appends Markdown link targets to context.links.
   * @param context The current processing context.
   * @param next Function to call the next middleware.
   */
  async process(context: MiddlewareContext, next: () => Promise<void>): Promise<void> {
    if (!Array.isArray(context.links)) {
      context.links = [];
    }

    for (const link of extractMarkdownLinks(context.content)) {
      if (!context.links.includes(link)) {
        context.links.push(link);
      }
    }

    await next();
  }
}

function stripCodeBlocksAndSpans(content: string): string {
  return content
    .replace(/(?:^|\n)(?:```|~~~)[^\n]*\n[\s\S]*?\n(?:```|~~~)(?:\n|$)/g, "\n")
    .replace(/`[^`\n]+`/g, "");
}

function extractMarkdownLinks(content: string): string[] {
  const links: string[] = [];
  const referenceDefinitions = new Map<string, string>();
  const sanitizedContent = stripCodeBlocksAndSpans(content);

  for (const match of sanitizedContent.matchAll(referenceDefinitionPattern)) {
    const label = normalizeReferenceLabel(match[1]);
    const target = cleanReferenceTarget(match[2]);
    if (label && target && !referenceDefinitions.has(label)) {
      referenceDefinitions.set(label, target);
    }
  }

  for (const match of sanitizedContent.matchAll(inlineLinkPattern)) {
    addUniqueLink(links, match[2]);
  }

  for (const match of sanitizedContent.matchAll(referenceLinkPattern)) {
    const target = referenceDefinitions.get(normalizeReferenceLabel(match[2]));
    if (target) {
      addUniqueLink(links, target);
    }
  }

  return links;
}

function addUniqueLink(links: string[], target: string | undefined): void {
  if (!target) {
    return;
  }
  const cleanTarget = target.trim();
  if (cleanTarget.length === 0 || links.includes(cleanTarget)) {
    return;
  }
  if (/[[\]{}^$]/.test(cleanTarget)) {
    return;
  }
  links.push(cleanTarget);
}

function normalizeReferenceLabel(label: string | undefined): string {
  return label?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function cleanReferenceTarget(target: string | undefined): string {
  if (!target) {
    return "";
  }
  return target.trim().replace(/^<(.+)>$/, "$1");
}
