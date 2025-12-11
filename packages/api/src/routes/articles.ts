import { FastifyPluginAsync } from "fastify";
import { createArticle, listArticles, getArticle, deleteArticle } from "meme-gtd-db";

const articlesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/", async (request, reply) => {
    const body = request.body as any;
    
    if (!body.title || !body.bodyMd || !body.originalUrl) {
      return reply.code(400).send({ error: "Missing required fields" });
    }

    const article = createArticle(fastify.db, {
      title: body.title,
      bodyMd: body.bodyMd,
      originalUrl: body.originalUrl,
      siteName: body.siteName,
      labels: body.labels
    });

    return reply.code(201).send(article);
  });

  fastify.get("/", async (request, reply) => {
    const query = request.query as any;
    const articles = listArticles(fastify.db, {
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
      search: query.search
    });
    return reply.send(articles);
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as any;
    try {
        const article = getArticle(fastify.db, Number(id));
        return reply.send(article);
    } catch (e) {
        return reply.code(404).send({ error: "Article not found" });
    }
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as any;
    try {
        deleteArticle(fastify.db, Number(id));
        return reply.code(204).send();
    } catch (e) {
        return reply.code(404).send({ error: "Article not found" });
    }
  });
};

export default articlesRoutes;
