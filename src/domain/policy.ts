import type { Channel, NotificationType, Region } from "./types";

/**
 * A global policy denies a notification for everyone matching its scope.
 * Null fields act as wildcards, so a policy can target a whole type in a
 * region, a single channel everywhere, or any combination.
 */
export interface GlobalPolicy {
  id: string;
  notificationType: NotificationType | null;
  channel: Channel | null;
  region: Region | null;
  reason: string;
}

export interface PolicyTarget {
  notificationType: NotificationType;
  channel: Channel;
  region: Region;
}

export function policyMatches(policy: GlobalPolicy, target: PolicyTarget): boolean {
  if (policy.notificationType !== null && policy.notificationType !== target.notificationType) {
    return false;
  }
  if (policy.channel !== null && policy.channel !== target.channel) {
    return false;
  }
  if (policy.region !== null && policy.region !== target.region) {
    return false;
  }
  return true;
}

export function findBlockingPolicy(
  policies: GlobalPolicy[],
  target: PolicyTarget,
): GlobalPolicy | undefined {
  return policies.find((policy) => policyMatches(policy, target));
}
