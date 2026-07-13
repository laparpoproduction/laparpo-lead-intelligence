import { normalizePublicPhone } from "@/lib/companies/duplicate";

export type ContactDuplicateInput = {
  companyId?: string | null;
  fullName?: string | null;
  workEmail?: string | null;
  personalEmail?: string | null;
  publicPhone?: string | null;
  mobilePhone?: string | null;
  whatsappPhone?: string | null;
  linkedinUrl?: string | null;
};

export function normalizeContactName(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeContactNameKey(value?: string | null): string {
  return normalizeContactName(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-MY")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeContactEmail(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeContactPhone(value?: string | null): string {
  return normalizePublicPhone(value);
}

export function normalizeContactProfileUrl(value?: string | null): string {
  const candidate = value?.trim();
  if (!candidate) return "";

  try {
    const url = new URL(
      /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`,
    );
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.hash = "";
    url.search = "";
    return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname}`
      .replace(/[/?#]+$/, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function hasIntersection(left: string[], right: string[]): boolean {
  return left.some((value) => value && right.includes(value));
}

export function isLikelyDuplicateContact(
  left: ContactDuplicateInput,
  right: ContactDuplicateInput,
): boolean {
  const leftEmails = [left.workEmail, left.personalEmail]
    .map(normalizeContactEmail)
    .filter(Boolean);
  const rightEmails = [right.workEmail, right.personalEmail]
    .map(normalizeContactEmail)
    .filter(Boolean);
  if (hasIntersection(leftEmails, rightEmails)) return true;

  const leftLinkedIn = normalizeContactProfileUrl(left.linkedinUrl);
  const rightLinkedIn = normalizeContactProfileUrl(right.linkedinUrl);
  if (leftLinkedIn && leftLinkedIn === rightLinkedIn) return true;

  const leftWhatsApp = normalizeContactPhone(left.whatsappPhone);
  const rightWhatsApp = normalizeContactPhone(right.whatsappPhone);
  if (leftWhatsApp && leftWhatsApp === rightWhatsApp) return true;

  const leftName = normalizeContactNameKey(left.fullName);
  const rightName = normalizeContactNameKey(right.fullName);
  if (!leftName || leftName !== rightName) return false;

  if (left.companyId && left.companyId === right.companyId) return true;

  const leftPublicPhone = normalizeContactPhone(left.publicPhone);
  const rightPublicPhone = normalizeContactPhone(right.publicPhone);
  if (leftPublicPhone && leftPublicPhone === rightPublicPhone) return true;

  const leftMobilePhone = normalizeContactPhone(left.mobilePhone);
  const rightMobilePhone = normalizeContactPhone(right.mobilePhone);
  return Boolean(leftMobilePhone && leftMobilePhone === rightMobilePhone);
}
