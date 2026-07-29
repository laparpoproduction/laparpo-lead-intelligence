import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  cookies: vi.fn(),
  getPublicEnv: vi.fn(),
  getServerEnv: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));
vi.mock("@/lib/env", () => ({
  getPublicEnv: mocks.getPublicEnv,
  getServerEnv: mocks.getServerEnv,
}));

import { createClient } from "./server";
import type { MutationRequest } from "@/lib/mutation-audit";

const request: MutationRequest = {
  requestId: "11111111-1111-4111-8111-111111111111",
  operation: "mark_opportunity_won",
  resourceType: "opportunity",
  issuedAt: 1785321000,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  });
  mocks.getPublicEnv.mockReturnValue({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  });
  mocks.getServerEnv.mockReturnValue({
    MUTATION_AUDIT_CORRELATION_SECRET:
      "test-mutation-audit-correlation-secret-32",
  });
  mocks.createServerClient.mockReturnValue({ client: true });
});

describe("server Supabase mutation correlation", () => {
  it("places the signed server request context in global PostgREST headers", async () => {
    await createClient({ mutationRequest: request });

    expect(mocks.createServerClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "publishable-key",
      expect.objectContaining({
        global: {
          headers: expect.objectContaining({
            "x-laparpo-request-id": request.requestId,
            "x-laparpo-request-operation": request.operation,
            "x-laparpo-request-issued-at": String(request.issuedAt),
            "x-laparpo-request-signature": expect.stringMatching(
              /^[0-9a-f]{64}$/,
            ),
          }),
        },
      }),
    );
  });

  it("does not add mutation headers or load the secret for ordinary reads", async () => {
    await createClient();

    expect(mocks.getServerEnv).not.toHaveBeenCalled();
    expect(mocks.createServerClient.mock.calls[0]?.[2]).not.toHaveProperty(
      "global",
    );
  });
});
