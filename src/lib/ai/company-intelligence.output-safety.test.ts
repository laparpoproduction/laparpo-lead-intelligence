import { describe, expect, it } from "vitest";
import {
  containsDirectCrmOrContactCommand,
  containsExternalVerificationClaim,
  containsGeneratedNetworkLocation,
} from "./company-intelligence.output-safety";
import { companyIntelligenceSchema } from "./company-intelligence.schema";
import { validCompanyIntelligence } from "./company-intelligence.test-fixtures";

const directCommands = [
  "Create an Opportunity now.",
  "Create the Opportunity now.",
  "Create this Lead.",
  "Update the Company now.",
  "Update this Company.",
  "Set the Lead status to qualified.",
  "Set this Lead status to qualified.",
  "Mark this Opportunity won.",
  "Mark the Opportunity lost.",
  "Contact John at 0123456789.",
  "Contact John Doe at 0123456789.",
  "Contact Jane Smith at jane@example.test.",
  "Send a WhatsApp to John Doe.",
  "cReAtE a Company now!",
  "SET THE OPPORTUNITY STAGE TO won.",
];

const networkLocations = [
  "https://example.com/path",
  "http://example.test/path",
  "www.example.com",
  "example.com/path",
  "example.dev/path",
  "example.app/path",
  "subdomain.example.co.uk/path",
  "192.0.2.1/path",
  "https://192.0.2.1/path",
  "ftp://example.com/file",
  "mailto:user@example.com",
  "javascript:alert(1)",
  "data:text/html,<p>example</p>",
  "file:///tmp/example",
  "See EXAMPLE.DEV/path, for details.",
];

const verificationClaims = [
  "I visited the website and confirmed the branch list.",
  "We inspected the URL before preparing this result.",
  "The website was verified yesterday.",
  "The social-media presence was verified.",
  "External research confirms regional leadership.",
];

function outputWithSummary(summary: string) {
  return { ...validCompanyIntelligence, summary };
}

describe("Company intelligence centralized output safety", () => {
  it.each(directCommands)("detects direct CRM/contact command: %s", (value) => {
    expect(containsDirectCrmOrContactCommand(value)).toBe(true);
  });

  it.each(networkLocations)("detects generated network location: %s", (value) => {
    expect(containsGeneratedNetworkLocation(value)).toBe(true);
  });

  it.each(verificationClaims)("detects external verification claim: %s", (value) => {
    expect(containsExternalVerificationClaim(value)).toBe(true);
  });

  it.each([...directCommands, ...networkLocations, ...verificationClaims])(
    "rejects unsafe prose through the production Zod schema: %s",
    (value) => {
      expect(companyIntelligenceSchema.safeParse(outputWithSummary(value)).success).toBe(
        false,
      );
    },
  );

  it.each([
    "The supplied Company metadata describes a hospitality business.",
    "Consider reviewing the Company’s public positioning.",
    "The Company record was updated previously.",
    "The supplied description mentions customer contact channels.",
  ])("accepts legitimate analytical prose: %s", (value) => {
    expect(companyIntelligenceSchema.safeParse(outputWithSummary(value)).success).toBe(
      true,
    );
  });
});
