import type { Pool } from "pg";
import type { UnitOfWork } from "../../domain/ports/repositories";
import { createDefaultPreferenceRepository } from "./repositories/defaultPreferenceRepository";
import { createUserPreferenceRepository } from "./repositories/userPreferenceRepository";
import { createQuietHoursRepository } from "./repositories/quietHoursRepository";
import { createGlobalPolicyRepository } from "./repositories/globalPolicyRepository";

export function createUnitOfWork(pool: Pool): UnitOfWork {
  return {
    defaults: createDefaultPreferenceRepository(pool),
    userPreferences: createUserPreferenceRepository(pool),
    quietHours: createQuietHoursRepository(pool),
    policies: createGlobalPolicyRepository(pool),
  };
}
