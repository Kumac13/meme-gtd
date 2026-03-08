import Database from 'better-sqlite3';
import { createActivityLog } from 'meme-gtd-db';
import type {
  EventType,
  SourceType,
  TaskStatus,
  IssueType,
} from 'meme-gtd-shared';
import {
  buildTaskCreatedPayload,
  buildTaskStatusChangedPayload,
  buildLabelAssignedPayload,
  buildProjectItemAddedPayload,
  buildCommentCreatedPayload,
  buildLinkCreatedPayload,
  buildMemoPromotedPayload,
  buildArticleCreatedPayload,
  getIssueTitle,
  getIssueType,
  getLabelName,
  getProjectName,
  getProjectSnapshots,
  getLabelSnapshots,
} from './payload-builder.js';

/**
 * ActivityLogger provides a unified interface for recording activity log events.
 * It wraps the payload builders and createActivityLog function.
 */
export class ActivityLogger {
  constructor(
    private readonly db: Database.Database,
    private readonly sourceType: SourceType = 'api'
  ) {}

  // ============================================================
  // Task Events
  // ============================================================

  logTaskCreated(
    taskId: number,
    title: string,
    status: TaskStatus,
    scheduledStart?: string | null,
    isAllDay?: boolean
  ): void {
    const payload = buildTaskCreatedPayload(
      this.db,
      taskId,
      title,
      status,
      scheduledStart,
      isAllDay
    );
    createActivityLog(this.db, {
      eventType: 'task.created',
      sourceType: this.sourceType,
      payload: { ...payload },
    });
  }

  logTaskUpdated(
    taskId: number,
    diff: {
      title?: { old: string | null; new: string | null };
      body?: { old: string | null; new: string | null };
    }
  ): void {
    createActivityLog(this.db, {
      eventType: 'task.updated',
      sourceType: this.sourceType,
      payload: {
        issue_id: taskId,
        issue_type: 'task',
        title: diff.title,
        body: diff.body,
      },
    });
  }

  logTaskStatusChanged(
    taskId: number,
    fromStatus: TaskStatus,
    toStatus: TaskStatus
  ): void {
    const payload = buildTaskStatusChangedPayload(
      this.db,
      taskId,
      fromStatus,
      toStatus
    );
    createActivityLog(this.db, {
      eventType: 'task.status_changed',
      sourceType: this.sourceType,
      payload: { ...payload },
    });
  }

  logTaskDeleted(taskId: number): void {
    createActivityLog(this.db, {
      eventType: 'task.deleted',
      sourceType: this.sourceType,
      payload: {
        issue_id: taskId,
        issue_type: 'task',
        title: getIssueTitle(this.db, taskId),
      },
    });
  }

  logTaskBookmarked(taskId: number, isBookmarked: boolean): void {
    createActivityLog(this.db, {
      eventType: 'task.bookmarked',
      sourceType: this.sourceType,
      payload: {
        issue_id: taskId,
        issue_type: 'task',
        title: getIssueTitle(this.db, taskId),
        is_bookmarked: isBookmarked,
      },
    });
  }

  // ============================================================
  // Memo Events
  // ============================================================

  logMemoCreated(memoId: number, bodyMd: string): void {
    createActivityLog(this.db, {
      eventType: 'memo.created',
      sourceType: this.sourceType,
      payload: {
        issue_id: memoId,
        issue_type: 'memo',
        body: bodyMd,
        labels: getLabelSnapshots(this.db, memoId),
        projects: getProjectSnapshots(this.db, memoId),
      },
    });
  }

  logMemoUpdated(memoId: number, diff: { old: string | null; new: string | null }): void {
    createActivityLog(this.db, {
      eventType: 'memo.updated',
      sourceType: this.sourceType,
      payload: {
        issue_id: memoId,
        issue_type: 'memo',
        body: {
          old: diff.old,
          new: diff.new,
        },
      },
    });
  }

  logMemoPromoted(
    memoId: number,
    memoBody: string,
    promotedTaskId: number,
    promotedTaskTitle: string,
    promotedTaskStatus: TaskStatus,
    linkId?: number
  ): void {
    const payload = buildMemoPromotedPayload(
      memoId,
      memoBody,
      promotedTaskId,
      promotedTaskTitle,
      promotedTaskStatus,
      linkId
    );
    createActivityLog(this.db, {
      eventType: 'memo.promoted',
      sourceType: this.sourceType,
      payload: { ...payload, promoted_task: { ...payload.promoted_task } },
    });
  }

  logMemoDeleted(memoId: number): void {
    createActivityLog(this.db, {
      eventType: 'memo.deleted',
      sourceType: this.sourceType,
      payload: {
        issue_id: memoId,
        issue_type: 'memo',
      },
    });
  }

  logMemoBookmarked(memoId: number, isBookmarked: boolean): void {
    createActivityLog(this.db, {
      eventType: 'memo.bookmarked',
      sourceType: this.sourceType,
      payload: {
        issue_id: memoId,
        issue_type: 'memo',
        is_bookmarked: isBookmarked,
      },
    });
  }

  // ============================================================
  // Label Events
  // ============================================================

  logLabelCreated(labelId: number, name: string, description?: string): void {
    createActivityLog(this.db, {
      eventType: 'label.created',
      sourceType: this.sourceType,
      payload: {
        label_id: labelId,
        label_name: name,
        description,
      },
    });
  }

  logLabelDeleted(labelId: number, name: string): void {
    createActivityLog(this.db, {
      eventType: 'label.deleted',
      sourceType: this.sourceType,
      payload: {
        label_id: labelId,
        label_name: name,
      },
    });
  }

