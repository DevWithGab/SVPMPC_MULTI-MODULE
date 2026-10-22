export const MEMBER_STANDING_LABELS = {
  excellent: 'Excellent', good: 'Good', fair: 'Fair', atRisk: 'At Risk', negativeBalance: 'Negative Balance',
};

export const getMemberStanding = (balance, minimumBalance = 1000) => {
  const value = Number(balance ?? 0);
  if (value < 0) return 'negativeBalance';
  if (value < minimumBalance) return 'atRisk';
  if (value >= 10000) return 'excellent';
  if (value >= 5000) return 'good';
  return 'fair';
};

export const getStandingLabel = (balance, minimumBalance = 1000) => MEMBER_STANDING_LABELS[getMemberStanding(balance, minimumBalance)];
