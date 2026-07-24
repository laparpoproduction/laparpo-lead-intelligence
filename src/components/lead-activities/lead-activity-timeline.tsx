import Link from "next/link";
import { LeadActivityArchiveDialog } from "./lead-activity-archive-dialog";
import { LeadActivityForm } from "./lead-activity-form";
import { LeadActivityRestoreButton } from "./lead-activity-restore-button";
import {
  canCreateLeadActivity,
  canInspectArchivedLeadActivities,
  canModifyLeadActivity,
  followUpState,
  humanizeActivityType,
} from "@/lib/lead-activities/lead-activity-ui";
import type {
  LeadActivity,
  LeadActivityActor,
  PaginatedLeadActivities,
} from "@/lib/lead-activities/lead-activity.types";

const dateTime = new Intl.DateTimeFormat("en-MY", {
  dateStyle: "medium",
  timeStyle: "short",
});

const typeClasses: Record<LeadActivity["activityType"], string> = {
  call: "border-sky-200 bg-sky-50 text-sky-800",
  meeting: "border-violet-200 bg-violet-50 text-violet-800",
  note: "border-zinc-200 bg-zinc-100 text-zinc-700",
  email: "border-blue-200 bg-blue-50 text-blue-800",
  whatsapp: "border-emerald-200 bg-emerald-50 text-emerald-800",
  follow_up: "border-amber-200 bg-amber-50 text-amber-800",
  quotation: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  deposit: "border-teal-200 bg-teal-50 text-teal-800",
  status_change: "border-orange-200 bg-orange-50 text-orange-800",
};

function compactIdentity(value: string, actor: LeadActivityActor): string {
  return value === actor.userId ? "You" : value;
}

