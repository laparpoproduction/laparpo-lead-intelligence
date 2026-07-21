import { createHash } from "node:crypto";

export type LeadDuplicateInput = {
  title: string;
  companyId?: string | null;
  primaryContactId?: string | null;
  serviceInterest?: string | null;
  sourceUrl?: string | null;
  sourceCampaign?: string | null;
  sourceSignalId?: string | null;
};

export function normalizeLeadText(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  return normalized || null;
}

export function normalizeLeadName(value: string | null | undefined): string | null {
  return normalizeLeadText(value);
}

export function normalizeLeadKey(value: string | null | undefined): string | null {
  const normalized = normalizeLeadText(value)
    ?.toLocaleLowerCase("en")
    .replaceAll("&", " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return normalized || null;
}

export function normalizeLeadCurrency(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeLeadText(value)?.toUpperCase() ?? null;
  return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

export function normalizeLeadSourceUrl(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeLeadText(value)
    ?.replace(/#.*$/, "")
    .toLocaleLowerCase("en");
  return normalized || null;
}

function normalizedId(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("en") ?? "";
}

function evidence(input: LeadDuplicateInput) {
  return {
    title: normalizeLeadKey(input.title),
    companyId: normalizedId(input.companyId),
    primaryContactId: normalizedId(input.primaryContactId),
    serviceInterest: normalizeLeadKey(input.serviceInterest),
    sourceUrl: normalizeLeadSourceUrl(input.sourceUrl),
    sourceCampaign: normalizeLeadKey(input.sourceCampaign),
    sourceSignalId: normalizedId(input.sourceSignalId),
  };
}

export function buildLeadFingerprint(input: LeadDuplicateInput): string | null {
  const normalized = evidence(input);
  if (!normalized.title) return null;
  const corroborating = [
    normalized.companyId,
    normalized.primaryContactId,
    normalized.serviceInterest,
    normalized.sourceUrl,
    normalized.sourceCampaign,
    normalized.sourceSignalId,
  ];
  if (!corroborating.some(Boolean)) return null;

  return createHash("md5")
    .update(
      [
        normalized.title,
        normalized.companyId,
        normalized.primaryContactId,
        normalized.serviceInterest ?? "",
        normalized.sourceUrl ?? "",
        normalized.sourceCampaign ?? "",
        normalized.sourceSignalId,
      ].join("|"),
    )
    .digest("hex");
}

export function isLikelyDuplicateLead(
  left: LeadDuplicateInput,
  right: LeadDuplicateInput,
): boolean {
  const a = evidence(left);
  const b = evidence(right);
  const sameCompany = Boolean(a.companyId && a.companyId === b.companyId);
  const sameContact = Boolean(
    a.primaryContactId && a.primaryContactId === b.primaryContactId,
  );
  const sameTitle = Boolean(a.title && a.title === b.title);
  const sameService = Boolean(
    a.serviceInterest && a.serviceInterest === b.serviceInterest,
  );
  const sameSource = Boolean(a.sourceUrl && a.sourceUrl === b.sourceUrl);
  const sameCampaign = Boolean(
    a.sourceCampaign && a.sourceCampaign === b.sourceCampaign,
  );
  const differentCampaign = Boolean(
    a.sourceCampaign &&
      b.sourceCampaign &&
      a.sourceCampaign !== b.sourceCampaign,
  );
  const sameSignal = Boolean(
    a.sourceSignalId && a.sourceSignalId === b.sourceSignalId,
  );

  if (differentCampaign && !sameSource && !sameSignal && !sameContact) {
    return false;
  }

  return (
    sameSignal ||
    (sameSource && (sameCompany || sameTitle)) ||
    (sameCompany && sameCampaign) ||
    (sameCompany && sameTitle && (sameService || sameCampaign || sameContact))
  );
}
