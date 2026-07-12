-- Migration: 017_backfill_article_origin
-- Purpose: 016 で追加した issues.origin を既存記事に埋める。
--   Web 保存経路（拡張 / Share Extension）は meta.originalUrl を必ず持つため、
--   originalUrl の有無で確実に判別できる。

UPDATE issues
SET origin = CASE
    WHEN json_extract(meta, '$.originalUrl') IS NOT NULL THEN 'web'
    ELSE 'manual'
END
WHERE type = 'article' AND origin IS NULL;
