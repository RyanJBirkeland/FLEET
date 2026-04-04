const RESEARCH_PATTERNS = [/research|search|find|look for|grep|where is|which file|show me/i]

export function isResearchQuery(text: string): boolean {
  return RESEARCH_PATTERNS.some((p) => p.test(text))
}

export function extractSearchTerms(text: string): string {
  return text
    .replace(
      /^(research|search|find|look for|grep|where is|which file|show me)\s*(the\s+)?(codebase\s+)?(for\s+)?/i,
      ''
    )
    .trim()
}
