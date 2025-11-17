import { z } from 'zod';
import { TaskStatusSchema } from './taskSchemas.js';

/**
 * Schema for view type
 */
export const ViewTypeSchema = z.enum(['board', 'table']);

export type ViewType = z.infer<typeof ViewTypeSchema>;

/**
 * Schema for view metadata
 */
export const ViewMetaSchema = z.object({
  viewType: ViewTypeSchema.describe('View type: board or table'),
  columns: z.array(z.string()).optional().describe('Column names for board view'),
});

export type ViewMeta = z.infer<typeof ViewMetaSchema>;

/**
 * Schema for creating a new project
 */
export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1).max(255).describe('Project name (must be unique)'),
  description: z.string().optional().nullable().describe('Optional project description'),
  view: ViewTypeSchema.optional().default('board').describe('View type (defaults to board)'),
});

export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

/**
 * Schema for project response
 */
export const ProjectSchema = z.object({
  id: z.number().int().positive().describe('Unique project ID'),
  name: z.string().describe('Project name'),
  description: z.string().nullable().describe('Project description'),
  viewMeta: ViewMetaSchema.describe('View configuration'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
});

export type Project = z.infer<typeof ProjectSchema>;

/**
 * Schema for project item (in project detail)
 */
export const ProjectItemSchema = z.object({
  id: z.number().int().positive().describe('Project item ID'),
  projectId: z.number().int().positive().describe('Project ID'),
  issueId: z.number().int().positive().describe('Issue ID'),
  position: z.number().describe('Position in project'),
  viewMeta: z
    .object({
      column: z.string().optional(),
    })
    .nullable()
    .describe('Item view metadata'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
});

export type ProjectItem = z.infer<typeof ProjectItemSchema>;

/**
 * Schema for project item with issue information
 */
export const ProjectItemWithIssueSchema = ProjectItemSchema.extend({
  issue: z.object({
    id: z.number().int().positive().describe('Issue ID'),
    type: z.enum(['task', 'memo']).describe('Issue type'),
    title: z.string().describe('Issue title'),
    status: TaskStatusSchema.nullable().describe('Task status (null for memos)'),
  }).describe('Issue information'),
});

export type ProjectItemWithIssue = z.infer<typeof ProjectItemWithIssueSchema>;

/**
 * Schema for project detail (with items)
 */
export const ProjectDetailSchema = ProjectSchema.extend({
  items: z.array(ProjectItemWithIssueSchema).describe('Project items with issue information'),
});

export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;

/**
 * Schema for project ID params
 */
export const ProjectIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Project ID must be a number').describe('Project ID'),
});

export type ProjectIdParams = z.infer<typeof ProjectIdParamsSchema>;

/**
 * Schema for adding an item to a project
 */
export const AddProjectItemRequestSchema = z.object({
  issueId: z.number().int().positive().describe('Issue ID to add'),
  position: z.number().optional().describe('Position in project (defaults to end)'),
  column: z.string().optional().nullable().describe('Board column name'),
});

export type AddProjectItemRequest = z.infer<typeof AddProjectItemRequestSchema>;

/**
 * Schema for updating a project item
 */
export const UpdateProjectItemRequestSchema = z.object({
  position: z.number().optional().describe('New position'),
  column: z.string().optional().nullable().describe('New column'),
});

export type UpdateProjectItemRequest = z.infer<typeof UpdateProjectItemRequestSchema>;

/**
 * Schema for updating a project (name, description)
 */
export const UpdateProjectRequestSchema = z.object({
  name: z.string().min(1).max(255).optional().describe('Project name'),
  description: z.string().optional().nullable().describe('Project description'),
});

export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;

/**
 * Schema for project item path params (project ID + issue ID)
 */
export const ProjectItemParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Project ID must be a number').describe('Project ID'),
  issueId: z.string().regex(/^\d+$/, 'Issue ID must be a number').describe('Issue ID'),
});

export type ProjectItemParams = z.infer<typeof ProjectItemParamsSchema>;
