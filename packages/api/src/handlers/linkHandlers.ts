import type { FastifyRequest, FastifyReply } from 'fastify';
import { LinkService } from 'meme-gtd-core';
import type { IssueType } from 'meme-gtd-shared';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type {
  CreateLinkRequest,
  ListLinksQuery,
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
 * List all links for a given issue with direction and target issue information
 */
export async function listLinksHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: ListLinksQuery;
  }>,
  reply: FastifyReply
) {
  const issueId = parseInt(request.params.id, 10);
  const linkService = new LinkService({ db: request.server.db });
  const db = request.server.db;

  // Apply optional type filter
  const filters = request.query.type
    ? { type: request.query.type }
    : undefined;

  const links = linkService.list(issueId, filters);

  // Collect all target issue IDs
  const targetIds = links.map((link) =>
    link.sourceIssueId === issueId ? link.targetIssueId : link.sourceIssueId
  );

  // Fetch all target issues in one query
  const issueInfoMap = new Map<number, { type: IssueType; title: string; status: string | null }>();

  if (targetIds.length > 0) {
    const placeholders = targetIds.map(() => '?').join(',');
    const query = `
      SELECT
        id,
        type as issue_type,
        COALESCE(title, SUBSTR(body_md, 1, 100)) as title,
        status
      FROM issues
      WHERE id IN (${placeholders}) AND is_deleted = 0
    `;

    const stmt = db.prepare(query);
    const rows = stmt.all(...targetIds) as Array<{
      id: number;
      issue_type: IssueType;
      title: string;
      status: string | null;
    }>;

    rows.forEach((row) => {
      issueInfoMap.set(row.id, {
        type: row.issue_type,
        title: row.title,
        status: row.status,
      });
    });
  }

  // Add direction and target issue information to each link
  const linksWithDirection: LinkWithDirection[] = links.map((link) => {
    const direction = link.sourceIssueId === issueId ? 'outgoing' : 'incoming';
    const targetId = direction === 'outgoing' ? link.targetIssueId : link.sourceIssueId;
    const targetInfo = issueInfoMap.get(targetId);

    return {
      ...link,
      direction,
      targetIssue: {
        id: targetId,
        type: targetInfo?.type || 'task',
        title: targetInfo?.title || `Issue #${targetId}`,
        status: targetInfo?.status ?? null,
      },
    };
  });

  return reply.status(200).send(linksWithDirection);
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
