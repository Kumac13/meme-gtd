/**
 * Project handlers
 * Feature: Issue #19 - Project Management CLI Commands and API
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { ProjectService } from 'meme-gtd-core';
import { NotFoundError, ConflictError } from '../errors/index.js';
import type {
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectIdParams,
  AddProjectItemRequest,
  UpdateProjectItemRequest,
  ProjectItemParams,
} from '../schemas/projectSchemas.js';

/**
 * Create a new project
 * POST /api/projects
 */
/**
 * Create a new project
 * POST /api/projects
 */
export async function createProjectHandler(
  request: FastifyRequest<{ Body: CreateProjectRequest }>,
  reply: FastifyReply
) {
  const { name, description, view, status, startDate, endDate } = request.body;
  const projectService = new ProjectService({ db: request.server.db });

  try {
    const project = projectService.create({
      name,
      description: description ?? null,
      view,
      status,
      startDate,
      endDate,
    });
    return reply.status(201).send(project);
  } catch (error) {
    if (error instanceof Error) {
      // Duplicate project name
      if (error.message.includes('already exists')) {
        throw new ConflictError(error.message);
      }
    }
    throw error;
  }
}

/**
 * List all projects
 * GET /api/projects
 */
export async function listProjectsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const projectService = new ProjectService({ db: request.server.db });

  try {
    const projects = projectService.list();
    return reply.status(200).send(projects);
  } catch (error) {
    throw error;
  }
}

/**
 * Get project by ID with items
 * GET /api/projects/:id
 */
export async function getProjectHandler(
  request: FastifyRequest<{ Params: ProjectIdParams }>,
  reply: FastifyReply
) {
  const projectId = parseInt(request.params.id, 10);
  const projectService = new ProjectService({ db: request.server.db });

  try {
    const project = projectService.getById(projectId);
    return reply.status(200).send(project);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Project', projectId);
    }
    throw error;
  }
}

/**
 * Update a project (name, description, status, dates)
 * PATCH /api/projects/:id
 */
export async function updateProjectHandler(
  request: FastifyRequest<{ Params: ProjectIdParams; Body: UpdateProjectRequest }>,
  reply: FastifyReply
) {
  const projectId = parseInt(request.params.id, 10);
  const { name, description, status, startDate, endDate } = request.body;
  const projectService = new ProjectService({ db: request.server.db });

  try {
    const project = projectService.update(projectId, {
      name,
      description,
      status,
      startDate,
      endDate,
    });
    return reply.status(200).send(project);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Project', projectId);
    }
    throw error;
  }
}

/**
 * Delete a project
 * DELETE /api/projects/:id
 */
export async function deleteProjectHandler(
  request: FastifyRequest<{ Params: ProjectIdParams }>,
  reply: FastifyReply
) {
  const projectId = parseInt(request.params.id, 10);
  const projectService = new ProjectService({ db: request.server.db });

  try {
    projectService.delete(projectId);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Project', projectId);
    }
    throw error;
  }
}

/**
 * Add item to project
 * POST /api/projects/:id/items
 */
export async function addProjectItemHandler(
  request: FastifyRequest<{
    Params: ProjectIdParams;
    Body: AddProjectItemRequest;
  }>,
  reply: FastifyReply
) {
  const projectId = parseInt(request.params.id, 10);
  const { issueId, position, column } = request.body;
  const projectService = new ProjectService({ db: request.server.db });

  try {
    const projectItem = projectService.addItem(projectId, {
      issueId,
      position,
      column: column ?? null,
    });
    return reply.status(201).send(projectItem);
  } catch (error) {
    if (error instanceof Error) {
      // Project not found
      if (error.message.includes('Project') && error.message.includes('not found')) {
        throw new NotFoundError('Project', projectId);
      }
      // Issue not found
      if (error.message.includes('Issue') && error.message.includes('not found')) {
        const match = error.message.match(/Issue #(\d+)/);
        if (match) {
          throw new NotFoundError('Issue', parseInt(match[1], 10));
        }
      }
      // Duplicate item
      if (error.message.includes('already in project')) {
        throw new ConflictError(error.message);
      }
    }
    throw error;
  }
}

/**
 * Update project item (move to new position/column)
 * PATCH /api/projects/:id/items/:issueId
 */
export async function updateProjectItemHandler(
  request: FastifyRequest<{
    Params: ProjectItemParams;
    Body: UpdateProjectItemRequest;
  }>,
  reply: FastifyReply
) {
  const projectId = parseInt(request.params.id, 10);
  const issueId = parseInt(request.params.issueId, 10);
  const { position, column } = request.body;
  const projectService = new ProjectService({ db: request.server.db });

  try {
    const projectItem = projectService.updateItem(projectId, issueId, {
      position,
      column: column ?? undefined,
    });
    return reply.status(200).send(projectItem);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('ProjectItem', `${projectId}/${issueId}`);
    }
    throw error;
  }
}

/**
 * Remove item from project
 * DELETE /api/projects/:id/items/:issueId
 */
export async function removeProjectItemHandler(
  request: FastifyRequest<{ Params: ProjectItemParams }>,
  reply: FastifyReply
) {
  const projectId = parseInt(request.params.id, 10);
  const issueId = parseInt(request.params.issueId, 10);
  const projectService = new ProjectService({ db: request.server.db });

  try {
    projectService.removeItem(projectId, issueId);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('ProjectItem', `${projectId}/${issueId}`);
    }
    throw error;
  }
}

/**
 * Get projects for an issue
 * GET /api/issues/:id/projects
 */
export async function getProjectsForIssueHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const issueId = parseInt(request.params.id, 10);
  const projectService = new ProjectService({ db: request.server.db });

  const projects = projectService.getProjectsForIssue(issueId);
  return reply.status(200).send(projects);
}
