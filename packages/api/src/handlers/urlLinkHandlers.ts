import type { FastifyRequest, FastifyReply } from 'fastify';
import { UrlLinkService } from 'meme-gtd-core';
import { NotFoundError } from '../errors/index.js';
import type { CreateUrlLinkRequest, UpdateUrlLinkRequest } from '../schemas/urlLinkSchemas.js';

/**
 * Create a new URL link for an issue
 */
export async function createUrlLinkHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: CreateUrlLinkRequest;
  }>,
  reply: FastifyReply
) {
  const issueId = parseInt(request.params.id, 10);
  const { url, title } = request.body;
  const urlLinkService = new UrlLinkService({ db: request.server.db });

  try {
    const urlLink = urlLinkService.create(issueId, url, title);
    return reply.status(201).send(urlLink);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Issue', issueId);
    }
    throw error;
  }
}

/**
 * List all URL links for a given issue
 */
export async function listUrlLinksHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const issueId = parseInt(request.params.id, 10);
  const urlLinkService = new UrlLinkService({ db: request.server.db });

  try {
    const urlLinks = urlLinkService.list(issueId);
    return reply.status(200).send(urlLinks);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Issue', issueId);
    }
    throw error;
  }
}

/**
 * Delete a URL link by ID
 */
export async function deleteUrlLinkHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const urlLinkId = parseInt(request.params.id, 10);
  const urlLinkService = new UrlLinkService({ db: request.server.db });

  try {
    urlLinkService.remove(urlLinkId);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('URL link', urlLinkId);
    }
    throw error;
  }
}

/**
 * Update a URL link's title
 */
export async function updateUrlLinkHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: UpdateUrlLinkRequest;
  }>,
  reply: FastifyReply
) {
  const urlLinkId = parseInt(request.params.id, 10);
  const { title } = request.body;
  const urlLinkService = new UrlLinkService({ db: request.server.db });

  try {
    const urlLink = urlLinkService.update(urlLinkId, title);
    return reply.status(200).send(urlLink);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('URL link', urlLinkId);
    }
    throw error;
  }
}
