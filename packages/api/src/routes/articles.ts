import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createArticleHandler,
  listArticlesHandler,
  getArticleHandler,
  updateArticleHandler,
  deleteArticleHandler,
  bookmarkArticleHandler,
  unbookmarkArticleHandler,
  listArticleCommentsHandler,
  createArticleCommentHandler,
  updateArticleCommentHandler,
  deleteArticleCommentHandler,
} from "../handlers/articleHandlers.js";
import {
  CreateArticleRequestSchema,
  UpdateArticleRequestSchema,
  ListArticlesQuerySchema,
  ArticleIdParamsSchema,
  ArticleSchema,
  PaginatedArticleListResponseSchema,
} from "../schemas/articleSchemas.js";
import {
  CommentSchema,
  CreateCommentRequestSchema,
  UpdateCommentRequestSchema,
  ArticleCommentParamsSchema,
  ArticleCommentIdParamsSchema,
} from "../schemas/commentSchemas.js";
import { ErrorResponseSchema } from "../schemas/errorSchemas.js";

const articlesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/articles - Create article
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Articles"],
        summary: "Create article",
        description: "Create a new article",
        operationId: "createArticle",
        body: CreateArticleRequestSchema,
        response: {
          201: ArticleSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    createArticleHandler
  );

  // GET /api/articles - List articles
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Articles"],
        summary: "List articles",
        description: "List all articles with optional filters",
        operationId: "listArticles",
        querystring: ListArticlesQuerySchema,
        response: {
          200: PaginatedArticleListResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    listArticlesHandler
  );

  // GET /api/articles/:id - Get article by ID
  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Articles"],
        summary: "Get article",
        description: "Get article by ID",
        operationId: "getArticle",
        params: ArticleIdParamsSchema,
        response: {
          200: ArticleSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    getArticleHandler
  );

  // PATCH /api/articles/:id - Update article (manual articles only)
  fastify.patch(
    "/:id",
    {
      schema: {
        tags: ["Articles"],
        summary: "Update article",
        description: "Update a manually created article's title/body. Web-saved articles are read-only (400).",
        operationId: "updateArticle",
        params: ArticleIdParamsSchema,
        body: UpdateArticleRequestSchema,
        response: {
          200: ArticleSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    updateArticleHandler
  );

  // POST /api/articles/:id/bookmark - Bookmark article
  fastify.post(
    "/:id/bookmark",
    {
      schema: {
        tags: ["Articles"],
        summary: "Bookmark article",
        description: "Bookmark article",
        operationId: "bookmarkArticle",
        params: ArticleIdParamsSchema,
        response: {
          200: ArticleSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    bookmarkArticleHandler
  );

  // POST /api/articles/:id/unbookmark - Unbookmark article
  fastify.post(
    "/:id/unbookmark",
    {
      schema: {
        tags: ["Articles"],
        summary: "Unbookmark article",
        description: "Unbookmark article",
        operationId: "unbookmarkArticle",
        params: ArticleIdParamsSchema,
        response: {
          200: ArticleSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    unbookmarkArticleHandler
  );

  // GET /api/articles/:articleId/comments - List comments
  fastify.get(
    "/:articleId/comments",
    {
      schema: {
        tags: ["Comments"],
        summary: "List article comments",
        description: "List all comments for an article",
        operationId: "listArticleComments",
        params: ArticleCommentParamsSchema,
        response: {
          200: z.array(CommentSchema),
          400: ErrorResponseSchema,
        },
      },
    },
    listArticleCommentsHandler
  );

  // POST /api/articles/:articleId/comments - Create comment
  fastify.post(
    "/:articleId/comments",
    {
      schema: {
        tags: ["Comments"],
        summary: "Create article comment",
        description: "Create comment on article",
        operationId: "createArticleComment",
        params: ArticleCommentParamsSchema,
        body: CreateCommentRequestSchema,
        response: {
          201: CommentSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    createArticleCommentHandler
  );

  // PATCH /api/articles/:articleId/comments/:commentId - Update comment
  fastify.patch(
    "/:articleId/comments/:commentId",
    {
      schema: {
        tags: ["Comments"],
        summary: "Update article comment",
        description: "Update comment on article",
        operationId: "updateArticleComment",
        params: ArticleCommentIdParamsSchema,
        body: UpdateCommentRequestSchema,
        response: {
          200: CommentSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    updateArticleCommentHandler
  );

  // DELETE /api/articles/:articleId/comments/:commentId - Delete comment
  fastify.delete(
    "/:articleId/comments/:commentId",
    {
      schema: {
        tags: ["Comments"],
        summary: "Delete article comment",
        description: "Delete comment from article",
        operationId: "deleteArticleComment",
        params: ArticleCommentIdParamsSchema,
        response: {
          204: { type: "null" },
          404: ErrorResponseSchema,
        },
      },
    },
    deleteArticleCommentHandler
  );

  // DELETE /api/articles/:id - Delete article
  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Articles"],
        summary: "Delete article",
        description: "Delete article (soft delete)",
        operationId: "deleteArticle",
        params: ArticleIdParamsSchema,
        response: {
          204: { type: "null" },
          404: ErrorResponseSchema,
        },
      },
    },
    deleteArticleHandler
  );
};

export default articlesRoutes;
