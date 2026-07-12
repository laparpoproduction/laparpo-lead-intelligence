import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import type { CompanyService } from "@/lib/companies/company.service";
import {
  CompanyDuplicateError,
  CompanyNotFoundError,
  CompanyPermissionError,
} from "@/lib/companies/company.service";
import {
  CompanyMutationAuthError,
  createCompanyMutationContext,
} from "@/lib/companies/company.server";
import type { CompanyActor } from "@/lib/companies/company.types";
import { companyFixture, companyId, userId } from "@/lib/companies/company.test-fixtures";
import {
  createCompanyAction,
  softDeleteCompanyAction,
  updateCompanyAction,
} from "./actions";
import { initialCompanyFormState } from "./form-state";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/companies/company.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/companies/company.server")>();
  return { ...actual, createCompanyMutationContext: vi.fn() };
});

const actor: CompanyActor = {
  userId,
  role: "sales_manager",
  isActive: true,
};

type MutationService = Pick<
  CompanyService,
  | "create"
  | "createConfirmedDuplicate"
  | "update"
  | "updateConfirmedDuplicate"
  | "softDelete"
>;

let service: MutationService;

function createForm(): FormData {
  const form = new FormData();
  form.set("legalName", companyFixture.legalName);
  form.set("displayName", companyFixture.displayName);
  form.set("companyType", companyFixture.companyType);
  form.set("websiteUrl", companyFixture.websiteUrl ?? "");
  form.set("sourceUrl", companyFixture.sourceUrl);
  form.set("sourceType", companyFixture.sourceType);
  return form;
}

function updateForm(): FormData {
  const form = new FormData();
  form.set("companyId", companyId);
  form.set("city", "Butterworth");
  return form;
}

function deleteForm(): FormData {
  const form = new FormData();
  form.set("companyId", companyId);
  form.set("confirm", "true");
  return form;
}

