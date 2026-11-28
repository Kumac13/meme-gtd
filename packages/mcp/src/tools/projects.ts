import { z } from 'zod';
import { defineTool, requireTask, ToolInputError, type ToolContext } from '../toolkit.js';
import { Project, ProjectDetail, ProjectItem, id } from '../schemas.js';

export function registerProjectTools(context: ToolContext): void {
  defineTool(context, {
    name: 'list_projects',
    title: 'List projects',
    description: 'Use this when you need the available projects and their IDs, status and dates. Projects cannot be created, edited or deleted through these tools.',
    kind: 'read',
    input: {},
    output: { projects: z.array(Project) },
    run: async (_args, api) => ({ projects: await api.get('/api/projects') }),
  });

  defineTool(context, {
    name: 'get_project',
    title: 'Get project',
    description: 'Use this when you need one project with all the items (tasks, memos, articles) that belong to it, including each item\'s position and board column.',
    kind: 'read',
    input: { id: id('project') },
    output: { project: ProjectDetail },
    run: async (args, api) => ({ project: await api.get(`/api/projects/${args.id}`) }),
  });

  defineTool(context, {
    name: 'get_projects_for_issue',
    title: 'Get projects for issue',
    description: 'Use this when you need to know which projects a task, memo or article belongs to.',
    kind: 'read',
    input: { issueId: id('issue (task, memo or article)') },
    output: { projects: z.array(Project) },
    run: async (args, api) => ({ projects: await api.get(`/api/issues/${args.issueId}/projects`) }),
  });

  defineTool(context, {
    name: 'add_project_item',
    title: 'Add issue to project',
    description: 'Use this when the user asks to put a task, memo or article into a project. Fails if the issue is already in that project. Returns the new project item.',
    kind: 'create',
    input: {
      projectId: id('project'),
      issueId: id('issue (task, memo or article)'),
      position: z.number().optional().describe('Position in the project. Defaults to the end.'),
      column: z.string().min(1).optional().describe('Board column name, one of the project\'s viewMeta.columns.'),
    },
    output: { item: ProjectItem },
    run: async ({ projectId, ...body }, api) => ({ item: await api.post(`/api/projects/${projectId}/items`, body) }),
  });

  defineTool(context, {
    name: 'update_project_item',
    title: 'Move task within project',
    description: 'Use this when the user asks to reorder a task inside a project or move it to another board column. Only works for tasks; the task must already be in the project. Pass position, column, or both. Passing column as null removes the task from its column.',
    kind: 'update',
    input: {
      projectId: id('project'),
      taskId: id('task'),
      position: z.number().optional().describe('New position in the project.'),
      column: z.string().min(1).nullable().optional().describe('New board column name, or null to clear it.'),
    },
    output: { item: ProjectItem },
    run: async ({ projectId, taskId, ...body }, api) => {
      if (body.position === undefined && body.column === undefined) {
        throw new ToolInputError('Pass position, column, or both.');
      }
      await requireTask(api, taskId);
      return { item: await api.patch(`/api/projects/${projectId}/items/${taskId}`, body) };
    },
  });

  defineTool(context, {
    name: 'remove_project_item',
    title: 'Remove task from project',
    description: 'Use this when the user asks to take a task out of a project. Only works for tasks. The task itself is not deleted.',
    kind: 'delete',
    input: { projectId: id('project'), taskId: id('task') },
    output: { removed: z.literal(true), projectId: z.number().int(), taskId: z.number().int() },
    run: async (args, api) => {
      await requireTask(api, args.taskId);
      await api.delete(`/api/projects/${args.projectId}/items/${args.taskId}`);
      return { removed: true, projectId: args.projectId, taskId: args.taskId };
    },
  });
}
