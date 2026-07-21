import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import type { LeadService } from "@/lib/leads/lead.service";
import { LeadDuplicateError, LeadNotFoundError, LeadPermissionError } from "@/lib/leads/lead.service";
import { LeadMutationAuthError, createLeadMutationContext } from "@/lib/leads/lead.server";
import type { LeadActor } from "@/lib/leads/lead.types";
import { archiveLeadAction, createLeadAction, restoreLeadAction, updateLeadAction } from "./actions";
import { initialLeadFormState } from "./form-state";
import { verifyLeadConfirmationToken } from "@/lib/leads/lead-confirmation";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/leads/lead-confirmation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/leads/lead-confirmation")>();
  return {
    ...actual,
    createLeadConfirmationToken: vi.fn(actual.createLeadConfirmationToken),
    verifyLeadConfirmationToken: vi.fn(actual.verifyLeadConfirmationToken),
  };
});
vi.mock("@/lib/leads/lead.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/leads/lead.server")>();
  return { ...actual, createLeadMutationContext: vi.fn() };
});

const actor: LeadActor = {
  userId: "44444444-4444-4444-8444-444444444444",
  role: "sales_manager",
  isActive: true,
};

type MutationService = Pick<LeadService, "create" | "update" | "softDelete" | "restore" | "createConfirmedDuplicate" | "updateConfirmedDuplicate">;

let service: MutationService;

function createForm(): FormData {
  const form = new FormData();
  form.set("title", "KFC Ramadan");
  form.set("sourceType", "company_website");
  form.set("discoveredAt", "2026-06-01T00:00:00.000Z");
  return form;
}

function updateForm(): FormData {
  const form = new FormData();
  form.set("leadId", "11111111-1111-4111-8111-111111111111");
  form.set("title", "Updated title");
  return form;
}

function archiveForm(): FormData {
  const form = new FormData();
  form.set("leadId", "11111111-1111-4111-8111-111111111111");
  form.set("confirm", "true");
  return form;
}

beforeEach(() => {
  process.env.COMPANY_DUPLICATE_CONFIRMATION_SECRET = "test-company-confirmation-secret-32-characters";
  process.env.CONTACT_DUPLICATE_CONFIRMATION_SECRET = "test-contact-confirmation-secret-32-characters";
  process.env.LEAD_DUPLICATE_CONFIRMATION_SECRET = "test-lead-confirmation-secret-32-characters";
  service = {
    create: vi.fn().mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" }),
    update: vi.fn().mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" }),
    createConfirmedDuplicate: vi.fn().mockResolvedValue({ leadId: "11111111-1111-4111-8111-111111111111" }),
    updateConfirmedDuplicate: vi.fn().mockResolvedValue({ leadId: "11111111-1111-4111-8111-111111111111" }),
    softDelete: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(createLeadMutationContext).mockReset().mockResolvedValue({ actor, service: service as LeadService });
  vi.mocked(revalidatePath).mockReset();
});

describe("Leads server actions", () => {
  it("returns field-level validation errors", async () => {
    const form = createForm();
    form.delete("title");

    const state = await createLeadAction(initialLeadFormState, form);
    expect(state.status).toBe("validation_error");
    expect(state.fieldErrors?.title).toBeDefined();
    expect(service.create).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated and inactive users before parsing mutations", async () => {
    vi.mocked(createLeadMutationContext).mockRejectedValueOnce(new LeadMutationAuthError("unauthenticated"));
    await expect(createLeadAction(initialLeadFormState, new FormData())).resolves.toMatchObject({
      status: "permission_error",
      message: expect.stringContaining("Sign in"),
    });

    vi.mocked(createLeadMutationContext).mockRejectedValueOnce(new LeadMutationAuthError("inactive"));
    await expect(archiveLeadAction(initialLeadFormState, new FormData())).resolves.toMatchObject({
      status: "permission_error",
      message: expect.stringContaining("inactive"),
    });
  });

  it("creates a lead and revalidates the list route", async () => {
    const state = await createLeadAction(initialLeadFormState, createForm());
    expect(state).toMatchObject({ status: "success", leadId: "11111111-1111-4111-8111-111111111111" });
    expect(revalidatePath).toHaveBeenCalledWith("/leads");
  });

  it("returns a duplicate warning on the first create attempt", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(new LeadDuplicateError(["11111111-1111-4111-8111-111111111111"]));
    const state = await createLeadAction(initialLeadFormState, createForm());
    expect(state).toMatchObject({ status: "duplicate_warning", duplicateCandidateIds: ["11111111-1111-4111-8111-111111111111"] });
  });

  it("updates a lead and revalidates list and detail routes", async () => {
    const state = await updateLeadAction(initialLeadFormState, updateForm());
    expect(state).toMatchObject({ status: "success", leadId: "11111111-1111-4111-8111-111111111111" });
    expect(revalidatePath).toHaveBeenCalledWith("/leads");
    expect(revalidatePath).toHaveBeenCalledWith("/leads/11111111-1111-4111-8111-111111111111");
  });

  it("handles confirmation flow for create and update with invalid or tampered tokens", async () => {
    const invalidForm = createForm();
    invalidForm.set("confirmationToken", "token");
    vi.mocked(verifyLeadConfirmationToken).mockReturnValueOnce(null);
    const invalid = await createLeadAction(initialLeadFormState, invalidForm);
    expect(invalid.status).toBe("validation_error");

    const confirmedForm = createForm();
    confirmedForm.set("confirmationToken", "token");
    vi.mocked(verifyLeadConfirmationToken).mockReturnValueOnce({
      confirmationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      submissionHash: "a".repeat(64),
      actorId: actor.userId,
      operation: "create",
    });
    const confirmed = await createLeadAction(initialLeadFormState, confirmedForm);
    expect(confirmed.status).toBe("success");
    expect(service.createConfirmedDuplicate).toHaveBeenCalled();
  });

  it("returns permission and not-found states for archive and restore", async () => {
    vi.mocked(service.softDelete).mockRejectedValueOnce(new LeadPermissionError());
    await expect(archiveLeadAction(initialLeadFormState, archiveForm())).resolves.toMatchObject({ status: "permission_error" });

    vi.mocked(service.restore).mockRejectedValueOnce(new LeadNotFoundError());
    await expect(restoreLeadAction(initialLeadFormState, archiveForm())).resolves.toMatchObject({ status: "not_found" });
  });

  it("archives and restores leads with the correct redirect targets", async () => {
    const archived = await archiveLeadAction(initialLeadFormState, archiveForm());
    expect(archived).toMatchObject({ status: "success", redirectTo: "/leads" });

    const restored = await restoreLeadAction(initialLeadFormState, archiveForm());
    expect(restored).toMatchObject({ status: "success", redirectTo: "/leads" });
  });
});
