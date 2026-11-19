import type Database from 'better-sqlite3';
import type { Issue, SourceType } from 'meme-gtd-shared';
import { copyIssueToArticle, transferIssueToMemo, getArticle, listComments } from 'meme-gtd-db';
import { ActivityLogger } from './activity-log/activity-logger.js';

/** Issue共通の変換ユースケース。リソース別サービスは元種別の検証と公開する操作を所有する。 */
export class IssueConversionService {
  private readonly logger: ActivityLogger;
  constructor(private readonly db: Database.Database, sourceType: SourceType = 'api') {
    this.logger = new ActivityLogger(db, sourceType);
  }

  public copyToArticle(source: Issue) {
    return this.db.transaction(() => {
      const articleId = copyIssueToArticle(this.db, source);
      const article = getArticle(this.db, articleId);
      this.logger.logArticleCreated(articleId, article.title, article.bodyMd);
      for (const comment of listComments(this.db, articleId)) {
        this.logger.logCommentCreated(comment.id, articleId, comment.bodyMd);
      }
      const labels = this.db.prepare('SELECT label_id FROM issue_labels WHERE issue_id = ?').all(articleId) as Array<{ label_id: number }>;
      for (const label of labels) this.logger.logLabelAssigned(articleId, label.label_id);
      const projects = this.db.prepare('SELECT project_id, position FROM project_items WHERE issue_id = ?').all(articleId) as Array<{ project_id: number; position: number }>;
      for (const project of projects) this.logger.logProjectItemAdded(project.project_id, articleId, project.position);
      const links = this.db.prepare('SELECT * FROM links WHERE source_issue_id = ? OR target_issue_id = ?')
        .all(articleId, articleId) as Array<{ id: number; link_type: string; source_issue_id: number; target_issue_id: number }>;
      for (const link of links) {
        this.logger.logLinkCreated(link.id, link.link_type, link.source_issue_id, link.target_issue_id);
      }
      return { articleId };
    })();
  }

  public transferToMemo(source: Issue) {
    return this.db.transaction(() => {
      const memo = transferIssueToMemo(this.db, source);
      this.logger.logIssueTransferred(source.id, source.type, 'memo', memo.bodyMd);
      return { memoId: memo.id };
    })();
  }

}
