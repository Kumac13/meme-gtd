import { FastifyPluginAsync } from "fastify";
import {
  createTemplateHandler,
  listTemplatesHandler,
  getTemplateHandler,
  updateTemplateHandler,
  deleteTemplateHandler,
} from "../handlers/templateHandlers.js";
import {
  CreateTemplateRequestSchema,
  UpdateTemplateRequestSchema,
  ListTemplatesQuerySchema,
  TemplateIdParamsSchema,
  TemplateSchema,
  PaginatedTemplateListResponseSchema,
} from "../schemas/templateSchemas.js";
import { ErrorResponseSchema } from "../schemas/errorSchemas.js";

const templatesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/templates - Create template
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Templates"],
        summary: "Create template",
        description: "Create a new creation-time template",
        operationId: "createTemplate",
        body: CreateTemplateRequestSchema,
        response: {
          201: TemplateSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    createTemplateHandler
  );

  // GET /api/templates - List templates
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Templates"],
        summary: "List templates",
        description: "List templates with optional filters (target/search)",
        operationId: "listTemplates",
        querystring: ListTemplatesQuerySchema,
        response: {
          200: PaginatedTemplateListResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    listTemplatesHandler
  );

  // GET /api/templates/:id - Get template by ID
  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Templates"],
        summary: "Get template",
        description: "Get template by ID",
        operationId: "getTemplate",
        params: TemplateIdParamsSchema,
        response: {
          200: TemplateSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    getTemplateHandler
  );

  // PATCH /api/templates/:id - Update template
  fastify.patch(
    "/:id",
    {
      schema: {
        tags: ["Templates"],
        summary: "Update template",
        description: "Update a template's fields, labels and projects",
        operationId: "updateTemplate",
        params: TemplateIdParamsSchema,
        body: UpdateTemplateRequestSchema,
        response: {
          200: TemplateSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    updateTemplateHandler
  );

  // DELETE /api/templates/:id - Delete template
  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Templates"],
        summary: "Delete template",
        description: "Delete template (soft delete)",
        operationId: "deleteTemplate",
        params: TemplateIdParamsSchema,
        response: {
          204: { type: "null" },
          404: ErrorResponseSchema,
        },
      },
    },
    deleteTemplateHandler
  );
};

export default templatesRoutes;
