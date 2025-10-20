import type { FastifyRequest, FastifyReply } from 'fastify';
import { TaskService } from 'meme-gtd-core';
import { NotFoundError } from '../errors/index.js';
import type {
  CreateTaskRequest,
  UpdateTaskRequest,
} from '../schemas/taskSchemas.js';

/**
 * Create a new task
 */
export async function createTaskHandler(
  request: FastifyRequest<{ Body: CreateTaskRequest }>,
  reply: FastifyReply
) {
  const { title, bodyMd, status, scheduledOn } = request.body;
  const taskService = new TaskService({ db: request.server.db });

  try {
    const task = taskService.create({ title, bodyMd, status, scheduledOn });
    return reply.status(201).send(task);
  } catch (error) {
    throw error;
  }
}

/**
 * List all tasks with optional filters
 */
export async function listTasksHandler(
  request: FastifyRequest<{
    Querystring: { status?: string; bookmarked?: string };
  }>,
  reply: FastifyReply
) {
  const taskService = new TaskService({ db: request.server.db });
  const { status, bookmarked } = request.query;

  const filters: any = {};
  if (status) {
    filters.status = status;
  }
  if (bookmarked === 'true') {
    filters.isBookmarked = true;
  }

  try {
    const tasks = taskService.list(filters);
    return reply.status(200).send(tasks);
  } catch (error) {
    throw error;
  }
}

/**
 * Get a task by ID
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

    return reply.status(200).send(task);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Task', taskId);
    }
    throw error;
  }
}

/**
 * Update a task
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

    return reply.status(200).send(task);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Task', taskId);
    }
    throw error;
  }
}

/**
 * Delete a task (soft delete)
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
 * Close a task (set status to 'done')
 */
export async function closeTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.id, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    taskService.setStatus(taskId, 'done');
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
 * Cancel a task (set status to 'canceled')
 */
export async function cancelTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.id, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    taskService.setStatus(taskId, 'canceled');
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
 * Reopen a task (set status to 'open')
 */
export async function reopenTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.id, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    taskService.setStatus(taskId, 'open');
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
 * Bookmark a task
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
 * Unbookmark a task
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
