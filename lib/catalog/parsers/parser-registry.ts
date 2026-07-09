import { beckettParser } from "./beckett-parser.ts";
import { cardboardConnectionParser } from "./cardboardconnection-parser.ts";
import { normalizeCandidateRows, type ChecklistParserContext, type ParsedChecklistResult } from "./validation.ts";

export type ChecklistProviderParser = {
  provider: string;
  matches: (sourceUrl: string, sourceName?: string) => boolean;
  parse: (html: string, context: ChecklistParserContext) => ParsedChecklistResult;
};

const parserRegistry: ChecklistProviderParser[] = [beckettParser, cardboardConnectionParser];

export function registerChecklistParser(parser: ChecklistProviderParser) {
  parserRegistry.push(parser);
}

export function detectChecklistProvider(sourceUrl: string, sourceName?: string) {
  return parserRegistry.find((parser) => parser.matches(sourceUrl, sourceName)) || null;
}

export function parseChecklistHtml(html: string, context: ChecklistParserContext) {
  const parser = detectChecklistProvider(context.sourceUrl, context.sourceName);

  if (!parser) {
    return normalizeCandidateRows("Unknown", context, []);
  }

  return parser.parse(html, context);
}
