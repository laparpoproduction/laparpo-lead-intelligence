const crmMutationPatterns = [
  /\b(?:create|update)\s+(?:(?:a|an|the|this)\s+)?(?:lead|company|opportunity)\b/iu,
  /\bset\s+(?:(?:a|an|the|this)\s+)?(?:lead|company|opportunity)(?:['’]s)?\s+(?:status|stage)\s+(?:to|as)\b/iu,
  /\bset\s+(?:the\s+)?(?:status|stage)\s+of\s+(?:(?:a|an|the|this)\s+)?(?:lead|company|opportunity)\s+(?:to|as)\b/iu,
  /\bmark\s+(?:(?:a|an|the|this)\s+)?(?:lead|company|opportunity)(?:['’]s)?(?:\s+(?:status|stage))?\s+(?:as\s+)?(?:won|lost|qualified|disqualified|inactive|active)\b/iu,
];

const contactName = String.raw`[\p{L}\p{M}][\p{L}\p{M}'’.-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}'’.-]*){0,5}`;
const phoneDestination = String.raw`(?:\+?\d[\d().\s-]{5,}\d)`;
const emailDestination = String.raw`(?:[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9.-]+)`;

const directContactPatterns = [
  new RegExp(
    String.raw`\bcontact\s+${contactName}\s+(?:at|on|via)\s+(?:${phoneDestination}|${emailDestination})`,
    "iu",
  ),
  new RegExp(
    String.raw`\bsend\s+(?:a\s+)?whatsapp(?:\s+message)?\s+to\s+${contactName}\b`,
    "iu",
  ),
];

const networkLocationPatterns = [
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s]+/iu,
  /\b(?:mailto|javascript|data|file):[^\s]*/iu,
  /\bwww\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})(?::\d{1,5})?(?:[/?#][^\s]*)?/iu,
  /\b[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})\b/iu,
  /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:[/?#][^\s]*)?/u,
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})(?::\d{1,5})?(?:[/?#][^\s]*)?/iu,
];

const externalVerificationPatterns = [
  /\b(?:i|we)\s+(?:visited|browsed|inspected|checked|verified|opened|researched)\s+(?:the\s+)?(?:website|url|link|page|social[- ]media|company)\b/iu,
  /\b(?:the\s+)?(?:website|url|link|page|social[- ]media(?:\s+presence)?)\s+(?:was|were|is|are|has\s+been|have\s+been)\s+(?:(?:independently|externally)\s+)?(?:verified|checked|inspected|browsed|visited|opened)\b/iu,
  /\b(?:external|online|independent)\s+(?:research|verification)\s+(?:confirms?|shows?|indicates?|establishes?|verifies?|found)\b/iu,
];

export function containsDirectCrmOrContactCommand(value: string): boolean {
  return [...crmMutationPatterns, ...directContactPatterns].some((pattern) =>
    pattern.test(value),
  );
}

export function containsGeneratedNetworkLocation(value: string): boolean {
  return networkLocationPatterns.some((pattern) => pattern.test(value));
}

export function containsExternalVerificationClaim(value: string): boolean {
  return externalVerificationPatterns.some((pattern) => pattern.test(value));
}