beforeEach(() => {
  process.env.COMPANY_DUPLICATE_CONFIRMATION_SECRET =
    "test-company-confirmation-secret-32-characters";
  service = {
    create: vi.fn().mockResolvedValue(companyFixture),
    createConfirmedDuplicate: vi.fn().mockResolvedValue({
      status: "applied",
      companyId,
      company: companyFixture,
    }),
    update: vi.fn().mockResolvedValue(companyFixture),
    updateConfirmedDuplicate: vi.fn().mockResolvedValue({
      status: "applied",
      companyId,
      company: companyFixture,
    }),
    softDelete: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(createCompanyMutationContext).mockReset().mockResolvedValue({
    actor,
    service: service as CompanyService,
  });
  vi.mocked(revalidatePath).mockReset();
});

describe("Companies server actions", () => {
  it("returns field-level validation errors", async () => {
    const form = createForm();
    form.delete("legalName");

    const state = await createCompanyAction(initialCompanyFormState, form);
    expect(state.status).toBe("validation_error");
    expect(state.fieldErrors?.legalName).toBeDefined();
    expect(service.create).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated and inactive users before parsing mutations", async () => {
    vi.mocked(createCompanyMutationContext).mockRejectedValueOnce(
      new CompanyMutationAuthError("unauthenticated"),
    );
    await expect(
      createCompanyAction(initialCompanyFormState, new FormData()),
    ).resolves.toMatchObject({ status: "permission_error", message: expect.stringContaining("Sign in") });

    vi.mocked(createCompanyMutationContext).mockRejectedValueOnce(
      new CompanyMutationAuthError("inactive"),
    );
    await expect(
      softDeleteCompanyAction(initialCompanyFormState, new FormData()),
    ).resolves.toMatchObject({ status: "permission_error", message: expect.stringContaining("inactive") });
  });

  it("uses only the server-resolved actor and ignores client authority fields", async () => {
    const form = createForm();
    form.set("role", "ceo_admin");
    form.set("userId", "99999999-9999-4999-8999-999999999999");
    form.set("createdBy", "99999999-9999-4999-8999-999999999999");
    form.set("deletedAt", "2026-07-12T00:00:00.000Z");

    await createCompanyAction(initialCompanyFormState, form);
    const submitted = vi.mocked(service.create).mock.calls[0]?.[0];
    expect(submitted).not.toHaveProperty("role");
    expect(submitted).not.toHaveProperty("userId");
    expect(submitted).not.toHaveProperty("createdBy");
    expect(submitted).not.toHaveProperty("deletedAt");
    expect(service.create).toHaveBeenCalledWith(expect.any(Object), actor);
  });

  it("creates a company and revalidates the list", async () => {
    const state = await createCompanyAction(initialCompanyFormState, createForm());
    expect(state).toMatchObject({
      status: "success",
      companyId,
      redirectTo: `/companies/${companyId}`,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/companies");
  });

  it("returns a duplicate warning on the first create attempt", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(new CompanyDuplicateError([companyId]));

    const state = await createCompanyAction(initialCompanyFormState, createForm());
    expect(state).toMatchObject({
      status: "duplicate_warning",
      duplicateCandidateIds: [companyId],
      confirmationToken: expect.any(String),
    });
    expect(service.createConfirmedDuplicate).not.toHaveBeenCalled();
  });

  it("creates a confirmed duplicate only with a matching secure token", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(new CompanyDuplicateError([companyId]));
    const first = await createCompanyAction(initialCompanyFormState, createForm());
    const confirmed = createForm();
    confirmed.set("confirmationToken", first.confirmationToken ?? "");

    const state = await createCompanyAction(initialCompanyFormState, confirmed);
    expect(state.status).toBe("success");
    expect(service.createConfirmedDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: companyFixture.displayName }),
      actor,
      expect.objectContaining({
        confirmationId: expect.any(String),
        operation: "create",
        submissionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("returns the original result when the same confirmed create is submitted twice", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(new CompanyDuplicateError([companyId]));
    const warning = await createCompanyAction(initialCompanyFormState, createForm());
    const confirmed = createForm();
    confirmed.set("confirmationToken", warning.confirmationToken ?? "");

    const first = await createCompanyAction(initialCompanyFormState, confirmed);
    vi.mocked(service.createConfirmedDuplicate).mockResolvedValueOnce({
      status: "already_consumed",
      companyId,
    });
    const repeated = await createCompanyAction(initialCompanyFormState, confirmed);

    expect(first).toMatchObject({ status: "success", companyId });
    expect(repeated).toMatchObject({
      status: "success",
      companyId,
      message: expect.stringContaining("already created"),
    });
  });

  it("allows a safe retry when the first confirmed create fails", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(new CompanyDuplicateError([companyId]));
    const warning = await createCompanyAction(initialCompanyFormState, createForm());
    const confirmed = createForm();
    confirmed.set("confirmationToken", warning.confirmationToken ?? "");
    vi.mocked(service.createConfirmedDuplicate)
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({ status: "applied", companyId, company: companyFixture });

    await expect(
      createCompanyAction(initialCompanyFormState, confirmed),
    ).resolves.toMatchObject({ status: "error" });
    await expect(
      createCompanyAction(initialCompanyFormState, confirmed),
    ).resolves.toMatchObject({ status: "success", companyId });
  });

  it("rejects duplicate confirmation when the payload changes", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(new CompanyDuplicateError([companyId]));
    const first = await createCompanyAction(initialCompanyFormState, createForm());
    const changed = createForm();
    changed.set("displayName", "Changed Company");
    changed.set("confirmationToken", first.confirmationToken ?? "");

    const state = await createCompanyAction(initialCompanyFormState, changed);
    expect(state.status).toBe("validation_error");
    expect(state.fieldErrors?.confirmationToken).toBeDefined();
    expect(service.createConfirmedDuplicate).not.toHaveBeenCalled();
  });

  it("updates a company and revalidates list and record paths", async () => {
    const state = await updateCompanyAction(initialCompanyFormState, updateForm());
    expect(state).toMatchObject({ status: "success", companyId });
    expect(revalidatePath).toHaveBeenCalledWith("/companies");
    expect(revalidatePath).toHaveBeenCalledWith(`/companies/${companyId}`);
  });

  it("returns a duplicate warning for an identity-changing update", async () => {
    vi.mocked(service.update).mockRejectedValueOnce(new CompanyDuplicateError([companyId]));
    const form = updateForm();
    form.set("displayName", "Existing Company");

    const state = await updateCompanyAction(initialCompanyFormState, form);
    expect(state).toMatchObject({
      status: "duplicate_warning",
      confirmationToken: expect.any(String),
    });
  });

  it("does not reapply a consumed confirmed update", async () => {
    vi.mocked(service.update).mockRejectedValueOnce(new CompanyDuplicateError([companyId]));
    const identityUpdate = updateForm();
    identityUpdate.set("displayName", "Existing Company");
    const warning = await updateCompanyAction(
      initialCompanyFormState,
      identityUpdate,
    );
    identityUpdate.set("confirmationToken", warning.confirmationToken ?? "");
    vi.mocked(service.updateConfirmedDuplicate).mockResolvedValue({
      status: "already_consumed",
      companyId,
    });

    const state = await updateCompanyAction(initialCompanyFormState, identityUpdate);
    expect(state).toMatchObject({
      status: "success",
      companyId,
      message: expect.stringContaining("already applied"),
    });
  });

  it("returns distinct permission and not-found update states", async () => {
    vi.mocked(service.update).mockRejectedValueOnce(new CompanyPermissionError());
    await expect(
      updateCompanyAction(initialCompanyFormState, updateForm()),
    ).resolves.toMatchObject({ status: "permission_error" });

    vi.mocked(service.update).mockRejectedValueOnce(new CompanyNotFoundError());
    await expect(
      updateCompanyAction(initialCompanyFormState, updateForm()),
    ).resolves.toMatchObject({ status: "not_found" });
  });

  it("soft deletes a company and returns the safe redirect target", async () => {
    const state = await softDeleteCompanyAction(initialCompanyFormState, deleteForm());
    expect(service.softDelete).toHaveBeenCalledWith(companyId, actor);
    expect(state).toMatchObject({ status: "success", redirectTo: "/companies" });
    expect(revalidatePath).toHaveBeenCalledWith("/companies");
    expect(revalidatePath).toHaveBeenCalledWith(`/companies/${companyId}`);
  });

  it("returns permission and not-found states for soft delete", async () => {
    vi.mocked(service.softDelete).mockRejectedValueOnce(new CompanyPermissionError());
    await expect(
      softDeleteCompanyAction(initialCompanyFormState, deleteForm()),
    ).resolves.toMatchObject({ status: "permission_error" });

    vi.mocked(service.softDelete).mockRejectedValueOnce(new CompanyNotFoundError());
    await expect(
      softDeleteCompanyAction(initialCompanyFormState, deleteForm()),
    ).resolves.toMatchObject({ status: "not_found" });
  });

  it("converts internal errors into safe states", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(
      new Error("postgres secret relation details"),
    );
    const state = await createCompanyAction(initialCompanyFormState, createForm());
    expect(state.status).toBe("error");
    expect(state.message).not.toContain("postgres");
    expect(state.message).not.toContain("relation");
  });

  it("fails safely when duplicate confirmation signing is not configured", async () => {
    delete process.env.COMPANY_DUPLICATE_CONFIRMATION_SECRET;
    vi.mocked(service.create).mockRejectedValueOnce(new CompanyDuplicateError([companyId]));

    const state = await createCompanyAction(initialCompanyFormState, createForm());
    expect(state.status).toBe("error");
    expect(state.message).not.toContain("secret");
  });
});
