export const profileFields = {
  user: [
    'role',
    'professionalBackground',
    'expertise',
    'currentProjects',
    'recurringThemes',
    'publicPersonalContext',
    'publicTopics',
  ],
  company: [
    'name',
    'description',
    'positioning',
    'targetCustomers',
    'product',
    'stage',
    'businessModel',
    'terminology',
    'framingsToAvoid',
    'beliefs',
    'priorities',
    'misconceptions',
    'approvedClaims',
    'goals',
  ],
  strategy: [
    'primaryGoals',
    'secondaryGoals',
    'targetAudiences',
    'desiredReputation',
    'contentMix',
    'emphasizeTopics',
    'avoidTopics',
    'promotionLevel',
    'personalContentLevel',
    'personality',
    'ctaPhilosophy',
  ],
  preferences: ['contentToAvoid', 'contentToPrefer', 'additionalInstructions'],
} as const;
export type ProfileKind = keyof typeof profileFields;
export const profileTitles: Record<ProfileKind, string> = {
  user: 'About me',
  company: 'About my company',
  strategy: 'Social strategy',
  preferences: 'Content preferences',
};
export const fieldLabel = (field: string) =>
  field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
