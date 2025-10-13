export type IssueType = 'memo' | 'task';

export type TaskStatus =
  | 'open'
  | 'next'
  | 'waiting'
  | 'scheduled'
  | 'done'
  | 'canceled';

export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

export interface IssueBase extends Timestamped {
  id: number;
  type: IssueType;
  title: string | null;
  bodyMd: string;
  status: TaskStatus | null;
  scheduledOn: string | null;
  meta: unknown;
  isBookmarked: boolean;
  isDeleted: boolean;
}

export interface Memo extends IssueBase {
  type: 'memo';
  title: null;
  status: null;
  scheduledOn: null;
}

export interface Task extends IssueBase {
  type: 'task';
  title: string;
  status: TaskStatus;
}

export type Issue = Memo | Task;

export interface Comment extends Timestamped {
  id: number;
  issueId: number;
  bodyMd: string;
  isDeleted: boolean;
}

export interface Label {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface Link {
  id: number;
  sourceIssueId: number;
  targetIssueId: number;
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';
  createdAt: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface ProjectItem extends Timestamped {
  id: number;
  projectId: number;
  issueId: number;
  position: number;
  viewMeta: unknown;
}

export const toBoolean = (value: number | boolean): boolean =>
  typeof value === 'boolean' ? value : value !== 0;

export const nowIso = (): string => new Date().toISOString();
