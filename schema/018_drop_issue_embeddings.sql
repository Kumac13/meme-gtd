-- Migration: 018_drop_issue_embeddings
-- Purpose: セマンティック検索機能の削除に伴い、013 で追加した issue_embeddings
--   テーブルを削除する。embedding は issue 本文から導出されたデータであり、
--   機能の削除後は参照するコードが存在しないため復元不要。

DROP TABLE IF EXISTS issue_embeddings;
