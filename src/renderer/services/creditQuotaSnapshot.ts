import type { LowCreditPurchaseOffer, ProfileSummary } from '../store/slices/authSlice';

export interface CreditQuotaSnapshot {
  creditsRemaining: number;
}

export const getCreditQuotaSnapshot = (
  purchaseOffer: LowCreditPurchaseOffer | null | undefined,
  profileSummary?: ProfileSummary | null,
): CreditQuotaSnapshot | null => {
  const creditsRemaining = [profileSummary?.totalCreditsRemaining, purchaseOffer?.creditsRemaining]
    .find(value => typeof value === 'number' && Number.isFinite(value));
  return typeof creditsRemaining === 'number'
    ? { creditsRemaining: Math.max(0, creditsRemaining) }
    : null;
};
