import type { FastifyRequest, FastifyReply } from 'fastify';
import { LinkService } from 'meme-gtd-core';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type {
  CreateLinkRequest,
  LinkWithDirection,
} from '../schemas/linkSchemas.js';

/**
 * Create a new link between issues
 */
export async function createLinkHandler(
  request: FastifyRequest<{ Body: CreateLinkRequest }>,
  reply: FastifyReply
) {
  const { sourceIssueId, targetIssueId, linkType } = request.body;
  const linkService = new LinkService({ db: request.server.db });

  try {
    const link = linkService.create(sourceIssueId, targetIssueId, linkType);
    return reply.status(201).send(link);
  } catch (error) {
    if (error instanceof Error) {
      // Self-reference validation
      if (error.message.includes('Cannot link issue to itself')) {
        throw new ValidationError(error.message);
      }
      // Issue not found
      if (error.message.includes('not found')) {
        const match = error.message.match(/Issue #(\d+)/);
        if (match) {
          throw new NotFoundError('Issue', parseInt(match[1], 10));
        }
      }
      // Duplicate link
      if (error.message.includes('Link already exists')) {
        throw new ValidationError(error.message);
      }
    }
    throw error;
  }
}

/**
 * List all links for a given issue with direction
 */
export async function listLinksHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const issueId = parseInt(request.params.id, 10);
  const linkService = new LinkService({ db: request.server.db });

  try {
    const links = linkService.list(issueId);

    // Add direction field to each link
    const linksWithDirection: LinkWithDirection[] = links.map((link) => ({
      ...link,
      direction: link.sourceIssueId === issueId ? 'outgoing' : 'incoming',
    }));

    return reply.status(200).send(linksWithDirection);
  } catch (error) {
    throw error;
  }
}

/**
 * Delete a link by ID
 */
export async function deleteLinkHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const linkId = parseInt(request.params.id, 10);
  const linkService = new LinkService({ db: request.server.db });

  try {
    linkService.remove(linkId);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Link', linkId);
    }
    throw error;
  }
}
