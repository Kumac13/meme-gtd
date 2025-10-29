import type { FastifyRequest, FastifyReply } from 'fastify';
import { LabelService } from 'meme-gtd-core';
import { NotFoundError, ConflictError } from '../errors/index.js';
import type {
  CreateLabelRequest,
  AssignLabelRequest,
  RemoveLabelParams,
} from '../schemas/labelSchemas.js';

/**
 * List all labels
 */
export async function listLabelsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const labelService = new LabelService({ db: request.server.db });

  try {
    const labels = labelService.list();
    return reply.status(200).send(labels);
  } catch (error) {
    throw error;
  }
}

/**
 * Create a new label
 */
export async function createLabelHandler(
  request: FastifyRequest<{ Body: CreateLabelRequest }>,
  reply: FastifyReply
) {
  const { name, description } = request.body;
  const labelService = new LabelService({ db: request.server.db });

  try {
    const label = labelService.create(name, description);
    return reply.status(201).send(label);
  } catch (error) {
    // Handle duplicate label error
    if (error instanceof Error && error.message.includes('already exists')) {
      throw new ConflictError(error.message);
    }
    throw error;
  }
}

/**
 * Assign a label to an issue (idempotent)
 */
export async function assignLabelHandler(
  request: FastifyRequest<{
    Params: { issueId: string };
    Body: AssignLabelRequest;
  }>,
  reply: FastifyReply
) {
  const issueId = parseInt(request.params.issueId, 10);
  const { labelId } = request.body;
  const labelService = new LabelService({ db: request.server.db });

  try {
    labelService.assignToIssue(issueId, labelId);
    return reply.status(200).send({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      // Could be issue not found or label not found
      if (error.message.includes('Issue')) {
        throw new NotFoundError('Issue', issueId);
      } else if (error.message.includes('Label')) {
        throw new NotFoundError('Label', labelId);
      }
    }
    throw error;
  }
}

/**
 * Remove a label from an issue (idempotent)
 */
export async function removeLabelFromIssueHandler(
  request: FastifyRequest<{ Params: RemoveLabelParams }>,
  reply: FastifyReply
) {
  const issueId = parseInt(request.params.issueId, 10);
  const labelId = request.params.labelId;
  const labelService = new LabelService({ db: request.server.db });

  try {
    labelService.removeFromIssue(issueId, labelId);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      // Could be issue not found or label not found
      if (error.message.includes('Issue')) {
        throw new NotFoundError('Issue', issueId);
      } else if (error.message.includes('Label')) {
        throw new NotFoundError('Label', labelId);
      }
    }
    throw error;
  }
}

/**
 * Delete a label by name
 */
export async function deleteLabelHandler(
  request: FastifyRequest<{ Params: { name: string } }>,
  reply: FastifyReply
) {
  const { name } = request.params;
  const labelService = new LabelService({ db: request.server.db });

  try {
    labelService.delete(name);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Label', name);
    }
    throw error;
  }
}
