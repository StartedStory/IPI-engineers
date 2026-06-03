export type Stage = 'intro' | 'tech' | 'final' | 'onboard';

export const STAGES: Stage[] = ['intro', 'tech', 'final', 'onboard'];

export const STAGE_COLOR: Record<Stage, string> = {
  intro: '#3b82f6',
  tech: '#8b5cf6',
  final: '#f59e0b',
  onboard: '#10b981',
};

export const STAGE_BG: Record<Stage, string> = {
  intro: 'bg-blue-100 text-blue-700 border-blue-200',
  tech: 'bg-violet-100 text-violet-700 border-violet-200',
  final: 'bg-amber-100 text-amber-700 border-amber-200',
  onboard: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export type Developer = {
  id: string;
  name: string;
  location: string;
  email: string;
  password: string;
  linkedin: string;
  cvFile: { filename: string; originalName: string } | null;
  createdAt: string;
};

export type EventItem = {
  id: string;
  developerId: string | null;
  developerName: string;
  interviewerName: string;
  recruiterName: string;
  start: string;
  end: string;
  timezone: string;
  meetingLink: string;
  jdLink: string;
  roleTitle: string;
  companyName: string;
  color: string;
  status: 'scheduled' | 'done' | 'cancelled';
  processStage: Stage;
  createdBy: string;
};

export type ProcessItem = {
  id: string;
  companyName: string;
  roleTitle: string;
  developerId: string | null;
  developerName: string;
  stage: Stage;
  interviewerName: string;
  brokerName: string;
  jdLink: string;
  notes: string;
  updatedAt: string;
};

export type Teammate = {
  id: string;
  role: 'bidder' | 'interviewer' | 'broker';
  name: string;
  email: string;
  telegram?: string;
  discord?: string;
  whatsapp?: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: 'manager' | 'bidder' | 'interviewer' | 'broker';
  createdAt: string;
};
