// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({
  assignOwner: vi.fn(),
  changeStage: vi.fn(),
  clearProbability: vi.fn(),
  markLost: vi.fn(),
  markWon: vi.fn(),
  overrideProbability: vi.fn(),
  setExpectedClose: vi.fn(),
}));
const router = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/(dashboard)/opportunities/actions", () => ({
  assignOpportunityOwnerAction: actions.assignOwner,
  changeOpportunityStageAction: actions.changeStage,
  clearOpportunityProbabilityOverrideAction: actions.clearProbability,
  markOpportunityLostAction: actions.markLost,
  markOpportunityWonAction: actions.markWon,
  overrideOpportunityProbabilityAction: actions.overrideProbability,
  setOpportunityExpectedCloseDateAction: actions.setExpectedClose,
}));

import { OpportunityPipelineBoard } from "./opportunity-pipeline-board";
import type {
  OpportunityPipelineBoard as PipelineBoard,
  OpportunityPipelineCard,
} from "@/lib/opportunities/opportunity.types";

const actorId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const version = "2026-07-27T08:00:00.000Z";
const baseCard: OpportunityPipelineCard = {
  id: "33333333-3333-4333-8333-333333333333",
  leadId: "44444444-4444-4444-8444-444444444444",
  leadTitle:
    "A very long campaign title that must wrap safely without corrupting the page width",
  companyId: "55555555-5555-4555-8555-555555555555",
  companyName:
    "A very long client company name that remains inside the Opportunity card",
  service: "corporate",
  estimatedValueMyr: null,
  quotationNumber: null,
  quotationSentAt: null,
  meetingAt: null,
  depositAmountMyr: null,
  depositReceivedAt: null,
  pipelineStage: "new",
  probabilityPercent: 65,
  probabilityOverridden: true,
  expectedCloseDate: "2020-01-01",
  ownerId,
  wonAt: null,
  lostAt: null,
  lostReason: null,
  lostReasonNotes: null,
  createdAt: version,
  updatedAt: version,
  isConversion: true,
  convertedAt: version,
  canModify: true,
};

function makeBoard(
  cards: Partial<Record<OpportunityPipelineCard["pipelineStage"], OpportunityPipelineCard[]>> = {
    new: [baseCard],
  },
): PipelineBoard {
  const stages = [
    "new",
    "discussion",
    "quotation_sent",
    "negotiation",
    "won",
    "lost",
  ] as const;
  return {
    columns: stages.map((stage) => ({
      stage,
      items: cards[stage] ?? [],
      total: stage === "new" ? 30 : (cards[stage]?.length ?? 0),
    })),
    ownerProfiles: [
      {
        id: actorId,
        fullName: "Current Rep",
        role: "sales_representative",
        isActive: true,
      },
      {
        id: ownerId,
        fullName: "Sales Manager",
        role: "sales_manager",
        isActive: true,
      },
    ],
  };
}

function renderBoard(
  board = makeBoard(),
  role: "sales_manager" | "sales_representative" = "sales_manager",
) {
  return render(
    <OpportunityPipelineBoard
      actorId={actorId}
      actorRole={role}
      board={board}
      query={{ kind: "all" }}
    />,
  );
}

const success = {
  status: "success" as const,
  message: "Opportunity updated successfully.",
  opportunityId: baseCard.id,
  updatedAt: "2026-07-27T09:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.removeAttribute("open");
    },
  });
  Object.values(actions).forEach((action) =>
    action.mockResolvedValue(success),
  );
});

afterEach(cleanup);

