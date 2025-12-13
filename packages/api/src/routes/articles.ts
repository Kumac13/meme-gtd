import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createArticle, listArticles, getArticle, deleteArticle } from "meme-gtd-db";
import { CreateArticleInput, ListArticleFilters } from "meme-gtd-db";

const ArticleSchema = z.object({
  id: z.number(),
  type: z.literal("article"),
  title: z.string(),
  bodyMd: z.string(),
  meta: z.object({
    originalUrl: z.string(),
    siteName: z.string().nullable().optional(),
    archivedAt: z.string(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  isBookmarked: z.boolean(),
  isDeleted: z.boolean(),
  labels: z.array(z.string()).optional(),
  commentCount: z.number().optional(),
});

const CreateArticleSchema = z.object({
  title: z.string(),
  bodyMd: z.string(),
  originalUrl: z.string(),
  siteName: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
});

const articlesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Articles"],
        body: CreateArticleSchema,
        response: {
          201: ArticleSchema,
        },
      },
    },
    async (request, reply) => {
      // Type assertion or using FromSchema from json-schema-to-ts if using standard fastify
      // Since we use fastify-type-provider-zod, request.body should be typed if configured correctly in server.ts
      // But here TS says unknown. Let explicit cast to DB input type which matches schema.
      const body = request.body as CreateArticleInput;
      const article = createArticle(fastify.db, body);
      return reply.code(201).send(article);
    }
  );

  fastify.get(
    "/",
    {
      schema: {
        tags: ["Articles"],
        querystring: z.object({
          limit: z.coerce.number().optional(),
          offset: z.coerce.number().optional(),
          search: z.string().optional(),
        }),
        response: {
          200: z.array(ArticleSchema),
        },
      },
    },
    async (request, reply) => {
      const query = request.query as ListArticleFilters;
      const articles = listArticles(fastify.db, query);
      console.log('DEBUG ARTICLES:', JSON.stringify(articles, null, 2));
      return reply.send(articles);
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Articles"],
        params: z.object({
          id: z.coerce.number(),
        }),
        response: {
          200: ArticleSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      try {
        const article = getArticle(fastify.db, id);
        return reply.send(article);
      } catch (e) {
        return reply.code(404).send({ error: "Article not found" });
      }
    }
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Articles"],
        params: z.object({
          id: z.coerce.number(),
        }),
        response: {
          204: z.null(),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      try {
        deleteArticle(fastify.db, id);
        return reply.code(204).send();
      } catch (e) {
        return reply.code(404).send({ error: "Article not found" });
      }
    }
  );
};

export default articlesRoutes;
