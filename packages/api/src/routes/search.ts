import { FastifyPluginAsync } from "fastify";
import { semanticSearchHandler, keywordSearchHandler } from "../handlers/searchHandlers.js";
import {
  SemanticSearchQuerySchema,
  SemanticSearchResponseSchema,
  KeywordSearchQuerySchema,
  KeywordSearchResponseSchema,
} from "../schemas/searchSchemas.js";
import { ErrorResponseSchema } from "../schemas/errorSchemas.js";

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/search/keyword - Keyword search (LIKE partial matching)
  fastify.get(
    "/keyword",
    {
      schema: {
        tags: ["Search"],
        summary: "Keyword search",
        description: "Search issues by keyword using partial text matching across title, body, and comments",
        operationId: "keywordSearch",
        querystring: KeywordSearchQuerySchema,
        response: {
          200: KeywordSearchResponseSchema,
        },
      },
    },
    keywordSearchHandler
  );

  // GET /api/search/semantic - Semantic vector search
  fastify.get(
    "/semantic",
    {
      schema: {
        tags: ["Search"],
        summary: "Semantic search",
        description: "Search issues by semantic similarity using vector embeddings",
        operationId: "semanticSearch",
        querystring: SemanticSearchQuerySchema,
        response: {
          200: SemanticSearchResponseSchema,
          503: ErrorResponseSchema,
        },
      },
    },
    semanticSearchHandler
  );
};

export default searchRoutes;
