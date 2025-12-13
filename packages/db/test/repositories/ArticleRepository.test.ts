import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createArticle, listArticles, deleteArticle } from "../../src/articleRepository";
import { ensureDatabase } from "../../src/index";

// Mock DB setup (in memory)
describe("ArticleRepository", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    // Apply migrations - need a way to apply migrations to in-memory DB or mock schema
    // For unit test, we might mock DB or use helper. 
    // Assuming ensureDatabase can take :memory: if config allows, or we manually run SQL.
    // Ideally we reuse test setup helper if available.
    
    // Minimal schema for testing
    db.exec(`
      CREATE TABLE issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        title TEXT,
        body_md TEXT,
        meta TEXT,
        created_at TEXT,
        updated_at TEXT,
        is_bookmarked INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it("should create and list articles", () => {
    const article = createArticle(db, {
      title: "Test",
      bodyMd: "Body",
      originalUrl: "http://example.com"
    });

    const list = listArticles(db);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(article.id);
  });

  it("should delete an article", () => {
    const article = createArticle(db, {
      title: "Test",
      bodyMd: "Body",
      originalUrl: "http://example.com"
    });

    deleteArticle(db, article.id);
    const list = listArticles(db);
    expect(list).toHaveLength(0);
  });
});
