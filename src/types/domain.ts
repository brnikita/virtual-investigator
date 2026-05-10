// Domain types shared between server and client. Mirror the database schema
// (see supabase/migrations) but kept in plain TS so we don't depend on
// generated types at design time.

export type Locale = 'ru' | 'en';

export interface Case {
  id: string;
  ownerId: string;
  suspectName: string;
  language: Locale;
  status: 'draft' | 'interviewing' | 'ready' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface Interview {
  id: string;
  caseId: string;
  status: 'pending' | 'active' | 'completed' | 'aborted';
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  costEstimateUsd: number | null;
}

export interface Message {
  id: string;
  interviewId: string;
  role: 'detective' | 'suspect' | 'system' | 'tool';
  content: string;
  audioPath: string | null;
  toolName: string | null;
  toolPayload: Record<string, unknown> | null;
  createdAt: string;
}

export interface EvidenceRow {
  id: string;
  caseId: string;
  category: 'identity' | 'appearance' | 'observations' | 'funny_facts' | 'exhibits';
  key: string;
  valueText: string | null;
  valueNumber: number | null;
  valueJson: unknown;
  confidence: number;
  source: 'interview' | 'upload' | 'manual';
}

export interface Attachment {
  id: string;
  caseId: string;
  kind: 'suspect_photo' | 'generated_portrait' | 'exhibit';
  storagePath: string;
  mimeType: string;
  width: number | null;
  height: number | null;
}

export interface DossierPayload {
  language: Locale;
  headline: string;
  subheadline: string;
  identity: Record<string, string>;
  observations: string[];
  scales: Array<{ label: string; value: number; max: number }>;
  exhibits: string[];
  last_seen: string;
  conclusion: string;
}

export interface Dossier {
  id: string;
  caseId: string;
  payload: DossierPayload;
  imageAttachmentId: string | null;
  pdfPath: string | null;
  version: number;
  updatedAt: string;
}
