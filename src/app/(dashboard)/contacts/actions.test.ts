import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import type { ContactService } from "@/lib/contacts/contact.service";
import {
  ContactDuplicateError,
  ContactNotFoundError,
  ContactPermissionError,
} from "@/lib/contacts/contact.service";
import {
  ContactMutationAuthError,
  createContactMutationContext,
} from "@/lib/contacts/contact.server";
import {
  companyId,
  contactFixture,
  contactId,
  creatorId,
} from "@/lib/contacts/contact.test-fixtures";
import type { ContactActor } from "@/lib/contacts/contact.types";
import {
  createContactAction,
  softDeleteContactAction,
  updateContactAction,
} from "./actions";
import { initialContactFormState } from "./form-state";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/contacts/contact.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contacts/contact.server")>();
  return { ...actual, createContactMutationContext: vi.fn() };
});

const actor: ContactActor = {
  userId: creatorId,
  role: "sales_manager",
  isActive: true,
};

type MutationService = Pick<
  ContactService,
  | "create"
  | "createConfirmedDuplicate"
  | "update"
  | "updateConfirmedDuplicate"
  | "softDelete"
>;

let service: MutationService;

function createForm(): FormData {
  const form = new FormData();
  form.set("companyId", companyId);
  form.set("fullName", contactFixture.fullName ?? "Nur Aisyah");
  form.set("workEmail", contactFixture.workEmail ?? "aisyah@example.my");
  form.set("sourceUrl", contactFixture.sourceUrl);
  form.set("sourceType", contactFixture.sourceType);
  form.set("discoveredAt", contactFixture.discoveredAt);
  return form;
}

function updateForm(): FormData {
  const form = new FormData();
  form.set("contactId", contactId);
  form.set("workEmail", "updated@example.my");
  return form;
}

function deleteForm(): FormData {
  const form = new FormData();
  form.set("contactId", contactId);
  form.set("confirm", "true");
  return form;
}

