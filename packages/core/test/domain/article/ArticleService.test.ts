import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArticleService } from "../../../src/domain/article/ArticleService";
import { CreateArticleInput } from "../../../src/domain/article/types";

// Mock Repository
const mockRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe("ArticleService", () => {
  let service: ArticleService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ArticleService(mockRepository as any);
  });

  it("should create an article successfully", async () => {
    const input: CreateArticleInput = {
      title: "Test Article",
      bodyMd: "# Test Content",
      originalUrl: "https://example.com",
      siteName: "Example Site",
    };

    const createdArticle = {
      id: 1,
      type: "article",
      ...input,
      meta: {
        originalUrl: input.originalUrl,
        siteName: input.siteName,
        archivedAt: "2023-01-01T00:00:00Z",
      },
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
      isBookmarked: false,
      isDeleted: false,
    };

    mockRepository.create.mockResolvedValue(createdArticle);

    const result = await service.create(input);

    expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      title: input.title,
      bodyMd: input.bodyMd,
      meta: expect.objectContaining({
        originalUrl: input.originalUrl,
        siteName: input.siteName,
      }),
    }));
    expect(result).toEqual(createdArticle);
  });
});
