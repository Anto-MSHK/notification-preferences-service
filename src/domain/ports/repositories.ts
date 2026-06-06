import type { GlobalPolicy } from "../policy";
import type { DefaultPreference, UserPreference } from "../preferences";
import type { QuietHours } from "../quietHours";
import type { Channel, NotificationType, Region } from "../types";

export interface PreferenceUpsert {
  notificationType: NotificationType;
  channel: Channel;
  enabled: boolean;
}

export interface DefaultPreferenceRepository {
  list(): Promise<DefaultPreference[]>;
}

export interface UserPreferenceRepository {
  listByUser(userId: string): Promise<UserPreference[]>;
  /**
   * Idempotent upsert: applying the same change twice yields the same state.
   */
  upsertMany(userId: string, changes: PreferenceUpsert[]): Promise<UserPreference[]>;
}

export interface QuietHoursRepository {
  findByUser(userId: string): Promise<QuietHours | null>;
  /** Idempotent: replaces the user's quiet hours with the given window. */
  set(userId: string, quietHours: QuietHours | null): Promise<void>;
}

export interface GlobalPolicyRepository {
  list(): Promise<GlobalPolicy[]>;
  findMatching(
    notificationType: NotificationType,
    channel: Channel,
    region: Region,
  ): Promise<GlobalPolicy[]>;
}

export interface UnitOfWork {
  defaults: DefaultPreferenceRepository;
  userPreferences: UserPreferenceRepository;
  quietHours: QuietHoursRepository;
  policies: GlobalPolicyRepository;
}
