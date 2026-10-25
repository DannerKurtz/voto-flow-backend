import type { ResultIdentity } from '../repositories/result-repository.js';
import type { PresidentialComparisonService } from '../services/presidential-comparison-service.js';
import type { SubscriptionHub } from '../websocket/subscription-hub.js';

export async function publishSecondRoundComparisonUpdate(
  identity: ResultIdentity,
  service: Pick<PresidentialComparisonService, 'matches' | 'current'>,
  subscriptionHub: Pick<SubscriptionHub, 'publishSecondRoundComparison'>,
): Promise<void> {
  if (!service.matches(identity)) return;
  const comparison = await service.current(identity.scopeCode);
  if (comparison) subscriptionHub.publishSecondRoundComparison(identity.scopeCode, comparison);
}
