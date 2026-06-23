import type { FastifyRequest, FastifyReply } from 'fastify';
import { MemoService, TaskService } from 'meme-gtd-core';
import { NotFoundError } from '../errors/index.js';
import type {
  CreateCommentRequest,
  UpdateCommentRequest,
} from '../schemas/commentSchemas.js';

/**
 * List all comments for a memo
 */
export async function listMemoCommentsHandler(
  request: FastifyRequest<{ Params: { memoId: string } }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.memoId, 10);
  const memoService = new MemoService({ db: request.server.db });

  try {
    const comments = memoService.listComments(memoId);
    return reply.status(200).send(comments);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Memo', memoId);
    }
    throw error;
  }
}

/**
 * Create a comment on a memo
 */
export async function createMemoCommentHandler(
  request: FastifyRequest<{
    Params: { memoId: string };
    Body: CreateCommentRequest;
  }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.memoId, 10);
  const { bodyMd, clientUuid } = request.body;
  const memoService = new MemoService({ db: request.server.db });

  try {
    const comment = memoService.addComment(memoId, bodyMd, clientUuid);
    return reply.status(201).send(comment);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Memo', memoId);
    }
    // Handle FOREIGN KEY constraint errors (memo doesn't exist)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      throw new NotFoundError('Memo', memoId);
    }
    throw error;
  }
}

/**
 * Update a comment on a memo
 */
export async function updateMemoCommentHandler(
  request: FastifyRequest<{
    Params: { memoId: string; commentId: string };
    Body: UpdateCommentRequest;
  }>,
  reply: FastifyReply
) {
  const commentId = parseInt(request.params.commentId, 10);
  const { bodyMd } = request.body;
  const memoService = new MemoService({ db: request.server.db });

  try {
    const comment = memoService.updateComment(commentId, bodyMd);
    return reply.status(200).send(comment);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Comment', commentId);
    }
    throw error;
  }
}

/**
 * Delete a comment from a memo
 */
export async function deleteMemoCommentHandler(
  request: FastifyRequest<{
    Params: { memoId: string; commentId: string };
  }>,
  reply: FastifyReply
) {
  const commentId = parseInt(request.params.commentId, 10);
  const memoService = new MemoService({ db: request.server.db });

  try {
    memoService.deleteComment(commentId);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Comment', commentId);
    }
    throw error;
  }
}

/**
 * List all comments for a task
 */
export async function listTaskCommentsHandler(
  request: FastifyRequest<{ Params: { taskId: string } }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.taskId, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    const comments = taskService.listComments(taskId);
    return reply.status(200).send(comments);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Task', taskId);
    }
    throw error;
  }
}

/**
 * Create a comment on a task
 */
export async function createTaskCommentHandler(
  request: FastifyRequest<{
    Params: { taskId: string };
    Body: CreateCommentRequest;
  }>,
  reply: FastifyReply
) {
  const taskId = parseInt(request.params.taskId, 10);
  const { bodyMd } = request.body;
  const taskService = new TaskService({ db: request.server.db });

  try {
    const comment = taskService.addComment(taskId, bodyMd);
    return reply.status(201).send(comment);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Task', taskId);
    }
    // Handle FOREIGN KEY constraint errors (task doesn't exist)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      throw new NotFoundError('Task', taskId);
    }
    throw error;
  }
}

/**
 * Update a comment on a task
 */
export async function updateTaskCommentHandler(
  request: FastifyRequest<{
    Params: { taskId: string; commentId: string };
    Body: UpdateCommentRequest;
  }>,
  reply: FastifyReply
) {
  const commentId = parseInt(request.params.commentId, 10);
  const { bodyMd } = request.body;
  const taskService = new TaskService({ db: request.server.db });

  try {
    const comment = taskService.updateComment(commentId, bodyMd);
    return reply.status(200).send(comment);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Comment', commentId);
    }
    throw error;
  }
}

/**
 * Delete a comment from a task
 */
export async function deleteTaskCommentHandler(
  request: FastifyRequest<{
    Params: { taskId: string; commentId: string };
  }>,
  reply: FastifyReply
) {
  const commentId = parseInt(request.params.commentId, 10);
  const taskService = new TaskService({ db: request.server.db });

  try {
    taskService.deleteComment(commentId);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Comment', commentId);
    }
    throw error;
  }
}
