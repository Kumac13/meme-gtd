import type { FastifyRequest, FastifyReply } from 'fastify';
import { LinkService } from 'meme-gtd-core';
import { memoPreviewTitle, type IssueType } from 'meme-gtd-shared';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type {
  CreateLinkRequest,
  ListLinksQuery,
  LinksGraphQuery,
  LinkWithDirection,
} from '../schemas/linkSchemas.js';

export async function getLinksGraphHandler(
  request: FastifyRequest<{ Querystring: LinksGraphQuery }>,
  reply: FastifyReply
) {
  reply.header('Cache-Control', 'no-store');
  const { rootId, depth, q, label, projectId, bookmarked, includeLabels } = request.query;
  if (depth !== undefined && rootId === undefined) {
    throw new ValidationError('depth requires rootId');
  }
  const projects = projectId?.split(',').map(value => value.trim()) ?? [];
  const projectIds = projects.filter(value => value !== 'none').map(value => {
    const id = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0) {
      throw new ValidationError('projectId must be a comma-separated list of positive integers or "none"');
    }
    return id;
  });
  const graph = new LinkService({ db: request.server.db }).graph({
    rootId, depth, q: q?.trim(),
    labels: label?.split(',').map(value => value.trim()).filter(Boolean),
    projectIds,
    unassigned: projects.includes('none'),
    bookmarked: bookmarked === 'true',
    includeLabels: includeLabels === 'true',
  });
  if (!graph && rootId !== undefined) throw new NotFoundError('Issue', rootId);
  return reply.send(graph);
}

/**
 * Create a new link between issues
 */
export async function createLinkHandler(
  request: FastifyRequest<{ Body: CreateLinkRequest }>,
  reply: FastifyReply
) {
  const { sourceIssueId, targetIssueId, linkType, isPromotion } = request.body;
  const linkService = new LinkService({ db: request.server.db });

  try {
    const link = linkService.create(sourceIssueId, targetIssueId, linkType, {
      isPromotion,
    });
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

  try {
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
          CASE WHEN type = 'memo' THEN body_md ELSE COALESCE(title, SUBSTR(body_md, 1, 100)) END as title,
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
          title: row.issue_type === 'memo' ? memoPreviewTitle(row.title ?? '') : row.title,
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
