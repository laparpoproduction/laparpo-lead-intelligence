export type CompanyFingerprintInput = {
  companyName: string;
  websiteUrl?: string | null;
  publicPhone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

export type CompanyFingerprintParts = {
  name: string;
  domain: string;
  phone: string;
  location: string;
};

const legalSuffixPattern =
  /\b(?:sendirian\s+berhad|sdn\.?\s*bhd\.?|berhad|bhd\.?|limited|ltd\.?|llc|plc)\s*$/i;

function normalizeWords(value?: string | null): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeCompanyName(value: string): string {
  return normalizeWords(value.replace(legalSuffixPattern, ""));
}

export function normalizeWebsiteDomain(value?: string | null): string {
  const candidate = value?.trim();
  if (!candidate) return "";

  try {
    const url = new URL(
      candidate.startsWith("http://") || candidate.startsWith("https://")
        ? candidate
        : `https://${candidate}`,
    );
    return url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return "";
  }
}

export function normalizePublicPhone(value?: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0060")) return digits.slice(2);
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  return digits;
}

export function buildCompanyFingerprintParts(
  company: CompanyFingerprintInput,
): CompanyFingerprintParts {
  const city = normalizeWords(company.city);
  const state = normalizeWords(company.state);
  const country = normalizeWords(company.country);

  return {
    name: normalizeCompanyName(company.companyName),
    domain: normalizeWebsiteDomain(company.websiteUrl),
    phone: normalizePublicPhone(company.publicPhone),
    location: city && state ? [city, state, country].filter(Boolean).join("|") : "",
  };
}

export function buildCompanyFingerprint(company: CompanyFingerprintInput): string {
  const parts = buildCompanyFingerprintParts(company);
  return [parts.name, parts.domain, parts.phone, parts.location].join("::");
}

export function isLikelyDuplicateCompany(
  left: CompanyFingerprintInput,
  right: CompanyFingerprintInput,
): boolean {
  const a = buildCompanyFingerprintParts(left);
  const b = buildCompanyFingerprintParts(right);

  if (!a.name || a.name !== b.name) return false;

  const corroboratingMatches = [
    Boolean(a.domain && a.domain === b.domain),
    Boolean(a.phone && a.phone === b.phone),
    Boolean(a.location && a.location === b.location),
  ];

  return corroboratingMatches.some(Boolean);
}
