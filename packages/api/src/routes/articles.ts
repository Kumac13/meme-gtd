import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createArticleHandler,
  listArticlesHandler,
  getArticleHandler,
  deleteArticleHandler,
} from "../handlers/articleHandlers.js";
import {
  CreateArticleRequestSchema,
  ListArticlesQuerySchema,
  ArticleIdParamsSchema,
  ArticleSchema,
  PaginatedArticleListResponseSchema,
} from "../schemas/articleSchemas.js";
import {
  listArticleHighlightsHandler,
  createArticleHighlightHandler,
  deleteArticleHighlightHandler,
  listHighlightCommentsHandler,
  createHighlightCommentHandler,
  updateHighlightCommentHandler,
  deleteHighlightCommentHandler,
} from "../handlers/highlightHandlers.js";
import {
  CreateHighlightRequestSchema,
  HighlightSchema,
  HighlightListResponseSchema,
  ArticleHighlightsParamsSchema,
  HighlightIdParamsSchema,
  HighlightCommentIdParamsSchema,
} from "../schemas/highlightSchemas.js";
import {
  CreateCommentRequestSchema,
  UpdateCommentRequestSchema,
  CommentSchema,
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

  // ---- Highlights (nested under an article) ----

  // GET /api/articles/:id/highlights - List highlights for an article
  fastify.get(
    "/:id/highlights",
    {
      schema: {
        tags: ["Highlights"],
        summary: "List article highlights",
        description: "List all highlights on an article",
        operationId: "listArticleHighlights",
        params: ArticleHighlightsParamsSchema,
        response: {
          200: HighlightListResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    listArticleHighlightsHandler
  );

  // POST /api/articles/:id/highlights - Create a highlight
  fastify.post(
    "/:id/highlights",
    {
      schema: {
        tags: ["Highlights"],
        summary: "Create article highlight",
        description: "Create a highlight on an article using a TextQuoteSelector anchor",
        operationId: "createArticleHighlight",
        params: ArticleHighlightsParamsSchema,
        body: CreateHighlightRequestSchema,
        response: {
          201: HighlightSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    createArticleHighlightHandler
  );

  // DELETE /api/articles/:id/highlights/:highlightId - Delete a highlight (and its comments)
  fastify.delete(
    "/:id/highlights/:highlightId",
    {
      schema: {
        tags: ["Highlights"],
        summary: "Delete article highlight",
        description: "Delete a highlight (soft delete). Its comments are soft-deleted too.",
        operationId: "deleteArticleHighlight",
        params: HighlightIdParamsSchema,
        response: {
          204: { type: "null" },
          404: ErrorResponseSchema,
        },
      },
    },
    deleteArticleHighlightHandler
  );

  // GET /api/articles/:id/highlights/:highlightId/comments - List highlight comments
  fastify.get(
    "/:id/highlights/:highlightId/comments",
    {
      schema: {
        tags: ["Highlights"],
        summary: "List highlight comments",
        description: "List comments on a highlight",
        operationId: "listHighlightComments",
        params: HighlightIdParamsSchema,
        response: {
          200: z.array(CommentSchema),
          404: ErrorResponseSchema,
        },
      },
    },
    listHighlightCommentsHandler
  );

  // POST /api/articles/:id/highlights/:highlightId/comments - Create a highlight comment
  fastify.post(
    "/:id/highlights/:highlightId/comments",
    {
      schema: {
        tags: ["Highlights"],
        summary: "Create highlight comment",
        description: "Add a comment to a highlight",
        operationId: "createHighlightComment",
        params: HighlightIdParamsSchema,
        body: CreateCommentRequestSchema,
        response: {
          201: CommentSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    createHighlightCommentHandler
  );

  // PATCH /api/articles/:id/highlights/:highlightId/comments/:commentId - Update a highlight comment
  fastify.patch(
    "/:id/highlights/:highlightId/comments/:commentId",
    {
      schema: {
        tags: ["Highlights"],
        summary: "Update highlight comment",
        description: "Update a comment on a highlight",
        operationId: "updateHighlightComment",
        params: HighlightCommentIdParamsSchema,
        body: UpdateCommentRequestSchema,
        response: {
          200: CommentSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    updateHighlightCommentHandler
  );

  // DELETE /api/articles/:id/highlights/:highlightId/comments/:commentId - Delete a highlight comment
  fastify.delete(
    "/:id/highlights/:highlightId/comments/:commentId",
    {
      schema: {
        tags: ["Highlights"],
        summary: "Delete highlight comment",
        description: "Delete a comment from a highlight",
        operationId: "deleteHighlightComment",
        params: HighlightCommentIdParamsSchema,
        response: {
          204: { type: "null" },
          404: ErrorResponseSchema,
        },
      },
    },
    deleteHighlightCommentHandler
  );
};

export default articlesRoutes;