beforeEach(() => {
  process.env.CONTACT_DUPLICATE_CONFIRMATION_SECRET =
    "test-contact-confirmation-secret-32-characters";
  service = {
    create: vi.fn().mockResolvedValue(contactFixture),
    createConfirmedDuplicate: vi.fn().mockResolvedValue({
      status: "applied",
      contactId,
    }),
    update: vi.fn().mockResolvedValue(contactFixture),
    updateConfirmedDuplicate: vi.fn().mockResolvedValue({
      status: "applied",
      contactId,
    }),
    softDelete: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(createContactMutationContext).mockReset().mockResolvedValue({
    actor,
    service: service as ContactService,
  });
  vi.mocked(revalidatePath).mockReset();
});

describe("Contacts server actions", () => {
  it("returns field-level validation errors", async () => {
    const form = createForm();
    form.set("workEmail", "not-an-email");
    const state = await createContactAction(initialContactFormState, form);
    expect(state.status).toBe("validation_error");
    expect(state.fieldErrors?.workEmail).toBeDefined();
    expect(service.create).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated and inactive users before parsing", async () => {
    vi.mocked(createContactMutationContext).mockRejectedValueOnce(
      new ContactMutationAuthError("unauthenticated"),
    );
    await expect(
      createContactAction(initialContactFormState, new FormData()),
    ).resolves.toMatchObject({
      status: "permission_error",
      message: expect.stringContaining("Sign in"),
    });

    vi.mocked(createContactMutationContext).mockRejectedValueOnce(
      new ContactMutationAuthError("inactive"),
    );
    await expect(
      softDeleteContactAction(initialContactFormState, new FormData()),
    ).resolves.toMatchObject({
      status: "permission_error",
      message: expect.stringContaining("inactive"),
    });
  });

  it("uses only the server-resolved actor and ignores client authority fields", async () => {
    const form = createForm();
    form.set("role", "ceo_admin");
    form.set("userId", "99999999-9999-4999-8999-999999999999");
    form.set("createdBy", "99999999-9999-4999-8999-999999999999");
    form.set("deletedAt", "2026-07-13T00:00:00.000Z");

    await createContactAction(initialContactFormState, form);
    const submitted = vi.mocked(service.create).mock.calls[0]?.[0];
    expect(submitted).not.toHaveProperty("role");
    expect(submitted).not.toHaveProperty("userId");
    expect(submitted).not.toHaveProperty("createdBy");
    expect(submitted).not.toHaveProperty("deletedAt");
    expect(service.create).toHaveBeenCalledWith(expect.any(Object), actor);
  });

  it("creates and returns revalidation/redirect metadata", async () => {
    const state = await createContactAction(initialContactFormState, createForm());
    expect(state).toMatchObject({
      status: "success",
      contactId,
      redirectTo: `/contacts/${contactId}`,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/contacts");
  });

  it("returns candidate IDs and a secure token on the first duplicate warning", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(
      new ContactDuplicateError([contactId]),
    );
    const state = await createContactAction(initialContactFormState, createForm());
    expect(state).toMatchObject({
      status: "duplicate_warning",
      duplicateCandidateIds: [contactId],
      confirmationToken: expect.any(String),
    });
    expect(service.createConfirmedDuplicate).not.toHaveBeenCalled();
  });

  it("performs confirmed create with a valid bound token", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(
      new ContactDuplicateError([contactId]),
    );
    const warning = await createContactAction(initialContactFormState, createForm());
    const confirmed = createForm();
    confirmed.set("confirmationToken", warning.confirmationToken ?? "");

    const state = await createContactAction(initialContactFormState, confirmed);
    expect(state).toMatchObject({ status: "success", contactId });
    expect(service.createConfirmedDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({ workEmail: contactFixture.workEmail }),
      actor,
      expect.objectContaining({
        confirmationId: expect.any(String),
        submissionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        operation: "create",
      }),
    );
  });

  it("returns one original result for repeated or concurrent confirmed create", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(
      new ContactDuplicateError([contactId]),
    );
    const warning = await createContactAction(initialContactFormState, createForm());
    const confirmed = createForm();
    confirmed.set("confirmationToken", warning.confirmationToken ?? "");
    vi.mocked(service.createConfirmedDuplicate)
      .mockResolvedValueOnce({ status: "applied", contactId })
      .mockResolvedValueOnce({ status: "already_processed", contactId });

    const [first, repeated] = await Promise.all([
      createContactAction(initialContactFormState, confirmed),
      createContactAction(initialContactFormState, confirmed),
    ]);
    expect([first.status, repeated.status].sort()).toEqual([
      "already_processed",
      "success",
    ]);
    expect(first.contactId).toBe(contactId);
    expect(repeated.contactId).toBe(contactId);
  });

  it("allows a safe retry when confirmed mutation fails before consumption", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(
      new ContactDuplicateError([contactId]),
    );
    const warning = await createContactAction(initialContactFormState, createForm());
    const confirmed = createForm();
    confirmed.set("confirmationToken", warning.confirmationToken ?? "");
    vi.mocked(service.createConfirmedDuplicate)
      .mockRejectedValueOnce(new Error("temporary transaction failure"))
      .mockResolvedValueOnce({ status: "applied", contactId });

    await expect(
      createContactAction(initialContactFormState, confirmed),
    ).resolves.toMatchObject({ status: "error" });
    await expect(
      createContactAction(initialContactFormState, confirmed),
    ).resolves.toMatchObject({ status: "success", contactId });
  });

  it("rejects confirmation after payload changes", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(
      new ContactDuplicateError([contactId]),
    );
    const warning = await createContactAction(initialContactFormState, createForm());
    const changed = createForm();
    changed.set("workEmail", "changed@example.my");
    changed.set("confirmationToken", warning.confirmationToken ?? "");

    const state = await createContactAction(initialContactFormState, changed);
    expect(state.status).toBe("validation_error");
    expect(state.fieldErrors?.confirmationToken).toBeDefined();
    expect(service.createConfirmedDuplicate).not.toHaveBeenCalled();
  });

  it("updates and revalidates list and Contact paths", async () => {
    const state = await updateContactAction(initialContactFormState, updateForm());
    expect(state).toMatchObject({
      status: "success",
      contactId,
      redirectTo: `/contacts/${contactId}`,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/contacts");
    expect(revalidatePath).toHaveBeenCalledWith(`/contacts/${contactId}`);
  });

  it("warns and safely replays a confirmed identity update", async () => {
    vi.mocked(service.update).mockRejectedValueOnce(
      new ContactDuplicateError([contactId]),
    );
    const form = updateForm();
    const warning = await updateContactAction(initialContactFormState, form);
    form.set("confirmationToken", warning.confirmationToken ?? "");
    vi.mocked(service.updateConfirmedDuplicate).mockResolvedValue({
      status: "already_processed",
      contactId,
    });

    const state = await updateContactAction(initialContactFormState, form);
    expect(state).toMatchObject({
      status: "already_processed",
      contactId,
      message: expect.stringContaining("already applied"),
    });
  });

  it("maps permission and not-found update errors distinctly", async () => {
    vi.mocked(service.update).mockRejectedValueOnce(new ContactPermissionError());
    await expect(
      updateContactAction(initialContactFormState, updateForm()),
    ).resolves.toMatchObject({ status: "permission_error" });

    vi.mocked(service.update).mockRejectedValueOnce(new ContactNotFoundError());
    await expect(
      updateContactAction(initialContactFormState, updateForm()),
    ).resolves.toMatchObject({ status: "not_found" });
  });

  it("soft deletes with explicit confirmation and safe redirect", async () => {
    const state = await softDeleteContactAction(
      initialContactFormState,
      deleteForm(),
    );
    expect(service.softDelete).toHaveBeenCalledWith(contactId, actor);
    expect(state).toMatchObject({
      status: "success",
      contactId,
      redirectTo: "/contacts",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/contacts");
    expect(revalidatePath).toHaveBeenCalledWith(`/contacts/${contactId}`);
  });

  it("maps non-management delete and missing Contact safely", async () => {
    vi.mocked(service.softDelete).mockRejectedValueOnce(new ContactPermissionError());
    await expect(
      softDeleteContactAction(initialContactFormState, deleteForm()),
    ).resolves.toMatchObject({ status: "permission_error" });

    vi.mocked(service.softDelete).mockRejectedValueOnce(new ContactNotFoundError());
    await expect(
      softDeleteContactAction(initialContactFormState, deleteForm()),
    ).resolves.toMatchObject({ status: "not_found" });
  });

  it("converts unexpected database errors into a generic state", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(
      new Error("postgres secret relation details"),
    );
    const state = await createContactAction(initialContactFormState, createForm());
    expect(state.status).toBe("error");
    expect(state.message).not.toContain("postgres");
    expect(state.message).not.toContain("relation");
  });

  it("fails safely when Contact confirmation signing is unavailable", async () => {
    delete process.env.CONTACT_DUPLICATE_CONFIRMATION_SECRET;
    vi.mocked(service.create).mockRejectedValueOnce(
      new ContactDuplicateError([contactId]),
    );
    const state = await createContactAction(initialContactFormState, createForm());
    expect(state.status).toBe("error");
    expect(state.message).not.toContain("secret");
  });
});
