// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createContactAction,
  softDeleteContactAction,
  updateContactAction,
} from "@/app/(dashboard)/contacts/actions";
import ContactsError from "@/app/(dashboard)/contacts/error";
import ContactDetailsLoading from "@/app/(dashboard)/contacts/[contactId]/loading";
import ContactNotFound from "@/app/(dashboard)/contacts/[contactId]/not-found";
import ContactsLoading from "@/app/(dashboard)/contacts/loading";
import { contactFixture, contactId, creatorId } from "@/lib/contacts/contact.test-fixtures";
import type { ContactActor } from "@/lib/contacts/contact.types";
import { ContactDeleteDialog } from "./contact-delete-dialog";
import { ContactDetailsPlaceholder } from "./contact-details-placeholder";
import { ContactEmptyState } from "./contact-empty-state";
import { ContactForm } from "./contact-form";
import { ContactList } from "./contact-list";

const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
};

const manager: ContactActor = {
  userId: creatorId,
  role: "sales_manager",
  isActive: true,
};

const representative: ContactActor = {
  userId: creatorId,
  role: "sales_representative",
  isActive: true,
};

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/app/(dashboard)/contacts/actions", () => ({
  createContactAction: vi.fn(),
  updateContactAction: vi.fn(),
  softDeleteContactAction: vi.fn(),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createContactAction).mockResolvedValue({ status: "idle" });
  vi.mocked(updateContactAction).mockResolvedValue({ status: "idle" });
  vi.mocked(softDeleteContactAction).mockResolvedValue({ status: "idle" });
});

afterEach(cleanup);