describe("Opportunity pipeline UI", () => {
  it("renders six responsive stages, exact counts, empty states and wrap-safe cards", () => {
    renderBoard();
    const board = screen.getByRole("region", {
      name: "Opportunity pipeline board",
    });
    expect(board.getAttribute("data-mobile-presentation")).toBe(
      "horizontal-stage-sections",
    );
    for (const stage of [
      "New",
      "Discussion",
      "Quotation Sent",
      "Negotiation",
      "Won",
      "Lost",
    ]) {
      expect(screen.getByRole("heading", { name: stage })).toBeDefined();
    }
    expect(screen.getByLabelText("30 Opportunities")).toBeDefined();
    expect(screen.getByText("No Opportunities in Discussion.")).toBeDefined();
    expect(screen.getByText(baseCard.leadTitle).className).toContain(
      "break-words",
    );
    expect(screen.getByText(/33333333…3333/).className).toContain("break-all");
    expect(screen.getByText("Not recorded")).toBeDefined();
    expect(screen.queryByText("RM0.00")).toBeNull();
    expect(screen.getByText("65%")).toBeDefined();
    expect(screen.getByText("Manual override")).toBeDefined();
    expect(screen.getByText("Overdue")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "View all New in List" }).getAttribute(
        "href",
      ),
    ).toBe("/opportunities?stage=new");
  });

  it("renders exact-ledger kind labels and persisted terminal metadata", () => {
    const won = {
      ...baseCard,
      id: "66666666-6666-4666-8666-666666666666",
      pipelineStage: "won" as const,
      probabilityPercent: 100,
      probabilityOverridden: false,
      expectedCloseDate: "2020-01-01",
      wonAt: "2026-07-27T10:00:00.000Z",
    };
    const lost = {
      ...baseCard,
      id: "77777777-7777-4777-8777-777777777777",
      pipelineStage: "lost" as const,
      probabilityPercent: 0,
      probabilityOverridden: false,
      expectedCloseDate: "2020-01-01",
      lostAt: "2026-07-27T10:00:00.000Z",
      lostReason: "other" as const,
      lostReasonNotes: "Client changed direction",
      isConversion: false,
      convertedAt: null,
    };
    renderBoard(makeBoard({ won: [won], lost: [lost] }));
    expect(screen.getByText("Conversion")).toBeDefined();
    expect(screen.getByText("Ordinary")).toBeDefined();
    expect(screen.getByText("Won date")).toBeDefined();
    expect(screen.getByText("Lost date")).toBeDefined();
    expect(screen.getByText("Other")).toBeDefined();
    expect(screen.getByText("Client changed direction")).toBeDefined();
    expect(screen.queryByText("Overdue")).toBeNull();
  });

  it("submits the current CAS version through the dedicated active-stage action", async () => {
    renderBoard();
    await userEvent.click(
      screen.getByRole("button", { name: "Manage Opportunity" }),
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: "Target stage" }),
      "discussion",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirm move" }),
    );
    await waitFor(() => expect(actions.changeStage).toHaveBeenCalledOnce());
    const formData = actions.changeStage.mock.calls[0]?.[1] as FormData;
    expect(formData.get("opportunityId")).toBe(baseCard.id);
    expect(formData.get("expectedUpdatedAt")).toBe(version);
    expect(formData.get("pipelineStage")).toBe("discussion");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("disables a stage submit while pending and refreshes stale conflicts", async () => {
    let resolve!: (value: typeof success) => void;
    actions.changeStage.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    renderBoard();
    await userEvent.click(
      screen.getByRole("button", { name: "Manage Opportunity" }),
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: "Target stage" }),
      "discussion",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirm move" }),
    );
    expect(
      (
        within(dialog).getByRole("button", {
          name: /Moving/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    resolve(success);
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());

    actions.changeStage.mockResolvedValueOnce({
      status: "conflict",
      message:
        "This Opportunity was updated by someone else. The latest information has been loaded. Review it and try again.",
    });
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: "Target stage" }),
      "discussion",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirm move" }),
    );
    expect(
      await within(dialog).findByText(/updated by someone else/),
    ).toBeDefined();
    expect(router.refresh).toHaveBeenCalledTimes(2);
  });

  it("uses explicit Won confirmation and never requests deposit data", async () => {
    renderBoard();
    await userEvent.click(
      screen.getByRole("button", { name: "Manage Opportunity" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/deposit is not required/i),
    ).toBeDefined();
    await userEvent.click(
      within(dialog).getByLabelText(
        "I confirm the client has agreed that this work will proceed.",
      ),
    );
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Mark Opportunity Won",
      }),
    );
    await waitFor(() => expect(actions.markWon).toHaveBeenCalledOnce());
    const formData = actions.markWon.mock.calls[0]?.[1] as FormData;
    expect(formData.get("expectedUpdatedAt")).toBe(version);
    expect(formData.get("deposit")).toBeNull();
    expect(formData.get("won_at")).toBeNull();
  });

  it("offers every allowed Lost reason and associates server validation to other notes", async () => {
    actions.markLost.mockResolvedValueOnce({
      status: "validation_error",
      message: "Check the Opportunity mutation fields.",
      fieldErrors: {
        lostReasonNotes: ["Other Lost reason requires an explanation"],
      },
    });
    renderBoard();
    await userEvent.click(
      screen.getByRole("button", { name: "Manage Opportunity" }),
    );
    const dialog = screen.getByRole("dialog");
    const reason = within(dialog).getByRole("combobox", {
      name: "Lost reason",
    });
    expect(within(reason).getAllByRole("option")).toHaveLength(8);
    await userEvent.selectOptions(reason, "other");
    const notes = within(dialog).getByRole("textbox", {
      name: "Lost reason notes (required)",
    });
    expect((notes as HTMLTextAreaElement).required).toBe(true);
    await userEvent.type(notes, "   ");
    await userEvent.click(
      within(dialog).getByLabelText(
        "I confirm this Opportunity should be recorded as Lost.",
      ),
    );
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Mark Opportunity Lost",
      }),
    );
    expect(
      await within(dialog).findByText(
        "Other Lost reason requires an explanation",
      ),
    ).toBeDefined();
    expect(notes.getAttribute("aria-describedby")).toMatch(/error/);
    expect(document.activeElement).toBe(notes);
  });

  it("reflects management and representative owner/probability permissions", async () => {
    renderBoard();
    await userEvent.click(
      screen.getByRole("button", { name: "Manage Opportunity" }),
    );
    let dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("combobox", { name: "Opportunity owner" }),
    ).toBeDefined();
    expect(
      within(dialog).getByRole("spinbutton", {
        name: "Probability percent",
      }),
    ).toBeDefined();
    cleanup();

    renderBoard(
      makeBoard({
        new: [{ ...baseCard, ownerId: null }],
      }),
      "sales_representative",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Manage Opportunity" }),
    );
    dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: "Claim for myself" }),
    ).toBeDefined();
    expect(
      within(dialog).queryByRole("spinbutton", {
        name: "Probability percent",
      }),
    ).toBeNull();
    expect(
      within(dialog).queryByRole("combobox", { name: "Opportunity owner" }),
    ).toBeNull();
  });

  it("integrates owner, expected-close and probability actions without side-effect fields", async () => {
    renderBoard();
    await userEvent.click(
      screen.getByRole("button", { name: "Manage Opportunity" }),
    );
    const dialog = screen.getByRole("dialog");

    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: "Opportunity owner" }),
      "",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save owner" }),
    );
    await waitFor(() => expect(actions.assignOwner).toHaveBeenCalledOnce());
    let formData = actions.assignOwner.mock.calls[0]?.[1] as FormData;
    expect(formData.get("ownerId")).toBe("");

    const closeDate = within(dialog).getByLabelText(
      "Expected close date",
    ) as HTMLInputElement;
    await userEvent.clear(closeDate);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save date" }),
    );
    await waitFor(() => expect(actions.setExpectedClose).toHaveBeenCalledOnce());
    formData = actions.setExpectedClose.mock.calls[0]?.[1] as FormData;
    expect(formData.get("expectedCloseDate")).toBe("");
    expect(formData.get("pipelineStage")).toBeNull();

    const probability = within(dialog).getByRole("spinbutton", {
      name: "Probability percent",
    });
    await userEvent.clear(probability);
    await userEvent.type(probability, "72");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Apply override" }),
    );
    await waitFor(() =>
      expect(actions.overrideProbability).toHaveBeenCalledOnce(),
    );
    formData = actions.overrideProbability.mock.calls[0]?.[1] as FormData;
    expect(formData.get("probabilityPercent")).toBe("72");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Use stage default" }),
    );
    await waitFor(() =>
      expect(actions.clearProbability).toHaveBeenCalledOnce(),
    );
  });

  it("submits representative self-claim only as the current actor", async () => {
    renderBoard(
      makeBoard({ new: [{ ...baseCard, ownerId: null }] }),
      "sales_representative",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Manage Opportunity" }),
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Claim for myself" }),
    );
    await waitFor(() => expect(actions.assignOwner).toHaveBeenCalledOnce());
    const formData = actions.assignOwner.mock.calls[0]?.[1] as FormData;
    expect(formData.get("ownerId")).toBe(actorId);
  });

  it("keeps Company-derived and terminal cards free of reopening controls", async () => {
    const readOnly = { ...baseCard, canModify: false };
    renderBoard(makeBoard({ new: [readOnly] }));
    expect(
      screen.getByText(/Company-derived access does not grant mutation/),
    ).toBeDefined();
    expect(
      screen.queryByRole("button", { name: "Manage Opportunity" }),
    ).toBeNull();
    cleanup();

    const terminal = {
      ...baseCard,
      pipelineStage: "won" as const,
      probabilityPercent: 100,
      probabilityOverridden: false,
      wonAt: version,
    };
    renderBoard(makeBoard({ won: [terminal] }));
    await userEvent.click(
      screen.getByRole("button", { name: "Manage Opportunity" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).queryByRole("combobox", { name: "Target stage" }),
    ).toBeNull();
    expect(
      within(dialog).queryByRole("button", { name: "Mark Opportunity Lost" }),
    ).toBeNull();
    expect(
      within(dialog).queryByRole("button", { name: "Mark Opportunity Won" }),
    ).toBeNull();
    expect(
      within(dialog).queryByRole("spinbutton", {
        name: "Probability percent",
      }),
    ).toBeNull();
  });
});
