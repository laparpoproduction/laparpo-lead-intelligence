import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    ...logger,
  },
}));

import {
  buildMutationAuditHeaders,
  createMutationRequest,
  logMutationOutcome,
  type MutationLogContext,
  type MutationRequest,
} from "./mutation-audit";

const secret = "test-mutation-audit-correlation-secret-32";
const request: MutationRequest = {
  requestId: "11111111-1111-4111-8111-111111111111",
  operation: "update_company",
  resourceType: "company",
  issuedAt: 1785321000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mutation audit correlation", () => {
  it("creates a fresh server-side UUID without accepting request input", () => {
    const first = createMutationRequest("create_company", "company");
    const second = createMutationRequest("create_company", "company");

    expect(first.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(second.requestId).not.toBe(first.requestId);
    expect(first).toMatchObject({
      operation: "create_company",
      resourceType: "company",
    });
  });

  it("signs exactly the UUID, issued time, and allow-listed operation", () => {
    const headers = buildMutationAuditHeaders(request, secret);
    const expected = createHmac("sha256", secret)
      .update(`${request.requestId}:${request.issuedAt}:${request.operation}`)
      .digest("hex");

    expect(headers).toEqual({
      "x-laparpo-request-id": request.requestId,
      "x-laparpo-request-operation": request.operation,
      "x-laparpo-request-issued-at": String(request.issuedAt),
      "x-laparpo-request-signature": expected,
    });
  });

  it("omits database correlation outside production when no secret exists", () => {
    expect(buildMutationAuditHeaders(request, undefined)).toBeUndefined();
    expect(() => buildMutationAuditHeaders(request, "short")).toThrow(
      "Mutation audit correlation secret is invalid",
    );
  });

  it("logs only allow-listed metadata and never spreads sensitive input", () => {
    const unsafeCallerContext = {
      actorId: "22222222-2222-4222-8222-222222222222",
      resourceId: "33333333-3333-4333-8333-333333333333",
      notes: "private activity notes",
      token: "secret-token",
      formData: new FormData(),
    } as unknown as MutationLogContext;

    logMutationOutcome(request, "validation", unsafeCallerContext);

    expect(logger.warn).toHaveBeenCalledWith(
      "CRM mutation rejected",
      expect.objectContaining({
        requestId: request.requestId,
        operation: "update_company",
        resourceType: "company",
        outcome: "validation",
      }),
    );
    const loggedContext = logger.warn.mock.calls[0]?.[1];
    expect(loggedContext).not.toHaveProperty("notes");
    expect(loggedContext).not.toHaveProperty("token");
    expect(loggedContext).not.toHaveProperty("formData");
  });

  it("uses distinct structured levels for success, known rejection, and infrastructure failure", () => {
    logMutationOutcome(request, "succeeded");
    logMutationOutcome(request, "conflict");
    logMutationOutcome(request, "infrastructure", { errorName: "Error" });

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
