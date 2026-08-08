const WINDOW_MS = 60_000;
const COOLDOWN_MS = 5_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_TRACKED_ACTORS = 1_000;

type ActorWindow = {
  timestamps: number[];
};

export class ControlledAiActorRateLimiter {
  private readonly actors = new Map<string, ActorWindow>();

  consume(actorId: string, now = Date.now()): boolean {
    this.evictExpired(now);
    const existing = this.actors.get(actorId);
    const timestamps = (existing?.timestamps ?? []).filter(
      (timestamp) => now - timestamp < WINDOW_MS,
    );
    const last = timestamps.at(-1);

    if (
      (last !== undefined && now - last < COOLDOWN_MS) ||
      timestamps.length >= MAX_REQUESTS_PER_WINDOW
    ) {
      this.actors.set(actorId, { timestamps });
      return false;
    }

    timestamps.push(now);
    this.actors.set(actorId, { timestamps });
    this.enforceCapacity();
    return true;
  }

  reset(): void {
    this.actors.clear();
  }

  private evictExpired(now: number): void {
    for (const [actorId, window] of this.actors) {
      if (window.timestamps.every((timestamp) => now - timestamp >= WINDOW_MS)) {
        this.actors.delete(actorId);
      }
    }
  }

  private enforceCapacity(): void {
    while (this.actors.size > MAX_TRACKED_ACTORS) {
      const oldestActorId = this.actors.keys().next().value;
      if (oldestActorId === undefined) return;
      this.actors.delete(oldestActorId);
    }
  }
}

export const controlledAiActorRateLimiter = new ControlledAiActorRateLimiter();

// Backward-compatible names keep the Phase 1A surface stable while both
// controlled AI slices share one actor-keyed abuse-protection budget.
export const CompanyIntelligenceRateLimiter = ControlledAiActorRateLimiter;
export const companyIntelligenceRateLimiter = controlledAiActorRateLimiter;
