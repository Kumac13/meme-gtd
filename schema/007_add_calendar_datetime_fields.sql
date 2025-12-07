-- Migration: 007_add_calendar_datetime_fields
-- Purpose: Separate scheduled (planned) times from actual (executed) times

-- 新規スケジューリングフィールド
ALTER TABLE issues ADD COLUMN scheduled_start TEXT;
ALTER TABLE issues ADD COLUMN scheduled_end TEXT;
ALTER TABLE issues ADD COLUMN is_all_day INTEGER DEFAULT 0;

-- 新規実行結果フィールド
ALTER TABLE issues ADD COLUMN actual_start TEXT;
ALTER TABLE issues ADD COLUMN actual_end TEXT;

-- 通知設定（将来の通知機能用に構造のみ準備）
ALTER TABLE issues ADD COLUMN notify_before_minutes INTEGER;

-- データ移行: scheduled_on + start_time -> scheduled_start
UPDATE issues
SET scheduled_start = scheduled_on || 'T' || start_time || ':00'
WHERE scheduled_on IS NOT NULL AND start_time IS NOT NULL;

-- 終日イベント: start_time がない場合
UPDATE issues
SET scheduled_start = scheduled_on || 'T00:00:00',
    is_all_day = 1
WHERE scheduled_on IS NOT NULL AND start_time IS NULL;

-- end_date + end_time -> scheduled_end (done以外 = 予定としての締め切り)
UPDATE issues
SET scheduled_end = end_date || 'T' || end_time || ':00'
WHERE end_date IS NOT NULL AND end_time IS NOT NULL AND status != 'done';

-- done タスク: scheduled_on+start_time -> actual_start, end_date+end_time -> actual_end
UPDATE issues
SET actual_start = CASE
      WHEN scheduled_on IS NOT NULL AND start_time IS NOT NULL
      THEN scheduled_on || 'T' || start_time || ':00'
      WHEN scheduled_on IS NOT NULL
      THEN scheduled_on || 'T00:00:00'
      ELSE NULL
    END,
    actual_end = end_date || 'T' || COALESCE(end_time, '23:59') || ':00'
WHERE status = 'done' AND end_date IS NOT NULL;

-- インデックス作成（カレンダークエリ用）
CREATE INDEX IF NOT EXISTS idx_issues_scheduled_start ON issues(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_issues_scheduled_end ON issues(scheduled_end);
CREATE INDEX IF NOT EXISTS idx_issues_actual_start ON issues(actual_start);