  logLabelAssigned(issueId: number, labelId: number): void {
    const payload = buildLabelAssignedPayload(this.db, issueId, labelId);
    createActivityLog(this.db, {
      eventType: 'label.assigned',
      sourceType: this.sourceType,
      payload: { ...payload },
    });
  }

  logLabelRemoved(issueId: number, labelId: number): void {
    createActivityLog(this.db, {
      eventType: 'label.removed',
      sourceType: this.sourceType,
      payload: {
        issue_id: issueId,
        issue_type: getIssueType(this.db, issueId) ?? 'task',
        issue_title: getIssueTitle(this.db, issueId),
        label_id: labelId,
        label_name: getLabelName(this.db, labelId),
      },
    });
  }

  // ============================================================
  // Project Events
  // ============================================================

  logProjectCreated(projectId: number, name: string): void {
    createActivityLog(this.db, {
      eventType: 'project.created',
      sourceType: this.sourceType,
      payload: {
        project_id: projectId,
        project_name: name,
      },
    });
  }

  logProjectUpdated(
    projectId: number,
    diff: {
      name?: { old: string | null; new: string | null };
      description?: { old: string | null; new: string | null };
    }
  ): void {
    createActivityLog(this.db, {
      eventType: 'project.updated',
      sourceType: this.sourceType,
      payload: {
        project_id: projectId,
        name: diff.name,
        description: diff.description,
      },
    });
  }

  logProjectDeleted(projectId: number): void {
    createActivityLog(this.db, {
      eventType: 'project.deleted',
      sourceType: this.sourceType,
      payload: {
        project_id: projectId,
        project_name: getProjectName(this.db, projectId),
      },
    });
  }

  logProjectItemAdded(projectId: number, issueId: number, position?: number): void {
    const payload = buildProjectItemAddedPayload(
      this.db,
      projectId,
      issueId,
      position
    );
    createActivityLog(this.db, {
      eventType: 'project.item_added',
      sourceType: this.sourceType,
      payload: { ...payload },
    });
  }

  logProjectItemRemoved(projectId: number, issueId: number): void {
    createActivityLog(this.db, {
      eventType: 'project.item_removed',
      sourceType: this.sourceType,
      payload: {
        project_id: projectId,
        project_name: getProjectName(this.db, projectId),
        issue_id: issueId,
        issue_type: getIssueType(this.db, issueId) ?? 'task',
        issue_title: getIssueTitle(this.db, issueId),
      },
    });
  }

  // ============================================================
  // Link Events
  // ============================================================

  logLinkCreated(
    linkId: number,
    linkType: string,
    sourceIssueId: number,
    targetIssueId: number
  ): void {
    const payload = buildLinkCreatedPayload(
      this.db,
      linkId,
      linkType,
      sourceIssueId,
      targetIssueId
    );
    createActivityLog(this.db, {
      eventType: 'link.created',
      sourceType: this.sourceType,
      payload: { ...payload },
    });
  }

  logLinkDeleted(
    linkId: number,
    linkType: string,
    sourceIssueId: number,
    targetIssueId: number
  ): void {
    createActivityLog(this.db, {
      eventType: 'link.deleted',
      sourceType: this.sourceType,
      payload: {
        link_id: linkId,
        link_type: linkType,
        source_issue_id: sourceIssueId,
        source_issue_type: getIssueType(this.db, sourceIssueId),
        source_issue_title: getIssueTitle(this.db, sourceIssueId),
        target_issue_id: targetIssueId,
        target_issue_type: getIssueType(this.db, targetIssueId),
        target_issue_title: getIssueTitle(this.db, targetIssueId),
      },
    });
  }

  // ============================================================
  // Comment Events
  // ============================================================

  logCommentCreated(commentId: number, issueId: number, bodyMd: string): void {
    const payload = buildCommentCreatedPayload(
      this.db,
      commentId,
      issueId,
      bodyMd
    );
    createActivityLog(this.db, {
      eventType: 'comment.created',
      sourceType: this.sourceType,
      payload: { ...payload },
    });
  }

  logCommentUpdated(
    commentId: number,
    issueId: number,
    diff: { old: string | null; new: string }
  ): void {
    createActivityLog(this.db, {
      eventType: 'comment.updated',
      sourceType: this.sourceType,
      payload: {
        comment_id: commentId,
        issue_id: issueId,
        issue_type: getIssueType(this.db, issueId) ?? 'task',
        issue_title: getIssueTitle(this.db, issueId),
        body: {
          old: diff.old,
          new: diff.new,
        },
      },
    });
  }

  logCommentDeleted(commentId: number, issueId: number): void {
    createActivityLog(this.db, {
      eventType: 'comment.deleted',
      sourceType: this.sourceType,
      payload: {
        comment_id: commentId,
        issue_id: issueId,
        issue_type: getIssueType(this.db, issueId) ?? 'task',
        issue_title: getIssueTitle(this.db, issueId),
      },
    });
  }

  // ============================================================
  // Article Events
  // ============================================================

  logArticleCreated(
    articleId: number,
    title: string,
    bodyMd: string,
    originalUrl: string
  ): void {
    const payload = buildArticleCreatedPayload(
      this.db,
      articleId,
      title,
      bodyMd,
      originalUrl
    );
    createActivityLog(this.db, {
      eventType: 'article.created',
      sourceType: this.sourceType,
      payload: { ...payload },
    });
  }

  logArticleDeleted(articleId: number): void {
    createActivityLog(this.db, {
      eventType: 'article.deleted',
      sourceType: this.sourceType,
      payload: {
        issue_id: articleId,
        issue_type: 'article',
        title: getIssueTitle(this.db, articleId),
      },
    });
  }
}
