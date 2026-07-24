import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import type { LeadActivityService } from "@/lib/lead-activities/lead-activity.service";
import {
  LeadActivityNotFoundError,
  LeadActivityPermissionError,
} from "@/lib/lead-activities/lead-activity.service";
import {
  LeadActivityMutationAuthError,
  createLeadActivityMutationContext,
} from "@/lib/lead-activities/lead-activity.server";
import type {
  LeadActivity,
  LeadActivityActor,
} from "@/lib/lead-activities/lead-activity.types";
import {
  archiveLeadActivityAction,
  createLeadActivityAction,
  restoreLeadActivityAction,
  updateLeadActivityAction,
} from "./actions";
import { initialLeadActivityFormState } from "./form-state";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/lead-activities/lead-activity.server", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/lead-activities/lead-activity.server")
    >();
  return { ...actual, createLeadActivityMutationContext: vi.fn() };
});

const actorId = "11111111-1111-4111-8111-111111111111";
const activityId = "22222222-2222-4222-8222-222222222222";
const leadId = "33333333-3333-4333-8333-333333333333";
const otherId = "44444444-4444-4444-8444-444444444444";

const actor: LeadActivityActor = {
  userId: actorId,
  role: "sales_manager",
  isActive: true,
};

const activity: LeadActivity = {
  id: activityId,
  leadId,
  activityType: "call",
  subject: "Discovery call",
  description: null,
  activityAt: "2026-07-24T01:00:00.000Z",
  nextFollowUpAt: null,
  outcome: null,
  createdBy: actorId,
  assignedTo: null,
  createdAt: "2026-07-24T01:01:00.000Z",
  updatedAt: "2026-07-24T01:01:00.000Z",
  deletedAt: null,
};

type MutationService = Pick<
  LeadActivityService,
  "create" | "getById" | "update" | "softDelete" | "restore"
>;

let service: MutationService;

function createForm(): FormData {
  const form = new FormData();
  form.set("leadId", leadId);
  form.set("activityType", "call");
  form.set("subject", "  Discovery call  ");
  form.set("activityAt", activity.activityAt);
  return form;
}

function updateForm(): FormData {
  const form = new FormData();
  form.set("activityId", activityId);
  form.set("outcome", "  Qualified  ");
  return form;
}

function mutationForm(): FormData {
  const form = new FormData();
  form.set("activityId", activityId);
  form.set("confirm", "true");
  return form;
}

beforeEach(() => {
  service = {
    create: vi.fn().mockResolvedValue(activity),
    getById: vi.fn().mockResolvedValue(activity),
    update: vi.fn().mockResolvedValue({ ...activity, outcome: "Qualified" }),
    softDelete: vi.fn().mockResolvedValue(activity),
    restore: vi.fn().mockResolvedValue(activity),
  };
  vi.mocked(createLeadActivityMutationContext)
    .mockReset()
    .mockResolvedValue({
      actor,
      service: service as LeadActivityService,
    });
  vi.mocked(revalidatePath).mockReset();
});

