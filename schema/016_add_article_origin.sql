-- Migration: 016_add_article_origin
-- Purpose: issues.origin ('web' | 'manual') — Article の出所（Web保存 / 手動作成）を
--   判別・フィルタするための専用カラム。article 以外の type では NULL。
-- Note: ALTER ADD COLUMN のファイルには他の DDL・バックフィルを混在させない
--   （db-migration スキル）。既存行の埋め戻しは 017 で行う。

ALTER TABLE issues ADD COLUMN origin TEXT CHECK (origin IN ('web', 'manual'));
