/**
 * Activation scoring (pure). A user is "activated" once they have discovered AND
 * retained value: completed onboarding and saved at least one winner. The score
 * (0–100) is for dashboards/funnels; `activated` is the binary activation metric.
 */
export interface ActivationInputs {
  onboardingCompleted: boolean;
  bookmarkCount: number;
  isPaid: boolean;
}

export interface ActivationMilestone {
  key: "onboarding" | "bookmark" | "upgrade";
  done: boolean;
  points: number;
}

export interface ActivationState {
  score: number;
  activated: boolean;
  milestones: ActivationMilestone[];
}

const WEIGHTS = { onboarding: 40, bookmark: 35, upgrade: 25 } as const;

export function computeActivation(i: ActivationInputs): ActivationState {
  const milestones: ActivationMilestone[] = [
    { key: "onboarding", done: i.onboardingCompleted, points: WEIGHTS.onboarding },
    { key: "bookmark", done: i.bookmarkCount > 0, points: WEIGHTS.bookmark },
    { key: "upgrade", done: i.isPaid, points: WEIGHTS.upgrade },
  ];
  const score = milestones.reduce((s, m) => s + (m.done ? m.points : 0), 0);
  const activated = i.onboardingCompleted && i.bookmarkCount > 0;
  return { score, activated, milestones };
}
