import { FastifyPluginAsync } from "fastify";
import { semanticSearchHandler } from "../handlers/searchHandlers.js";
import {
  SemanticSearchQuerySchema,
  SemanticSearchResponseSchema,
} from "../schemas/searchSchemas.js";
import { ErrorResponseSchema } from "../schemas/errorSchemas.js";

const searchRoutes: FastifyPluginAsync = async (fastify) => {
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
