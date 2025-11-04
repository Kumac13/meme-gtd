import type { FastifyRequest, FastifyReply } from 'fastify';
import { TaskService } from 'meme-gtd-core';
import { NotFoundError } from '../errors/index.js';
import type {
  CreateTaskRequest,
  UpdateTaskRequest,
} from '../schemas/taskSchemas.js';

/**
 * Create a new task from the supplied payload.
 */
export async function createTaskHandler(
  request: FastifyRequest<{ Body: CreateTaskRequest }>,
  reply: FastifyReply
) {
  const { title, bodyMd, status, scheduledOn } = request.body;
  const taskService = new TaskService({ db: request.server.db });

  try {
    const task = taskService.create({
      title,
      bodyMd: bodyMd ?? '', // Default to empty string if undefined
      status,
      scheduledOn
    });
    const labels = taskService.listLabels(task.id);
    return reply.status(201).send({ ...task, labels });
  } catch (error) {
    throw error;
  }
}

/**
 * Return a filtered list of tasks.
 */
export async function listTasksHandler(
  request: FastifyRequest<{
    Querystring: { status?: string; bookmarked?: string; label?: string; search?: string };
  }>,
  reply: FastifyReply
) {
  const taskService = new TaskService({ db: request.server.db });
  const { status, bookmarked, label, search } = request.query;

  const filters: any = {};
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

  try {
    const tasks = taskService.list(filters);
    return reply.status(200).send(tasks);
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
