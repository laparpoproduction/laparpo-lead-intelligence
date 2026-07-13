// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createCompanyAction,
  softDeleteCompanyAction,
  updateCompanyAction,
} from "@/app/(dashboard)/companies/actions";
import CompaniesError from "@/app/(dashboard)/companies/error";
import CompanyDetailsLoading from "@/app/(dashboard)/companies/[id]/loading";
import CompaniesLoading from "@/app/(dashboard)/companies/loading";
import { CompanyDeleteDialog } from "./company-delete-dialog";
import { CompanyDetailsPlaceholder } from "./company-details-placeholder";
import { CompanyEmptyState } from "./company-empty-state";
import { CompanyFilteredEmptyState } from "./company-filtered-empty-state";
import { CompanyForm } from "./company-form";
import { CompanyList } from "./company-list";
import { CompanyListToolbar } from "./company-list-toolbar";
import { CompanyPagination } from "./company-pagination";
import { COMPANIES_DEFAULT_PAGE_SIZE } from "@/lib/companies/company.constants";
import { parseCompanyQueryState } from "@/lib/companies/company-query";
import { companyFixture, companyId } from "@/lib/companies/company.test-fixtures";

const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/app/(dashboard)/companies/actions", () => ({
  createCompanyAction: vi.fn(),
  updateCompanyAction: vi.fn(),
  softDeleteCompanyAction: vi.fn(),
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
  vi.mocked(createCompanyAction).mockResolvedValue({ status: "idle" });
  vi.mocked(updateCompanyAction).mockResolvedValue({ status: "idle" });
  vi.mocked(softDeleteCompanyAction).mockResolvedValue({ status: "idle" });
});

afterEach(() => {
  cleanup();
});

