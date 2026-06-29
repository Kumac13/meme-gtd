import { FastifyPluginAsync } from "fastify";
import {
  semanticSearchHandler,
  keywordSearchHandler,
  searchExportHandler,
} from "../handlers/searchHandlers.js";
import {
  SemanticSearchQuerySchema,
  SemanticSearchResponseSchema,
  KeywordSearchQuerySchema,
  KeywordSearchResponseSchema,
  SearchExportRequestSchema,
  SearchExportResponseSchema,
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
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
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
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
          503: ErrorResponseSchema,
        },
      },
    },
    semanticSearchHandler
  );

  // POST /api/search/export - Export current search/filter results as JSON
  // and record the export in activity_log
  fastify.post(
    "/export",
    {
      schema: {
        tags: ["Search"],
        summary: "Export search results",
        description:
          "Records a search.exported activity log entry and returns the items for the given IDs together with the filter context, for copying to clipboard",
        operationId: "exportSearchResults",
        body: SearchExportRequestSchema,
        response: {
          200: SearchExportResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    searchExportHandler
  );
};

export default searchRoutes;
