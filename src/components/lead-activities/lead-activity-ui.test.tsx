// @vitest-environment jsdom

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  archiveLeadActivityAction,
  createLeadActivityAction,
  restoreLeadActivityAction,
  updateLeadActivityAction,
} from "@/app/(dashboard)/leads/activities/actions";
import type {
  LeadActivity,
  LeadActivityActor,
} from "@/lib/lead-activities/lead-activity.types";
import { LeadActivityTimeline } from "./lead-activity-timeline";

vi.mock("@/app/(dashboard)/leads/activities/actions", () => ({
  createLeadActivityAction: vi.fn(),
  updateLeadActivityAction: vi.fn(),
  archiveLeadActivityAction: vi.fn(),
  restoreLeadActivityAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const router = { replace: vi.fn(), refresh: vi.fn() };
const leadId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const activityId = "33333333-3333-4333-8333-333333333333";
const manager: LeadActivityActor = {
  userId: actorId,
  role: "sales_manager",
  isActive: true,
};
const representative: LeadActivityActor = {
  userId: "44444444-4444-4444-8444-444444444444",
  role: "sales_representative",
  isActive: true,
};
const activity: LeadActivity = {
  id: activityId,
  leadId,
  activityType: "call",
  subject: "Discovery call",
  description: "Discussed campaign goals and a long public URL https://example.com/very/long/path/that/must/not/break/mobile/layout",
  activityAt: "2026-07-24T08:00:00.000Z",
  nextFollowUpAt: "2026-07-23T08:00:00.000Z",
  outcome: "Qualified",
  createdBy: actorId,
  assignedTo: actorId,
  createdAt: "2026-07-24T08:01:00.000Z",
  updatedAt: "2026-07-24T08:01:00.000Z",
  deletedAt: null,
};

const result = {
  items: [activity],
  page: 1,
  pageSize: 25,
  total: 1,
  totalPages: 1,
};

function renderTimeline(
  options: Partial<React.ComponentProps<typeof LeadActivityTimeline>> = {},
) {
  return render(
    <LeadActivityTimeline
      actor={manager}
      canModifyLead
      defaultActivityAt="2026-07-24T10:00:00.000Z"
      leadId={leadId}
      nowIso="2026-07-24T10:00:00.000Z"
      result={result}
      {...options}
    />,
  );
}

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
  vi.mocked(createLeadActivityAction).mockResolvedValue({ status: "idle" });
  vi.mocked(updateLeadActivityAction).mockResolvedValue({ status: "idle" });
  vi.mocked(archiveLeadActivityAction).mockResolvedValue({ status: "idle" });
  vi.mocked(restoreLeadActivityAction).mockResolvedValue({ status: "idle" });
});

afterEach(cleanup);

describe("Lead Activity timeline UI", () => {
  it("renders activity metadata and server-derived overdue visibility", () => {
    renderTimeline();
    expect(screen.getByRole("heading", { name: "Activity timeline" })).toBeDefined();
    const heading = screen.getByRole("heading", { name: "Discovery call" });
    expect(heading).toBeDefined();
    expect(heading.previousElementSibling?.textContent).toBe("Call");
    expect(screen.getByText("Qualified")).toBeDefined();
    expect(screen.getByText("Overdue follow-up")).toBeDefined();
    expect(screen.getAllByText("You")).toHaveLength(2);
    expect(
      heading.closest("article")?.querySelector("p")?.textContent,
    ).toContain("long public URL");
  });

  it("preserves the deterministic server order and renders pagination", () => {
    const newer = { ...activity, id: "55555555-5555-4555-8555-555555555555", subject: "Newest" };
    const older = { ...activity, id: "66666666-6666-4666-8666-666666666666", subject: "Older" };
    renderTimeline({
      result: {
        items: [newer, older],
        page: 1,
        pageSize: 25,
        total: 30,
        totalPages: 2,
      },
    });
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Newest",
      "Older",
    ]);
    expect(screen.getByRole("link", { name: "Older activity page" }).getAttribute("href")).toBe(
      `/leads/${leadId}?activityPage=2`,
    );
  });

  it("encourages the first activity only when Lead modification is available", () => {
    const { rerender } = renderTimeline({
      result: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 },
    });
    expect(screen.getByText("No activities yet")).toBeDefined();
    expect(screen.getByRole("button", { name: "Add the first activity" })).toBeDefined();
    rerender(
      <LeadActivityTimeline
        actor={representative}
        canModifyLead={false}
        defaultActivityAt="2026-07-24T10:00:00.000Z"
        leadId={leadId}
        nowIso="2026-07-24T10:00:00.000Z"
        result={{ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Add the first activity" })).toBeNull();
  });

  it("uses the safe create contract and refreshes after success", async () => {
    vi.mocked(createLeadActivityAction).mockResolvedValueOnce({
      status: "success",
      activityId,
      leadId,
    });
    renderTimeline();
    await userEvent.click(screen.getByRole("button", { name: "Add Activity" }));
    const dialog = screen.getByRole("dialog", { name: "Add Activity" });
    expect(dialog.querySelector("[name='activityType']")).not.toBeNull();
    expect(dialog.querySelector("[name='activityAt']")).not.toBeNull();
    expect(dialog.querySelector("[name='leadId']")).toHaveProperty("type", "hidden");
    expect(dialog.querySelector("[name='createdBy']")).toBeNull();
    expect(dialog.querySelector("[name='opportunityId']")).toBeNull();
    expect(dialog.querySelector("[name='activityId']")).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Add activity" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/leads/${leadId}`));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows field validation while preserving entered create values", async () => {
    vi.mocked(createLeadActivityAction).mockResolvedValueOnce({
      status: "validation_error",
      message: "Check the highlighted activity fields.",
      fieldErrors: { subject: ["Subject is invalid"] },
    });
    renderTimeline();
    await userEvent.click(screen.getByRole("button", { name: "Add Activity" }));
    const dialog = screen.getByRole("dialog", { name: "Add Activity" });
    const subject = dialog.querySelector<HTMLInputElement>("[name='subject']")!;
    await userEvent.type(subject, "Keep this value");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add activity" }),
    );
    expect(await screen.findByText("Subject is invalid")).toBeDefined();
    expect(subject).toHaveProperty("value", "Keep this value");
    expect(document.activeElement).toBe(subject);
  });

  it("disables create submission while processing to prevent double submit", async () => {
    let resolveAction:
      | ((value: { status: "success"; activityId: string; leadId: string }) => void)
      | undefined;
    vi.mocked(createLeadActivityAction).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );
    renderTimeline();
    await userEvent.click(screen.getByRole("button", { name: "Add Activity" }));
    const dialog = screen.getByRole("dialog", { name: "Add Activity" });
    const form = dialog.querySelector("form")!;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: /Saving activity/ }),
      ).toHaveProperty("disabled", true),
    );
    expect(createLeadActivityAction).toHaveBeenCalledTimes(1);
    resolveAction?.({ status: "success", activityId, leadId });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("hydrates mutable edit values without immutable or legacy fields", async () => {
    vi.mocked(updateLeadActivityAction).mockResolvedValueOnce({
      status: "success",
      activityId,
      leadId,
    });
    renderTimeline();
    await userEvent.click(screen.getByRole("button", { name: "Edit activity" }));
    const dialog = screen.getByRole("dialog", { name: "Edit activity" });
    expect(within(dialog).getByRole("textbox", { name: "Subject" })).toHaveProperty(
      "value",
      "Discovery call",
    );
    expect(dialog.querySelector("[name='activityId']")).toHaveProperty("type", "hidden");
    expect(dialog.querySelector("[name='leadId']")).toBeNull();
    expect(dialog.querySelector("[name='createdBy']")).toBeNull();
    expect(dialog.querySelector("[name='opportunityId']")).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateLeadActivityAction).toHaveBeenCalledTimes(1));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("requires archive confirmation and has no hard-delete path", async () => {
    vi.mocked(archiveLeadActivityAction).mockResolvedValueOnce({
      status: "success",
      activityId,
      leadId,
    });
    renderTimeline();
    const archiveButtons = screen.getAllByRole("button", { name: "Archive activity" });
    await userEvent.click(archiveButtons[0]!);
    expect(archiveLeadActivityAction).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Archive this activity?" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Archive activity" }),
    );
    await waitFor(() => expect(archiveLeadActivityAction).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(archiveLeadActivityAction).mock.calls[0]?.[1];
    expect(submitted?.get("confirm")).toBe("true");
    expect(document.querySelector("[name='hardDelete']")).toBeNull();
  });

  it("shows archived management history, restore, and its empty state", async () => {
    vi.mocked(restoreLeadActivityAction).mockResolvedValueOnce({
      status: "success",
      activityId,
      leadId,
    });
    const archived = {
      ...activity,
      deletedAt: "2026-07-25T08:00:00.000Z",
    };
    const { rerender } = renderTimeline({
      archived: true,
      result: { ...result, items: [archived] },
    });
    await userEvent.click(screen.getByRole("button", { name: "Restore activity" }));
    await waitFor(() => expect(restoreLeadActivityAction).toHaveBeenCalledTimes(1));
    rerender(
      <LeadActivityTimeline
        actor={manager}
        archived
        canModifyLead
        defaultActivityAt="2026-07-24T10:00:00.000Z"
        leadId={leadId}
        nowIso="2026-07-24T10:00:00.000Z"
        result={{ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 }}
      />,
    );
    expect(screen.getByText("No archived activities")).toBeDefined();
  });

  it("does not grant controls to a representative without activity ownership", () => {
    renderTimeline({
      actor: representative,
      canModifyLead: true,
    });
    expect(screen.queryByRole("button", { name: "Edit activity" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Archive activity" })).toBeNull();
    expect(screen.queryByRole("link", { name: "View archived activities" })).toBeNull();
    expect(screen.getByText(/Server authorization remains authoritative/)).toBeDefined();
  });

  it("renders a safe timeline load error without raw details", () => {
    renderTimeline({ loadError: true, result: null });
    expect(screen.getByRole("alert").textContent).toContain(
      "Activities could not be loaded",
    );
    expect(screen.queryByText(/database secret/i)).toBeNull();
  });
});
