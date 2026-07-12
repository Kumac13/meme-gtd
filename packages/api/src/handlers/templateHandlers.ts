import type { FastifyRequest, FastifyReply } from 'fastify';
import { TemplateService } from 'meme-gtd-core';
import { NotFoundError } from '../errors/index.js';
import type {
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ListTemplatesQuery,
} from '../schemas/templateSchemas.js';

const DEFAULT_LIMIT = 100;
const DEFAULT_OFFSET = 0;

export async function createTemplateHandler(
  request: FastifyRequest<{ Body: CreateTemplateRequest }>,
  reply: FastifyReply
) {
  const { title, bodyMd, templateTarget, labels, projectIds } = request.body;
  const service = new TemplateService({ db: request.server.db });
  const template = service.create({ title, bodyMd, templateTarget, labels, projects: projectIds });
  return reply.status(201).send(template);
}

export async function listTemplatesHandler(
  request: FastifyRequest<{ Querystring: ListTemplatesQuery }>,
  reply: FastifyReply
) {
  const service = new TemplateService({ db: request.server.db });
  const limit = request.query.limit ?? DEFAULT_LIMIT;
  const offset = request.query.offset ?? DEFAULT_OFFSET;
  const result = service.list({ limit, offset, search: request.query.search, target: request.query.target });
  return reply.status(200).send({ data: result.data, total: result.total, limit, offset });
}

export async function getTemplateHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const id = parseInt(request.params.id, 10);
  const service = new TemplateService({ db: request.server.db });
  try {
    return reply.status(200).send(service.get(id));
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Template', id);
    }
    throw error;
  }
}

export async function updateTemplateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateTemplateRequest }>,
  reply: FastifyReply
) {
  const id = parseInt(request.params.id, 10);
  const { title, bodyMd, templateTarget, labels, projectIds } = request.body;
  const service = new TemplateService({ db: request.server.db });
  try {
    const template = service.update(id, { title, bodyMd, templateTarget, labels, projects: projectIds });
    return reply.status(200).send(template);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Template', id);
    }
    throw error;
  }
}

export async function deleteTemplateHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const id = parseInt(request.params.id, 10);
  const service = new TemplateService({ db: request.server.db });
  try {
    service.remove(id);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Template', id);
    }
    throw error;
  }
}