describe("Lead activity server actions", () => {
  it("creates a normalized activity and revalidates its Lead routes", async () => {
    const form = createForm();
    form.set("description", "   ");
    form.set("outcome", "");
    form.set("nextFollowUpAt", "");
    form.set("assignedTo", "");
    const state = await createLeadActivityAction(
      initialLeadActivityFormState,
      form,
    );

    expect(state).toMatchObject({
      status: "success",
      activityId,
      leadId,
    });
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Discovery call",
        description: null,
        outcome: null,
        nextFollowUpAt: null,
        assignedTo: null,
        leadId,
      }),
      actor,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/leads");
    expect(revalidatePath).toHaveBeenCalledWith(`/leads/${leadId}`);
  });

  it("returns create validation errors without calling the service", async () => {
    const form = createForm();
    form.set("activityType", "unknown");

    const state = await createLeadActivityAction(
      initialLeadActivityFormState,
      form,
    );

    expect(state.status).toBe("validation_error");
    expect(state.fieldErrors?.activityType).toBeDefined();
    expect(service.create).not.toHaveBeenCalled();
  });

  it("ignores forged authority, provenance and legacy relationship fields", async () => {
    const form = createForm();
    form.set("createdBy", otherId);
    form.set("role", "ceo_admin");
    form.set("userId", otherId);
    form.set("deletedAt", "2026-07-25T00:00:00.000Z");
    form.set("opportunityId", otherId);
    form.set("redirectTo", "https://attacker.example");

    await createLeadActivityAction(initialLeadActivityFormState, form);

    const submitted = vi.mocked(service.create).mock.calls[0]?.[0];
    expect(submitted).not.toHaveProperty("createdBy");
    expect(submitted).not.toHaveProperty("role");
    expect(submitted).not.toHaveProperty("userId");
    expect(submitted).not.toHaveProperty("deletedAt");
    expect(submitted).not.toHaveProperty("opportunityId");
    expect(submitted).not.toHaveProperty("redirectTo");
    expect(service.create).toHaveBeenCalledWith(expect.any(Object), actor);
  });

  it("maps unauthenticated and inactive actors before parsing input", async () => {
    vi.mocked(createLeadActivityMutationContext).mockRejectedValueOnce(
      new LeadActivityMutationAuthError("unauthenticated"),
    );
    await expect(
      createLeadActivityAction(
        initialLeadActivityFormState,
        new FormData(),
      ),
    ).resolves.toMatchObject({
      status: "permission_error",
      code: "unauthenticated",
    });

    vi.mocked(createLeadActivityMutationContext).mockRejectedValueOnce(
      new LeadActivityMutationAuthError("inactive"),
    );
    await expect(
      archiveLeadActivityAction(
        initialLeadActivityFormState,
        new FormData(),
      ),
    ).resolves.toMatchObject({
      status: "permission_error",
      code: "inactive",
    });
  });

  it("maps unauthorized create and representative assignment restrictions", async () => {
    vi.mocked(service.create)
      .mockRejectedValueOnce(new LeadActivityPermissionError())
      .mockRejectedValueOnce(new LeadActivityPermissionError());

    await expect(
      createLeadActivityAction(
        initialLeadActivityFormState,
        createForm(),
      ),
    ).resolves.toMatchObject({
      status: "permission_error",
      code: "forbidden",
    });

    const assigned = createForm();
    assigned.set("assignedTo", otherId);
    await expect(
      createLeadActivityAction(initialLeadActivityFormState, assigned),
    ).resolves.toMatchObject({
      status: "permission_error",
      code: "forbidden",
    });
  });

  it("updates only mutable allow-listed fields", async () => {
    const form = updateForm();
    form.set("leadId", otherId);
    form.set("createdBy", otherId);

    const state = await updateLeadActivityAction(
      initialLeadActivityFormState,
      form,
    );

    expect(state).toMatchObject({ status: "success", activityId, leadId });
    expect(service.update).toHaveBeenCalledWith(
      activityId,
      { outcome: "Qualified" },
      actor,
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/leads/${leadId}`);
  });

  it("returns update validation and authorization states", async () => {
    const invalid = updateForm();
    invalid.set("activityId", "not-a-uuid");
    await expect(
      updateLeadActivityAction(initialLeadActivityFormState, invalid),
    ).resolves.toMatchObject({ status: "validation_error" });
    expect(service.update).not.toHaveBeenCalled();

    vi.mocked(service.update).mockRejectedValueOnce(
      new LeadActivityPermissionError(),
    );
    await expect(
      updateLeadActivityAction(
        initialLeadActivityFormState,
        updateForm(),
      ),
    ).resolves.toMatchObject({ status: "permission_error" });
  });

  it("archives through softDelete only and revalidates archived routes", async () => {
    const state = await archiveLeadActivityAction(
      initialLeadActivityFormState,
      mutationForm(),
    );

    expect(service.softDelete).toHaveBeenCalledWith(activityId, actor);
    expect(state).toMatchObject({ status: "success", activityId, leadId });
    expect(revalidatePath).toHaveBeenCalledWith("/leads/archived");
    expect(service).not.toHaveProperty("hardDelete");
  });

  it("denies unauthorized archive and guessed activity IDs", async () => {
    vi.mocked(service.softDelete)
      .mockRejectedValueOnce(new LeadActivityPermissionError())
      .mockRejectedValueOnce(new LeadActivityNotFoundError());

    await expect(
      archiveLeadActivityAction(
        initialLeadActivityFormState,
        mutationForm(),
      ),
    ).resolves.toMatchObject({ status: "permission_error" });
    await expect(
      archiveLeadActivityAction(
        initialLeadActivityFormState,
        mutationForm(),
      ),
    ).resolves.toMatchObject({ status: "not_found" });
    expect(service.softDelete).toHaveBeenCalledTimes(2);
  });

  it("restores through the management service path and revalidates routes", async () => {
    const state = await restoreLeadActivityAction(
      initialLeadActivityFormState,
      mutationForm(),
    );

    expect(service.restore).toHaveBeenCalledWith(activityId, actor);
    expect(state).toMatchObject({ status: "success", activityId, leadId });
    expect(revalidatePath).toHaveBeenCalledWith("/leads/archived");
  });

  it("preserves representative restore and archived-parent denials", async () => {
    vi.mocked(service.restore)
      .mockRejectedValueOnce(new LeadActivityPermissionError())
      .mockRejectedValueOnce(new LeadActivityPermissionError());

    await expect(
      restoreLeadActivityAction(
        initialLeadActivityFormState,
        mutationForm(),
      ),
    ).resolves.toMatchObject({ status: "permission_error" });
    await expect(
      restoreLeadActivityAction(
        initialLeadActivityFormState,
        mutationForm(),
      ),
    ).resolves.toMatchObject({ status: "permission_error" });
  });

  it("maps not-found and unexpected service errors without leaking details", async () => {
    vi.mocked(service.update).mockRejectedValueOnce(
      new LeadActivityNotFoundError(),
    );
    await expect(
      updateLeadActivityAction(
        initialLeadActivityFormState,
        updateForm(),
      ),
    ).resolves.toMatchObject({
      status: "not_found",
      message: expect.not.stringContaining("database"),
    });

    vi.mocked(service.create).mockRejectedValueOnce(
      new Error("postgres password=secret relation=lead_activities"),
    );
    const state = await createLeadActivityAction(
      initialLeadActivityFormState,
      createForm(),
    );
    expect(state).toMatchObject({ status: "error", code: "unexpected" });
    expect(state.message).not.toContain("postgres");
    expect(state.message).not.toContain("secret");
  });
});
