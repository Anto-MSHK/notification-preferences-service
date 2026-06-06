import { evaluate, type EvaluationContext } from "../domain/evaluation";
import type { Channel, EvaluationResult, NotificationType, Region } from "../domain/types";
import type { Logger } from "../domain/ports/logger";
import type { UnitOfWork } from "../domain/ports/repositories";

export interface EvaluateInput {
  userId: string;
  notificationType: NotificationType;
  channel: Channel;
  region: Region;
  at: Date;
}

export interface EvaluationService {
  evaluate(input: EvaluateInput): Promise<EvaluationResult>;
}

export function createEvaluationService(uow: UnitOfWork, logger: Logger): EvaluationService {
  async function run(input: EvaluateInput): Promise<EvaluationResult> {
    const { userId, notificationType, channel, region, at } = input;

    const [defaults, userOverrides, quietHours, policies] = await Promise.all([
      uow.defaults.list(),
      uow.userPreferences.listByUser(userId),
      uow.quietHours.findByUser(userId),
      uow.policies.findMatching(notificationType, channel, region),
    ]);

    const context: EvaluationContext = { defaults, userOverrides, quietHours, policies };
    const result = evaluate({ notificationType, channel, region, at }, context);

    logger.info(
      {
        userId,
        notificationType,
        channel,
        region,
        decision: result.decision,
        reason: result.reason,
      },
      "evaluation.decided",
    );

    return result;
  }

  return { evaluate: run };
}
