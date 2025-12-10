import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  getActivityLogByIssueId,
  getActivityLogByProjectId,
  getCompletedTasks,
  listActivityLog,
} from 'meme-gtd-db';
import type {
  IssueActivityLogQuerystring,
  ProjectActivityLogQuerystring,
  CompletedTasksQuerystring,
  ActivityLogQuerystring,
} from '../schemas/activityLogSchemas.js';

/**
 * Get activity log entries for a specific issue
 * GET /api/activity-log/issues/:issueId
 */
export async function getIssueActivityLogHandler(
  request: FastifyRequest<{
    Params: { issueId: string };
    Querystring: IssueActivityLogQuerystring;
  }>,
  reply: FastifyReply
) {
  const issueId = parseInt(request.params.issueId, 10);
  const { limit, order } = request.query;

  const logs = getActivityLogByIssueId(request.server.db, issueId, {
    limit,
    order,
  });

  return reply.status(200).send(logs);
}

/**
 * Get activity log entries for a specific project
 * GET /api/activity-log/projects/:projectId
 */
export async function getProjectActivityLogHandler(
  request: FastifyRequest<{
    Params: { projectId: string };
    Querystring: ProjectActivityLogQuerystring;
  }>,
  reply: FastifyReply
) {
  const projectId = parseInt(request.params.projectId, 10);
  const { limit, order } = request.query;

  const logs = getActivityLogByProjectId(request.server.db, projectId, {
    limit,
    order,
  });

  return reply.status(200).send(logs);
}

/**
 * Get completed tasks within a date range
 * GET /api/activity-log/completed-tasks
 */
export async function getCompletedTasksHandler(
  request: FastifyRequest<{
    Querystring: CompletedTasksQuerystring;
  }>,
  reply: FastifyReply
) {
  const { from, to, limit } = request.query;

  const tasks = getCompletedTasks(request.server.db, {
    from,
    to,
    limit,
  });

  return reply.status(200).send(tasks);
}

/**
 * List activity log entries with filters
 * GET /api/activity-log
 */
export async function listActivityLogHandler(
  request: FastifyRequest<{
    Querystring: ActivityLogQuerystring;
  }>,
  reply: FastifyReply
) {
  const { eventType, sourceType, from, to, limit, offset, order } = request.query;

  const logs = listActivityLog(request.server.db, {
    eventType,
    sourceType,
    from,
    to,
    limit,
    offset,
    order,
  });

  return reply.status(200).send(logs);
}
