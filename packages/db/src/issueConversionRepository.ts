import type Database from 'better-sqlite3';
import { uuidv7, type Issue, type Memo } from 'meme-gtd-shared';
import { createArticle } from './articleRepository.js';
import { listComments } from './memoRepository.js';
import { getMemo } from './memoRepository.js';

/** コンテクスト保存用のコピー。元Issueとそのコメントは変更しない。 */
export function copyIssueToArticle(db: Database.Database, source: Issue) {
  const sourceId = source.id;
  const article = createArticle(db, {
    title: source.title ?? '', bodyMd: source.bodyMd, origin: 'manual',
  });
  const now = article.createdAt;
  for (const comment of listComments(db, sourceId)) {
    db.prepare(`INSERT INTO comments (uuid, issue_id, body_md, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).run(uuidv7(), article.id, comment.bodyMd, now, now);
  }
  db.prepare(`INSERT INTO issue_labels (issue_id, label_id, assigned_at)
    SELECT ?, label_id, ? FROM issue_labels WHERE issue_id = ?`).run(article.id, now, sourceId);
  db.prepare(`INSERT INTO project_items (project_id, issue_id, position, view_meta, created_at, updated_at)
    SELECT project_id, ?, position, view_meta, ?, ? FROM project_items WHERE issue_id = ?`)
    .run(article.id, now, now, sourceId);
  db.prepare(`INSERT INTO links (source_issue_id, target_issue_id, link_type, created_at)
    SELECT CASE WHEN source_issue_id = @sourceId THEN @targetId ELSE source_issue_id END,
           CASE WHEN target_issue_id = @sourceId THEN @targetId ELSE target_issue_id END,
           link_type, @now FROM links WHERE source_issue_id = @sourceId OR target_issue_id = @sourceId`)
    .run({ sourceId, targetId: article.id, now });
  db.prepare(`INSERT INTO links (source_issue_id, target_issue_id, link_type, created_at)
    VALUES (?, ?, 'derived_from', ?)`).run(article.id, sourceId, now);
  db.prepare(`INSERT INTO url_links (issue_id, url, title, created_at)
    SELECT ?, url, title, ? FROM url_links WHERE issue_id = ?`).run(article.id, now, sourceId);
  return article.id;
}

/** 同じIssueをMemoへ移す。ID・UUID・日時・コメント・関連情報を保持する。 */
export function transferIssueToMemo(db: Database.Database, source: Issue): Memo {
  const sourceId = source.id;
  const body = [source.title ?? '', source.bodyMd].filter(Boolean).join('\n\n');
  // updated_atも含め日時を保存する。server_seqはtype変更のトリガーで進む。
  db.prepare(`UPDATE issues SET type = 'memo', title = NULL, body_md = ?, status = NULL,
    scheduled_on = NULL, scheduled_start = NULL, scheduled_end = NULL, is_all_day = 0,
    actual_start = NULL, actual_end = NULL, start_time = NULL, end_time = NULL,
    end_date = NULL, duration = NULL, task_kind = NULL
    WHERE id = ?`).run(body, sourceId);
  return getMemo(db, sourceId);
}
