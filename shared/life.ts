// The biographical taxonomy — 12 life-event categories (and subcategories),
// each with a canonical prompt. Shared by server + app. NOT a preference axis;
// this is the mindfile's identity/memory layer.

export interface LifeCategory {
  id: string;
  label: string;
  question: string;
  subcategories: string[];
}

export const LIFE_CATEGORIES: LifeCategory[] = [
  { id: 'origins', label: 'Origins & early life', question: 'Where were you born, and who raised you?',
    subcategories: ['Birthplace', 'Childhood home', 'Family of origin', 'Languages', 'Siblings'] },
  { id: 'family', label: 'Family', question: 'Who are your closest family — partners, children, kin?',
    subcategories: ['Marriage', 'Divorce', 'Children', 'Adoption', 'Caregiving', 'Extended family'] },
  { id: 'romantic', label: 'Romantic & partners', question: 'What major relationships have shaped your life?',
    subcategories: ['Long-term partner', 'Dating history', 'Separation', 'Widowhood', 'Relationship model'] },
  { id: 'place', label: 'Home & place', question: 'What places have been most important to you?',
    subcategories: ['Moves', 'Immigration', 'Neighborhoods', 'Homes owned/rented', 'Places that feel like home'] },
  { id: 'education', label: 'Education & learning', question: 'What learning experiences changed you?',
    subcategories: ['Schools', 'Degrees', 'Mentors', 'Self-education', 'Certifications', 'Formative subjects'] },
  { id: 'career', label: 'Work & career', question: 'What were the major chapters of your working life?',
    subcategories: ['First job', 'Career changes', 'Companies', 'Roles', 'Entrepreneurship', 'Retirement'] },
  { id: 'health', label: 'Health & body', question: 'Have any major health events shaped your path?',
    subcategories: ['Illness', 'Injury', 'Disability', 'Fitness', 'Pregnancy', 'Aging', 'Medical milestones'] },
  { id: 'emotional', label: 'Mental & emotional life', question: 'What periods of emotional change or recovery have you had?',
    subcategories: ['Therapy', 'Grief', 'Burnout', 'Recovery', 'Confidence', 'Self-image', 'Emotional patterns'] },
  { id: 'loss', label: 'Loss, grief & trauma', question: 'What losses have shaped you?',
    subcategories: ['Deaths', 'Breakups', 'Accidents', 'Disasters', 'Estrangement', 'Major disappointments'] },
  { id: 'money', label: 'Money & material life', question: 'What major financial events have affected your life?',
    subcategories: ['First income', 'Debt', 'Assets', 'Business ownership', 'Inheritance', 'Hardship'] },
  { id: 'community', label: 'Community & belonging', question: 'What communities have you belonged to?',
    subcategories: ['Friends', 'Mentors', 'Collaborators', 'Faith/community', 'Online communities', 'Citizenship', 'Chosen family'] },
  { id: 'achievements', label: 'Achievements & identity chapters', question: 'What chapters or projects define who you are?',
    subcategories: ['Creative work', 'Awards', 'Publications', 'Adventures', 'Reinventions', 'Life missions'] },
];

export const PRIVACY_LEVELS = ['private', 'sensitive', 'public'] as const;
export type Privacy = (typeof PRIVACY_LEVELS)[number];

export interface LifeEvent {
  id: string;
  schema_version: number;
  category: string;
  subcategory: string | null;
  title: string;
  detail: string | null;
  date_start: string | null;
  date_end: string | null;
  ongoing: number;
  people: string | null;
  place: string | null;
  significance: number | null;
  privacy: Privacy;
  status: 'past' | 'current';
  created_at: string;
  updated_at: string | null;
}

export interface LifeEventInput {
  category: string;
  subcategory?: string | null;
  title: string;
  detail?: string | null;
  date_start?: string | null;
  date_end?: string | null;
  ongoing?: boolean;
  people?: string | null;
  place?: string | null;
  significance?: number | null;
  privacy?: Privacy;
  status?: 'past' | 'current';
}