describe("Companies UI", () => {
  it("renders the reusable create form with accessible labels", () => {
    render(<CompanyForm mode="create" />);
    expect(screen.getByRole("textbox", { name: /display name/i })).toBeDefined();
    expect(screen.getByRole("textbox", { name: /legal name/i })).toBeDefined();
    expect(screen.getByRole("combobox", { name: /company type/i })).toBeDefined();
    expect(screen.getByRole("textbox", { name: /source url/i })).toBeDefined();
    expect(screen.getByRole("button", { name: "Create company" })).toBeDefined();
  });

  it("renders field validation returned by the server action", async () => {
    vi.mocked(createCompanyAction).mockResolvedValueOnce({
      status: "validation_error",
      message: "Check the highlighted company fields.",
      fieldErrors: { displayName: ["Display name is required"] },
    });
    render(<CompanyForm mode="create" />);
    await userEvent.click(screen.getByRole("button", { name: "Create company" }));

    expect(await screen.findByText("Display name is required")).toBeDefined();
    expect(screen.getByRole("textbox", { name: /display name/i }).getAttribute("aria-invalid")).toBe("true");
  });

  it("renders duplicate warning and deliberate confirmation", async () => {
    vi.mocked(createCompanyAction).mockResolvedValueOnce({
      status: "duplicate_warning",
      message: "A likely duplicate company exists.",
      duplicateCandidateIds: [companyId],
      confirmationToken: "signed-confirmation-token",
    });
    render(<CompanyForm mode="create" />);
    await userEvent.click(screen.getByRole("button", { name: "Create company" }));

    expect(await screen.findByText("Possible duplicate found")).toBeDefined();
    expect(screen.getByRole("button", { name: "Create anyway" })).toBeDefined();
    const token = document.querySelector<HTMLInputElement>('input[name="confirmationToken"]');
    expect(token?.value).toBe("signed-confirmation-token");
  });

  it("redirects to the list after successful create", async () => {
    vi.mocked(createCompanyAction).mockResolvedValueOnce({
      status: "success",
      message: "Company created successfully.",
      companyId,
      redirectTo: `/companies/${companyId}`,
    });
    render(<CompanyForm mode="create" />);
    await userEvent.click(screen.getByRole("button", { name: "Create company" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/companies"));
  });

  it("submits the same form for successful update", async () => {
    vi.mocked(updateCompanyAction).mockResolvedValueOnce({
      status: "success",
      message: "Company updated successfully.",
      companyId,
    });
    render(<CompanyForm company={companyFixture} mode="edit" />);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Company updated successfully.")).toBeDefined();
    expect(updateCompanyAction).toHaveBeenCalled();
  });

  it("requires dialog confirmation and redirects after successful delete", async () => {
    vi.mocked(softDeleteCompanyAction).mockResolvedValueOnce({
      status: "success",
      message: "Company deleted successfully.",
      companyId,
      redirectTo: "/companies",
    });
    render(<CompanyDeleteDialog companyId={companyId} companyName="ABC Company" />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Delete company" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/companies"));
  });

  it("renders list data, empty state, and loading state", () => {
    const query = parseCompanyQueryState({});
    const { rerender } = render(
      <CompanyList
        canDelete
        companies={[companyFixture]}
        pagination={{
          page: 1,
          pageSize: COMPANIES_DEFAULT_PAGE_SIZE,
          total: 1,
          totalPages: 1,
        }}
        query={query}
      />,
    );
    expect(screen.getAllByText(companyFixture.displayName).length).toBeGreaterThan(0);
    expect(screen.getAllByText(companyFixture.legalName).length).toBeGreaterThan(0);
    expect(COMPANIES_DEFAULT_PAGE_SIZE).toBe(25);
    expect(
      screen
        .getByRole("region", { name: "Companies list" })
        .getAttribute("data-page-size"),
    ).toBe("25");
    expect(
      screen.getAllByRole("link", {
        name: `View ${companyFixture.displayName} details`,
      })[0]?.getAttribute("href"),
    ).toBe(`/companies/${companyId}`);

    rerender(<CompanyEmptyState />);
    expect(screen.getByText("No companies yet")).toBeDefined();

    rerender(<CompaniesLoading />);
    expect(screen.getByRole("status", { name: "Loading companies" })).toBeDefined();
  });

  it("submits server-driven search and filters while resetting the page", async () => {
    const query = parseCompanyQueryState({
      state: "Penang",
      sortBy: "displayName",
      sortDirection: "asc",
      page: "4",
    });
    render(<CompanyListToolbar query={query} />);

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search companies" }),
      "Acme",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Company type" }),
      "agency",
    );
    await userEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(router.push).toHaveBeenCalledWith(
      "/companies?q=Acme&companyType=agency&state=Penang&sortBy=displayName&sortDirection=asc",
    );
    expect(screen.getByRole("link", { name: "Clear all filters" }).getAttribute("href")).toBe(
      "/companies?sortBy=displayName&sortDirection=asc",
    );
  });

  it("renders mobile-available filter controls and a distinct filtered empty state", () => {
    const query = parseCompanyQueryState({ q: "No match", city: "Kuala Lumpur" });
    const { rerender } = render(<CompanyListToolbar query={query} />);

    expect(screen.getByRole("searchbox", { name: "Search companies" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "Industry" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "City" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "State" })).toBeDefined();

    rerender(<CompanyFilteredEmptyState query={query} />);
    expect(screen.getByText("No matching companies")).toBeDefined();
    expect(screen.getByRole("link", { name: "Clear all filters" })).toBeDefined();
  });

  it("preserves query state in deterministic previous and next links", () => {
    const query = parseCompanyQueryState({
      q: "Acme",
      companyType: "hotel",
      sortBy: "legalName",
      sortDirection: "asc",
      page: "2",
    });
    const { rerender } = render(
      <CompanyPagination
        page={2}
        pageSize={25}
        query={query}
        total={51}
        totalPages={3}
      />,
    );

    expect(screen.getByText("Showing 26–50 of 51")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Previous companies page" }).getAttribute("href"),
    ).toBe(
      "/companies?q=Acme&companyType=hotel&sortBy=legalName&sortDirection=asc",
    );
    expect(
      screen.getByRole("link", { name: "Next companies page" }).getAttribute("href"),
    ).toBe(
      "/companies?q=Acme&companyType=hotel&sortBy=legalName&sortDirection=asc&page=3",
    );

    rerender(
      <CompanyPagination
        page={1}
        pageSize={25}
        query={{ ...query, page: 1 }}
        total={25}
        totalPages={1}
      />,
    );
    expect(
      screen.getByLabelText("Previous companies page").getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      screen.getByLabelText("Next companies page").getAttribute("aria-disabled"),
    ).toBe("true");

    rerender(
      <CompanyPagination
        page={3}
        pageSize={25}
        query={{ ...query, page: 3 }}
        total={51}
        totalPages={3}
      />,
    );
    expect(screen.getByText("Showing 51–51 of 51")).toBeDefined();
    expect(
      screen.getByLabelText("Next companies page").getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("renders the protected company details placeholder and loading state", () => {
    const { rerender } = render(
      <CompanyDetailsPlaceholder company={companyFixture} />,
    );

    expect(
      screen.getByRole("heading", { name: companyFixture.displayName }),
    ).toBeDefined();
    expect(screen.getByText("Workspace ready")).toBeDefined();
    expect(screen.queryByText("Timeline")).toBeNull();

    rerender(<CompanyDetailsLoading />);
    expect(
      screen.getByRole("status", { name: "Loading company details" }),
    ).toBeDefined();
  });

  it("renders a recoverable error state", async () => {
    const reset = vi.fn();
    render(<CompaniesError error={new Error("private database detail")} reset={reset} />);

    expect(screen.getByText("Companies could not be loaded")).toBeDefined();
    expect(screen.queryByText("private database detail")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
