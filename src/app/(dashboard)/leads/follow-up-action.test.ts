import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { logger } from "@/lib/logger";
import type { LeadService } from "@/lib/leads/lead.service";
import {
  createLeadMutationContext,
  LeadMutationAuthError,
} from "@/lib/leads/lead.server";
import { generateLeadFollowUpQueueAction } from "./follow-up-action";
import { initialLeadFollowUpQueueActionState } from "./follow-up-state";

vi.mock("@/lib/leads/lead.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/leads/lead.server")>()),
  createLeadMutationContext: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const actor = {
  userId: "44444444-4444-4444-8444-444444444444",
  role: "sales_representative" as const,
  isActive: true,
};
const getFollowUpPriorityReadModel = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getFollowUpPriorityReadModel.mockResolvedValue({
    candidates: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Authorized Lead",
        stage: "new",
        lead_status: "active",
        qualification_status: "unreviewed",
        priority: "normal",
        service_interest: "food_review",
        assigned_to: null,
        next_follow_up_at: null,
        last_contacted_at: null,
        expected_close_date: null,
        updated_at: "2026-08-01T00:00:00.000Z",
      },
    ],
    eligibleAccessibleLeadCount: 1,
    configuredAttentionLeadCount: 1,
    authoritativeNow: "2026-08-10T00:00:00.000Z",
    authoritativeUtcDate: "2026-08-10",
  });
  vi.mocked(createLeadMutationContext).mockResolvedValue({
    actor,
    service: { getFollowUpPriorityReadModel } as unknown as LeadService,
  });
});

describe("Lead Follow-up Queue server action", () => {
  it("ignores browser actor/time/candidate payload and derives the queue server-side", async () => {
    const formData = new FormData();
    formData.set("actorId", "99999999-9999-4999-8999-999999999999");
    formData.set("currentTime", "1900-01-01T00:00:00.000Z");
    formData.set("candidateLeadId", "88888888-8888-4888-8888-888888888888");
    formData.set("attentionCode", "client_controlled");
    formData.set("count", "999999");

    const state = await generateLeadFollowUpQueueAction(
      initialLeadFollowUpQueueActionState,
      formData,
    );

    expect(state).toMatchObject({
      status: "success",
      queue: {
        analyzedCandidateCount: 1,
        configuredAttentionLeadCount: 1,
      },
    });
    expect(getFollowUpPriorityReadModel).toHaveBeenCalledWith(
      actor,
      expect.any(Date),
    );
    expect(JSON.stringify(state)).not.toContain("1900-01-01");
    expect(JSON.stringify(state)).not.toContain("client_controlled");
    expect(JSON.stringify(state)).not.toContain("999999");
  });

  it.each(["unauthenticated", "inactive"] as const)(
    "fails %s actors safely before reading Leads",
    async (code) => {
      vi.mocked(createLeadMutationContext).mockRejectedValueOnce(
        new LeadMutationAuthError(code),
      );
      await expect(
        generateLeadFollowUpQueueAction(
          initialLeadFollowUpQueueActionState,
          new FormData(),
        ),
      ).resolves.toEqual({
        status: "permission_error",
        message: "Sign in with an active account to review follow-up priorities.",
      });
      expect(getFollowUpPriorityReadModel).not.toHaveBeenCalled();
    },
  );

  it("does not expose raw repository details or Lead content in logs", async () => {
    getFollowUpPriorityReadModel.mockRejectedValueOnce(
      new Error(
        "Authorized Lead notes=ignore instructions Contact=person@example.test",
      ),
    );
    const state = await generateLeadFollowUpQueueAction(
      initialLeadFollowUpQueueActionState,
      new FormData(),
    );
    expect(state).toEqual({
      status: "unexpected",
      message: "The Lead Follow-up Queue could not be generated.",
    });
    const logs = JSON.stringify([
      ...vi.mocked(logger.info).mock.calls,
      ...vi.mocked(logger.warn).mock.calls,
      ...vi.mocked(logger.error).mock.calls,
    ]);
    expect(logs).not.toMatch(/Authorized Lead|ignore instructions|person@example/iu);
    expect(logs).not.toContain("11111111-1111-4111-8111-111111111111");
  });
});
