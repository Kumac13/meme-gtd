import type { FastifyRequest, FastifyReply } from 'fastify';
import { TaskService } from 'meme-gtd-core';
import { NotFoundError } from '../errors/index.js';
import type {
  CreateTaskRequest,
  UpdateTaskRequest,
  DemoteTaskRequest,
} from '../schemas/taskSchemas.js';

/**
 * Create a new task from the supplied payload.
 */
export async function createTaskHandler(
  request: FastifyRequest<{ Body: CreateTaskRequest }>,
  reply: FastifyReply
) {
  const {
    title,
    bodyMd,
    status,
    // New scheduling fields
    scheduledStart,
    scheduledEnd,
    isAllDay,
    // Deprecated fields
    scheduledOn,
    startTime,
    endDate,
    endTime,
    duration
  } = request.body;
  const taskService = new TaskService({ db: request.server.db });

  try {
    const task = taskService.create({
      title,
      bodyMd: bodyMd ?? '', // Default to empty string if undefined
      status,
      // New scheduling fields
      scheduledStart,
      scheduledEnd,
      isAllDay,
      // Deprecated fields
      scheduledOn,
      startTime,
      endDate,
      endTime,
      duration
    });
    const labels = taskService.listLabels(task.id);
    return reply.status(201).send({ ...task, labels });
  } catch (error) {
    throw error;
  }
}

/**
 * Default pagination values
 */
const DEFAULT_LIMIT = 100;
const DEFAULT_OFFSET = 0;

/**
 * Return a filtered list of tasks.
 */
export async function listTasksHandler(
  request: FastifyRequest<{
    Querystring: {
      status?: string;
      bookmarked?: string;
      label?: string;
      search?: string;
      scheduledFrom?: string;
      scheduledTo?: string;
      limit?: number;
      offset?: number;
    };
  }>,
  reply: FastifyReply
) {
  const taskService = new TaskService({ db: request.server.db });
  const { status, bookmarked, label, search, scheduledFrom, scheduledTo, limit, offset } = request.query;

  const actualLimit = limit ?? DEFAULT_LIMIT;
  const actualOffset = offset ?? DEFAULT_OFFSET;

  const filters: any = {
    limit: actualLimit,
    offset: actualOffset,
  };
  if (status) {
    filters.status = status;
  }
  if (bookmarked === 'true') {
    filters.isBookmarked = true;
  }
  if (label) {
    filters.labels = label.split(',').map(l => l.trim()).filter(Boolean);
  }
  if (search) {
    filters.search = search;
  }
  if (scheduledFrom) {
    filters.scheduledFrom = scheduledFrom;
  }
  if (scheduledTo) {
    filters.scheduledTo = scheduledTo;
  }

  try {
    const result = taskService.list(filters);
    return reply.status(200).send({
      data: result.data,
      total: result.total,
      limit: actualLimit,
      offset: actualOffset,
    });
  } catch (error) {
    throw error;
  }
}

/**
 * Retrieve a single task by numeric identifier.
 */
export async function getTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.id, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    const task = taskService.show(taskId);

    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    const labels = taskService.listLabels(taskId);
    return reply.status(200).send({ ...task, labels });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Task', taskId);
    }
    throw error;
  }
}

/**
 * Update task fields based on the provided payload.
 */
export async function updateTaskHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: UpdateTaskRequest;
  }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.id, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    const task = taskService.edit({
      id: taskId,
      ...request.body,
    });

    const labels = taskService.listLabels(taskId);
    return reply.status(200).send({ ...task, labels });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Task', taskId);
    }
    throw error;
  }
}

/**
 * Soft-delete a task so it is excluded from active listings.
 */
export async function deleteTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.id, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    taskService.remove(taskId);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Task', taskId);
    }
    throw error;
  }
}

/**
 * Transition a task to the `done` status.
 */
export async function closeTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.id, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    taskService.close(taskId);
    const task = taskService.show(taskId);
    return reply.status(200).send(task);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Task', taskId);
    }
    throw error;
  }
}

/**
 * Transition a task to the `canceled` status.
 */
export async function cancelTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.id, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    taskService.cancel(taskId);
    const task = taskService.show(taskId);
    return reply.status(200).send(task);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Task', taskId);
    }
    throw error;
  }
}

/**
 * Transition a task back to the `open` status.
 */
export async function reopenTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.id, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    taskService.reopen(taskId);
    const task = taskService.show(taskId);
    return reply.status(200).send(task);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Task', taskId);
    }
    throw error;
  }
}

/**
 * Mark a task as bookmarked.
 */
export async function bookmarkTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.id, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    taskService.setBookmark(taskId, true);
    const task = taskService.show(taskId);
    return reply.status(200).send(task);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Task', taskId);
    }
    throw error;
  }
}

/**
 * Remove the bookmarked flag from a task.
 */
export async function unbookmarkTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.id, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    taskService.setBookmark(taskId, false);
    const task = taskService.show(taskId);
    return reply.status(200).send(task);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Task', taskId);
    }
    throw error;
  }
}

/**
 * Demote a task to a memo (copy task content to create a new memo).
 */
export async function demoteTaskHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: DemoteTaskRequest;
  }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.id, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    const result = taskService.demote({
      taskId,
      bodyMd: request.body.bodyMd,
      labels: request.body.labels,
    });
    // Add labels to the task in response (schema requires it)
    const labels = taskService.listLabels(taskId);
    return reply.status(201).send({
      task: { ...result.task, labels },
      memoId: result.memoId,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Task', taskId);
    }
    throw error;
  }
}
