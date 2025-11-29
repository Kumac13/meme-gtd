import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import { CommentsService } from '../api/services/CommentsService';
import { ProjectsService } from '../api/services/ProjectsService';
import { LinksService } from '../api/services/LinksService';
import MemoForm from '../components/MemoForm';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { buildMemoBodyFromTask } from '../utils/archiveTaskToMemo';

interface Task {
  id: number;
  title: string | null;
  bodyMd: string;
  labels?: string[];
}

interface Comment {
  id: number;
  bodyMd: string;
  createdAt: string;
}

interface Project {
  id: number;
  name: string;
}

interface IssueLink {
  id: number;
  sourceIssueId: number;
  targetIssueId: number;
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';
  direction: 'outgoing' | 'incoming';
  targetIssue: {
    id: number;
    type: 'task' | 'memo';
    title: string;
  };
}

export default function MemoNew() {
  const [searchParams] = useSearchParams();
  const fromTaskId = searchParams.get('fromTask');

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [links, setLinks] = useState<IssueLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fromTaskId) {
      async function fetchTask() {
        try {
          setLoading(true);
          setError(null);
          const [taskData, commentsData, projectsData, linksData] = await Promise.all([
            TasksService.getTask(fromTaskId as string),
            CommentsService.listTaskComments(fromTaskId as string),
            ProjectsService.getProjectsForIssue(fromTaskId as string),
            LinksService.listIssueLinks(fromTaskId as string),
          ]);
          setTask(taskData as Task);
          setComments(commentsData as Comment[]);
          setProjects(projectsData as Project[]);
          setLinks(linksData as IssueLink[]);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load task');
          console.error('Error fetching task:', err);
        } finally {
          setLoading(false);
        }
      }
      fetchTask();
    }
  }, [fromTaskId]);

  if (loading) {
    return <LoadingState message="Loading task..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading task" />;
  }

  // Build initial body from task content
  const initialBody = task ? buildMemoBodyFromTask(task, comments) : '';

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-6">
        <Link
          to="/memos"
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to memos
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          {task ? 'Archive Task to Memo' : 'Create New Memo'}
        </h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <MemoForm
          mode="create"
          initialBodyMd={initialBody}
          fromTaskId={task?.id}
          initialLabels={task?.labels}
          initialProjectIds={projects.map(p => p.id)}
          initialLinks={links}
        />
      </div>
    </div>
  );
}
