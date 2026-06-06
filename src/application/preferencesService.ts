import { resolvePreferences, type UserPreferences } from "../domain/preferences";
import type { QuietHours } from "../domain/quietHours";
import type { Logger } from "../domain/ports/logger";
import type { PreferenceUpsert, UnitOfWork } from "../domain/ports/repositories";

export interface UpdatePreferencesInput {
  preferences?: PreferenceUpsert[];
  /**
   * Absent key means "leave quiet hours unchanged". An explicit `null` clears
   * them. A value replaces them.
   */
  quietHours?: QuietHours | null;
}

export interface PreferencesService {
  getPreferences(userId: string): Promise<UserPreferences>;
  updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<UserPreferences>;
}

export function createPreferencesService(uow: UnitOfWork, logger: Logger): PreferencesService {
  async function getPreferences(userId: string): Promise<UserPreferences> {
    const [defaults, userOverrides, quietHours] = await Promise.all([
      uow.defaults.list(),
      uow.userPreferences.listByUser(userId),
      uow.quietHours.findByUser(userId),
    ]);

    return {
      userId,
      preferences: resolvePreferences(defaults, userOverrides),
      quietHours,
    };
  }

  async function updatePreferences(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<UserPreferences> {
    const quietHoursChanged = "quietHours" in input;

    if (input.preferences && input.preferences.length > 0) {
      await uow.userPreferences.upsertMany(userId, input.preferences);
    }
    if (quietHoursChanged) {
      await uow.quietHours.set(userId, input.quietHours ?? null);
    }

    logger.info(
      {
        userId,
        changedPreferences: input.preferences?.length ?? 0,
        quietHoursChanged,
      },
      "preferences.updated",
    );

    return getPreferences(userId);
  }

  return { getPreferences, updatePreferences };
}
