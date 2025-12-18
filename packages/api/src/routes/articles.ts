import { FastifyPluginAsync } from "fastify";
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
};

export default articlesRoutes;
