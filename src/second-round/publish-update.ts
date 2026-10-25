import type { ResultIdentity } from '../repositories/result-repository.js';
import type { PresidentialComparisonService } from '../services/presidential-comparison-service.js';
import type { SubscriptionHub } from '../websocket/subscription-hub.js';
import type { GovernorResultsService } from '../services/governor-results-service.js';

export async function publishSecondRoundComparisonUpdate(
  identity: ResultIdentity,
  service: Pick<PresidentialComparisonService, 'matches' | 'current'>,
  subscriptionHub: Pick<SubscriptionHub, 'publishSecondRoundComparison'>,
): Promise<void> {
  if (!service.matches(identity)) return;
  const comparison = await service.current(identity.scopeCode);
  if (comparison) subscriptionHub.publishSecondRoundComparison(identity.scopeCode, comparison);
}

export async function publishSecondRoundGovernorUpdate(
  identity: ResultIdentity,
  service: Pick<GovernorResultsService, 'matches' | 'current'>,
  subscriptionHub: Pick<SubscriptionHub, 'publishSecondRoundGovernor'>,
): Promise<void> {
  if (!service.matches(identity)) return;
  const result = await service.current(identity.scopeCode);
  if (result) subscriptionHub.publishSecondRoundGovernor(identity.scopeCode, result);
}
