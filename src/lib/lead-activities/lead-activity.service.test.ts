import { describe, expect, it, vi } from "vitest";
import {
  LeadActivityPermissionError,
  LeadActivityService,
  LeadActivityValidationError,
} from "./lead-activity.service";
import type { LeadActivityActor } from "./lead-activity.types";

const representative: LeadActivityActor = {
  userId: "33333333-3333-4333-8333-333333333333",
  role: "sales_representative",
  isActive: true,
};
const manager: LeadActivityActor = {
  userId: "44444444-4444-4444-8444-444444444444",
  role: "sales_manager",
  isActive: true,
};
const leadId = "22222222-2222-4222-8222-222222222222";
const activity = {
  id: "11111111-1111-4111-8111-111111111111",
  leadId,
  activityType: "call" as const,
  subject: "Discovery call",
  description: null,
  activityAt: "2026-07-24T01:00:00.000Z",
  nextFollowUpAt: null,
  outcome: null,
  createdBy: representative.userId,
  assignedTo: null,
  createdAt: "2026-07-24T01:01:00.000Z",
  updatedAt: "2026-07-24T01:01:00.000Z",
  deletedAt: null,
};

function activityRepository(overrides: Record<string, unknown> = {}) {
  return {
    create: vi.fn().mockResolvedValue(activity),
    getById: vi.fn().mockResolvedValue(activity),
    listByLead: vi.fn().mockResolvedValue({
      items: [activity],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    }),
    update: vi.fn().mockResolvedValue(activity),
    softDelete: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    listArchived: vi.fn().mockResolvedValue({
      items: [activity],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    }),
    ...overrides,
  };
}

function leadRepository(
  canAccess = true,
  canModify = true,
) {
  return {
    canAccess: vi.fn().mockResolvedValue(canAccess),
    canModify: vi.fn().mockResolvedValue(canModify),
  };
}

describe("LeadActivityService", () => {
  it("binds created_by to the actor after parent Lead authorization", async () => {
    const repository = activityRepository();
    const leads = leadRepository();
    const service = new LeadActivityService(repository as never, leads as never);
    await expect(
      service.create(
        { leadId, activityType: "note", description: "Context" },
        representative,
      ),
    ).resolves.toEqual(activity);
    expect(leads.canModify).toHaveBeenCalledWith(leadId);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ leadId, activityType: "note" }),
      representative.userId,
    );
  });

  it("denies an unauthorized parent Lead on create and list", async () => {
    const repository = activityRepository();
    const service = new LeadActivityService(
      repository as never,
      leadRepository(false, false) as never,
    );
    await expect(
      service.create({ leadId, activityType: "call" }, representative),
    ).rejects.toBeInstanceOf(LeadActivityPermissionError);
    await expect(
      service.listByLead(leadId, {}, representative),
    ).rejects.toBeInstanceOf(LeadActivityPermissionError);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.listByLead).not.toHaveBeenCalled();
  });

  it("denies inactive actors and invalid input", async () => {
    const service = new LeadActivityService(
      activityRepository() as never,
      leadRepository() as never,
    );
    await expect(
      service.listByLead(leadId, {}, { ...representative, isActive: false }),
    ).rejects.toBeInstanceOf(LeadActivityPermissionError);
    await expect(
      service.create(
        { leadId, activityType: "sms" as "call" },
        representative,
      ),
    ).rejects.toBeInstanceOf(LeadActivityValidationError);
  });

  it("prevents representatives assigning activities to another user", async () => {
    const service = new LeadActivityService(
      activityRepository() as never,
      leadRepository() as never,
    );
    await expect(
      service.create(
        {
          leadId,
          activityType: "follow_up",
          assignedTo: manager.userId,
        },
        representative,
      ),
    ).rejects.toBeInstanceOf(LeadActivityPermissionError);
  });

  it("requires activity ownership as well as parent Lead modify access", async () => {
    const repository = activityRepository({
      getById: vi.fn().mockResolvedValue({
        ...activity,
        createdBy: manager.userId,
        assignedTo: null,
      }),
    });
    const service = new LeadActivityService(
      repository as never,
      leadRepository() as never,
    );
    await expect(
      service.update(activity.id, { outcome: "Changed" }, representative),
    ).rejects.toBeInstanceOf(LeadActivityPermissionError);
    await expect(
      service.softDelete(activity.id, representative),
    ).rejects.toBeInstanceOf(LeadActivityPermissionError);
  });

  it("allows the creator to update and soft delete an activity", async () => {
    const repository = activityRepository();
    const service = new LeadActivityService(
      repository as never,
      leadRepository() as never,
    );
    await expect(
      service.update(activity.id, { outcome: "Qualified" }, representative),
    ).resolves.toEqual(activity);
    await expect(
      service.softDelete(activity.id, representative),
    ).resolves.toEqual(activity);
  });

  it("keeps archived listing and restore management-only", async () => {
    const repository = activityRepository();
    const service = new LeadActivityService(
      repository as never,
      leadRepository() as never,
    );
    await expect(
      service.listArchived({}, representative),
    ).rejects.toBeInstanceOf(LeadActivityPermissionError);
    await expect(
      service.restore(activity.id, representative),
    ).rejects.toBeInstanceOf(LeadActivityPermissionError);
    await expect(service.listArchived({}, manager)).resolves.toMatchObject({
      total: 1,
    });
    await expect(service.restore(activity.id, manager)).resolves.toEqual(activity);
  });
});