describe("Contacts UI", () => {
  it("renders a bounded desktop list and mobile cards with details navigation", () => {
    render(
      <ContactList
        actor={manager}
        contacts={[contactFixture]}
        pageSize={25}
        total={1}
      />,
    );

    expect(screen.getAllByText(contactFixture.fullName ?? "").length).toBeGreaterThan(0);
    expect(screen.getAllByText(contactFixture.jobTitle ?? "").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Contacts list" }).getAttribute("data-page-size")).toBe("25");
    expect(screen.getByRole("list", { name: "Contacts" })).toBeDefined();
    const links = screen.getAllByRole("link", { name: `View ${contactFixture.fullName} details` });
    expect(links.length).toBe(2);
    expect(links[0]?.getAttribute("href")).toBe(`/contacts/${contactId}`);
  });

  it("renders the database-empty and list loading states", () => {
    const { rerender } = render(<ContactEmptyState />);
    expect(screen.getByText("No contacts yet")).toBeDefined();
    expect(screen.getByRole("link", { name: "Add first contact" }).getAttribute("href")).toBe("/contacts/new");

    rerender(<ContactsLoading />);
    expect(screen.getByRole("status", { name: "Loading contacts" })).toBeDefined();
  });

  it("renders every practical create field and required provenance", () => {
    render(
      <ContactForm
        actor={manager}
        defaultDiscoveredAt="2026-07-14T00:00:00.000Z"
        mode="create"
      />,
    );

    expect(screen.getByRole("textbox", { name: "Full name" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "Work email" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "WhatsApp phone" })).toBeDefined();
    expect(screen.getByRole("combobox", { name: "Contact status" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: /Source URL/ })).toHaveProperty("required", true);
    expect(screen.getByRole("textbox", { name: /Discovered at/ })).toHaveProperty("required", true);
    expect(screen.getByRole("button", { name: "Create contact" })).toBeDefined();
  });

  it("renders field validation and focuses the invalid field", async () => {
    vi.mocked(createContactAction).mockResolvedValueOnce({
      status: "validation_error",
      message: "Check the highlighted contact fields.",
      fieldErrors: { workEmail: ["Invalid email address"] },
    });
    render(<ContactForm actor={manager} defaultDiscoveredAt="2026-07-14T00:00:00.000Z" mode="create" />);
    await userEvent.click(screen.getByRole("button", { name: "Create contact" }));

    expect(await screen.findByText("Invalid email address")).toBeDefined();
    expect(screen.getByRole("textbox", { name: "Work email" }).getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Work email" }));
  });

  it("hydrates nullable edit values and Contact status", () => {
    render(<ContactForm actor={manager} contact={contactFixture} mode="edit" />);
    expect((screen.getByRole("textbox", { name: "Full name" }) as HTMLInputElement).value).toBe(contactFixture.fullName);
    expect((screen.getByRole("textbox", { name: "Public personal email" }) as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("combobox", { name: "Contact status" }) as HTMLSelectElement).value).toBe("verified");
    expect((screen.getByRole("textbox", { name: /Source URL/ }) as HTMLInputElement).value).toBe(contactFixture.sourceUrl);
  });

  it("renders duplicate IDs and requires explicit confirmed create", async () => {
    vi.mocked(createContactAction)
      .mockResolvedValueOnce({
        status: "duplicate_warning",
        message: "A likely duplicate exists.",
        duplicateCandidateIds: [contactId],
        confirmationToken: "signed-contact-token",
      })
      .mockResolvedValueOnce({
        status: "success",
        message: "Contact created successfully.",
        contactId,
        redirectTo: `/contacts/${contactId}`,
      });
    render(<ContactForm actor={manager} defaultDiscoveredAt="2026-07-14T00:00:00.000Z" mode="create" />);
    await userEvent.click(screen.getByRole("button", { name: "Create contact" }));

    expect(await screen.findByText("Possible duplicate contact")).toBeDefined();
    expect(screen.getByText(contactId)).toBeDefined();
    expect(screen.getByRole("button", { name: "Create anyway" })).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Create anyway" }));

    const confirmedData = vi.mocked(createContactAction).mock.calls[1]?.[1];
    expect(confirmedData?.get("confirmationToken")).toBe("signed-contact-token");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/contacts/${contactId}`));
  });

  it("shows changed-payload confirmation rejection and allows revision", async () => {
    vi.mocked(createContactAction)
      .mockResolvedValueOnce({
        status: "duplicate_warning",
        duplicateCandidateIds: [contactId],
        confirmationToken: "signed-contact-token",
      })
      .mockResolvedValueOnce({
        status: "validation_error",
        message: "The duplicate confirmation is invalid.",
        fieldErrors: { confirmationToken: ["Submit again after changing the form."] },
      });
    render(<ContactForm actor={manager} defaultDiscoveredAt="2026-07-14T00:00:00.000Z" mode="create" />);
    await userEvent.click(screen.getByRole("button", { name: "Create contact" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Full name" }), " Changed");
    await userEvent.click(screen.getByRole("button", { name: "Create anyway" }));

    expect(await screen.findByText("The duplicate confirmation is invalid.")).toBeDefined();
  });

  it("handles successful, already-processed and permission outcomes", async () => {
    vi.mocked(updateContactAction).mockResolvedValueOnce({
      status: "already_processed",
      message: "This confirmed update was already applied.",
      contactId,
      redirectTo: `/contacts/${contactId}`,
    });
    render(<ContactForm actor={manager} contact={contactFixture} mode="edit" />);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/contacts/${contactId}`));

    cleanup();
    vi.mocked(updateContactAction).mockResolvedValueOnce({ status: "permission_error", message: "You cannot change this contact." });
    render(<ContactForm actor={manager} contact={contactFixture} mode="edit" />);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Permission denied")).toBeDefined();
  });

  it("reflects representative Company and assignment restrictions", () => {
    render(<ContactForm actor={representative} contact={contactFixture} mode="edit" />);
    expect(screen.getByRole("textbox", { name: "Company ID" })).toHaveProperty("disabled", true);
    expect(screen.getByText(/Assignment is locked/)).toBeDefined();

    cleanup();
    render(<ContactList actor={{ ...representative, userId: "55555555-5555-4555-8555-555555555555" }} contacts={[contactFixture]} pageSize={25} total={1} />);
    expect(screen.getAllByText("Read only").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  });

  it("archives through explicit management confirmation and renders denial safely", async () => {
    vi.mocked(softDeleteContactAction).mockResolvedValueOnce({
      status: "success",
      message: "Contact archived successfully.",
      contactId,
      redirectTo: "/contacts",
    });
    render(<ContactDeleteDialog contactId={contactId} contactName="Nur Aisyah" />);
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Archive contact" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/contacts"));

    cleanup();
    vi.mocked(softDeleteContactAction).mockResolvedValueOnce({ status: "permission_error", message: "Only management can archive contacts." });
    render(<ContactDeleteDialog contactId={contactId} contactName="Nur Aisyah" />);
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    await userEvent.click(screen.getByRole("button", { name: "Archive contact" }));
    expect(await screen.findByText("Only management can archive contacts.")).toBeDefined();
  });

  it("renders details, protected actions, not-found, loading and safe error states", async () => {
    const { rerender } = render(<ContactDetailsPlaceholder canArchive canEdit contact={contactFixture} />);
    expect(screen.getByRole("heading", { name: contactFixture.fullName ?? "" })).toBeDefined();
    expect(screen.getByText("Contact workspace ready")).toBeDefined();
    expect(screen.getByRole("link", { name: "Edit contact" }).getAttribute("href")).toBe(`/contacts/${contactId}/edit`);
    expect(screen.queryByText("Timeline")).toBeNull();

    rerender(<ContactNotFound />);
    expect(screen.getByText("Contact not found")).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to Contacts" })).toBeDefined();

    rerender(<ContactDetailsLoading />);
    expect(screen.getByRole("status", { name: "Loading contact details" })).toBeDefined();

    const reset = vi.fn();
    rerender(<ContactsError error={new Error("private database detail")} reset={reset} />);
    expect(screen.queryByText("private database detail")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
