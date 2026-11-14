// Every gated-later feature has an ID and a tier. While PRO_GATING is false,
// everything is on and no "Pro" label appears anywhere. Before release: set
// PRO_GATING = true and pass the user's plan. UI code only ever calls
// isEnabled(id), so turning gating on needs no screen changes.

export type FeatureId = 'fixLoop' | 'retests' | 'weakTopics' | 'weeklyReport' | 'ankiConnect'
export type Tier = 'free' | 'pro'

export const FEATURES: Record<FeatureId, Tier> = {
  fixLoop: 'pro',
  retests: 'pro',
  weakTopics: 'pro',
  weeklyReport: 'pro',
  ankiConnect: 'free',
}

export const PRO_GATING = false

export function isEnabled(id: FeatureId, plan: Tier = 'free'): boolean {
  if (!PRO_GATING) return true
  return FEATURES[id] === 'free' || plan === 'pro'
}