function TimelinePagination({
  archived,
  leadId,
  page,
  totalPages,
}: {
  archived: boolean;
  leadId: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const base = archived
    ? `/leads/${leadId}/activities/archived`
    : `/leads/${leadId}`;
  const href = (nextPage: number) =>
    nextPage === 1
      ? base
      : `${base}?${archived ? "page" : "activityPage"}=${nextPage}`;
  return (
    <nav
      aria-label={archived ? "Archived activity pages" : "Activity pages"}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-zinc-500">
        Page <strong className="text-zinc-800">{page}</strong> of{" "}
        <strong className="text-zinc-800">{totalPages}</strong>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {page > 1 ? (
          <Link
            aria-label="Newer activity page"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 text-sm font-bold text-zinc-700"
            href={href(page - 1)}
          >
            Newer
          </Link>
        ) : (
          <span />
        )}
        {page < totalPages ? (
          <Link
            aria-label="Older activity page"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 text-sm font-bold text-zinc-700"
            href={href(page + 1)}
          >
            Older
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

function ActivityCard({
  activity,
  actor,
  archived,
  canModifyLead,
  defaultActivityAt,
  nowIso,
}: {
  activity: LeadActivity;
  actor: LeadActivityActor;
  archived: boolean;
  canModifyLead: boolean;
  defaultActivityAt: string;
  nowIso: string;
}) {
  const followUp = followUpState(activity.nextFollowUpAt, nowIso);
  const canModify = canModifyLeadActivity(activity, actor, canModifyLead);
  const subject =
    activity.subject ?? humanizeActivityType(activity.activityType);
  return (
    <li className="relative pl-8 sm:pl-10">
      <span
        aria-hidden="true"
        className="absolute left-[0.44rem] top-7 size-3 rounded-full border-2 border-white bg-[#e5222a] shadow ring-2 ring-red-100 sm:left-[0.55rem]"
      />
      <article className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${typeClasses[activity.activityType]}`}
            >
              {humanizeActivityType(activity.activityType)}
            </span>
            <h3 className="mt-3 break-words text-base font-black text-zinc-950">
              {subject}
            </h3>
          </div>
          <time
            className="shrink-0 text-sm font-semibold text-zinc-500"
            dateTime={activity.activityAt}
          >
            {dateTime.format(new Date(activity.activityAt))}
          </time>
        </div>

        {activity.description ? (
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700 [overflow-wrap:anywhere]">
            {activity.description}
          </p>
        ) : null}

        <dl className="mt-5 grid gap-4 border-t border-zinc-100 pt-4 text-sm sm:grid-cols-2">
          {activity.outcome ? (
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">
                Outcome
              </dt>
              <dd className="mt-1 break-words font-semibold text-zinc-800">
                {activity.outcome}
              </dd>
            </div>
          ) : null}
          {activity.nextFollowUpAt ? (
            <div
              className={`rounded-xl border p-3 ${
                followUp === "overdue"
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <dt
                className={`text-xs font-black uppercase tracking-[0.08em] ${
                  followUp === "overdue" ? "text-red-700" : "text-amber-700"
                }`}
              >
                {followUp === "overdue"
                  ? "Overdue follow-up"
                  : "Upcoming follow-up"}
              </dt>
              <dd className="mt-1 font-bold text-zinc-900">
                <time dateTime={activity.nextFollowUpAt}>
                  {dateTime.format(new Date(activity.nextFollowUpAt))}
                </time>
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">
              Assigned to
            </dt>
            <dd className="mt-1 break-all text-zinc-700">
              {activity.assignedTo
                ? compactIdentity(activity.assignedTo, actor)
                : "Unassigned"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">
              Created by
            </dt>
            <dd className="mt-1 break-all text-zinc-700">
              {compactIdentity(activity.createdBy, actor)}
            </dd>
          </div>
        </dl>

        {archived ? (
          <div className="mt-5 flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">
              Archived{" "}
              {activity.deletedAt
                ? dateTime.format(new Date(activity.deletedAt))
                : ""}
            </p>
            <LeadActivityRestoreButton activityId={activity.id} />
          </div>
        ) : canModify ? (
          <div className="mt-5 flex flex-col gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end">
            <LeadActivityForm
              activity={activity}
              actor={actor}
              defaultActivityAt={defaultActivityAt}
              leadId={activity.leadId}
              mode="edit"
            />
            <LeadActivityArchiveDialog
              activityId={activity.id}
              subject={subject}
            />
          </div>
        ) : (
          <p className="mt-5 border-t border-zinc-100 pt-4 text-xs font-semibold text-zinc-400">
            Activity controls are unavailable. Server authorization remains
            authoritative.
          </p>
        )}
      </article>
    </li>
  );
}

export function LeadActivityTimeline({
  actor,
  archived = false,
  canModifyLead,
  defaultActivityAt,
  leadId,
  loadError = false,
  nowIso,
  result,
}: {
  actor: LeadActivityActor;
  archived?: boolean;
  canModifyLead: boolean;
  defaultActivityAt: string;
  leadId: string;
  loadError?: boolean;
  nowIso: string;
  result: Pick<
    PaginatedLeadActivities,
    "items" | "page" | "pageSize" | "total" | "totalPages"
  > | null;
}) {
  const canCreate = canCreateLeadActivity(canModifyLead) && !archived;
  const canInspectArchived = canInspectArchivedLeadActivities(actor);

  return (
    <section aria-labelledby="activity-timeline-title" className="space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-lg font-black text-zinc-950" id="activity-timeline-title">
            {archived ? "Archived activities" : "Activity timeline"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {archived
              ? "Management-only activity history available for recovery."
              : "Newest activity first. Follow-ups use the current server time."}
          </p>
          {result ? (
            <p className="mt-2 text-xs font-semibold text-zinc-400">
              {result.total} {result.total === 1 ? "activity" : "activities"}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {canCreate && result?.items.length ? (
            <LeadActivityForm
              actor={actor}
              defaultActivityAt={defaultActivityAt}
              leadId={leadId}
              mode="create"
            />
          ) : null}
          {!archived && canInspectArchived ? (
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-bold text-zinc-600 hover:bg-zinc-100"
              href={`/leads/${leadId}/activities/archived`}
            >
              View archived activities
            </Link>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
          role="alert"
        >
          <h3 className="font-black text-red-900">
            Activities could not be loaded
          </h3>
          <p className="mt-2 text-sm leading-6 text-red-800">
            Refresh the page. If the issue continues, contact an administrator.
          </p>
        </div>
      ) : result?.items.length === 0 ? (
        <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center">
          <div className="max-w-sm">
            <h3 className="font-black text-zinc-950">
              {archived ? "No archived activities" : "No activities yet"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {archived
                ? "This Lead has no archived activity history."
                : canCreate
                  ? "Add the first activity to start the Lead history and plan the next follow-up."
                  : "Activity history will appear here when an authorized team member adds it."}
            </p>
            {canCreate ? (
              <div className="mt-5">
                <LeadActivityForm
                  actor={actor}
                  defaultActivityAt={defaultActivityAt}
                  leadId={leadId}
                  mode="create"
                  triggerLabel="Add the first activity"
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : result ? (
        <>
          <ol className="relative space-y-4 before:absolute before:bottom-7 before:left-[0.78rem] before:top-7 before:w-px before:bg-zinc-200 sm:before:left-[0.91rem]">
            {result.items.map((activity) => (
              <ActivityCard
                activity={activity}
                actor={actor}
                archived={archived}
                canModifyLead={canModifyLead}
                defaultActivityAt={defaultActivityAt}
                key={activity.id}
                nowIso={nowIso}
              />
            ))}
          </ol>
          <TimelinePagination
            archived={archived}
            leadId={leadId}
            page={result.page}
            totalPages={result.totalPages}
          />
        </>
      ) : null}
    </section>
  );
}
