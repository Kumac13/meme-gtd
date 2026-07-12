import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TaskKind } from 'meme-gtd-shared';
import { TasksService } from '../api/services/TasksService';
import { ProjectsService } from '../api/services/ProjectsService';
import { LabelsService } from '../api/services/LabelsService';
import { LinksService } from '../api/services/LinksService';
import { UrlLinksService } from '../api/services/UrlLinksService';
import { isPendingIssueLink, isPendingUrlLink } from '../types/links';
import { validateTaskForm } from '../utils/validation';
import { ScheduleInput, type ScheduleInputValue } from './ScheduleInput';
import type { PendingLink } from '../types/links';
import IssueForm, { type IssueFormValues } from './IssueForm';

type TaskStatus = 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';

interface TaskFormProps {
  initialTitle?: string;
  initialBodyMd?: string;
  initialStatus?: TaskStatus;
  initialTaskKind?: TaskKind;
  initialLinks?: PendingLink[];
  initialLabelIds?: number[];
  initialProjectIds?: number[];
  taskId?: number;
  mode: 'create' | 'edit';
  onTaskCreated?: (taskId: number) => void;
  /** Pre-select this project when the form loads */
  initialProjectId?: number;
  /** This project cannot be deselected (locked) */
  lockedProjectId?: number;
  /** Callback when cancel is clicked (for modal usage) */
  onCancel?: () => void;
}

/**
 * Task create/edit form. A thin wrapper over the shared IssueForm: it owns the
 * task-specific fields (status, kind, schedule) rendered via renderExtraFields
 * and the task-specific persistence (createTask/updateTask + label/project/link
 * assignment) via onSubmit.
 */
export default function TaskForm({
  initialTitle = '',
  initialBodyMd = '',
  initialStatus = 'inbox',
  initialTaskKind = 'action',
  initialLinks = [],
  initialLabelIds = [],
  initialProjectIds,
  taskId,
  mode,
  onTaskCreated,
  initialProjectId,
  lockedProjectId,
  onCancel,
}: TaskFormProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [taskKind, setTaskKind] = useState<TaskKind>(initialTaskKind);
  const [scheduleData, setScheduleData] = useState<ScheduleInputValue>({
    scheduledStart: null,
    scheduledEnd: null,
    isAllDay: false,
  });
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (mode === 'edit' && taskId) {
      navigate(`/tasks/${taskId}`);
    } else {
      navigate('/tasks');
    }
  };

  const handleSubmit = async (values: IssueFormValues) => {
    if (mode === 'create') {
      const task = await TasksService.createTask({
        title: values.title,
        bodyMd: values.bodyMd || undefined,
        status,
        taskKind,
        scheduledStart: scheduleData.scheduledStart || undefined,
        scheduledEnd: scheduleData.scheduledEnd || undefined,
        isAllDay: scheduleData.isAllDay,
      });

      if (values.labelIds.length > 0) {
        await Promise.all(
          values.labelIds.map((labelId) =>
            LabelsService.assignLabelToIssue(task.id.toString(), { labelId })
          )
        );
      }

      if (values.projectIds.length > 0) {
        await Promise.all(
          values.projectIds.map((projectId) =>
            ProjectsService.addProjectItem(projectId.toString(), { issueId: task.id })
          )
        );
      }

      if (values.links.length > 0) {
        const linkResults = await Promise.allSettled([
          ...values.links.filter(isPendingIssueLink).map((link) =>
            LinksService.createLink({
              sourceIssueId: task.id,
              targetIssueId: link.targetIssueId,
              linkType: link.linkType,
              isPromotion: link.isPromotion,
            })
          ),
          ...values.links.filter(isPendingUrlLink).map((link) =>
            UrlLinksService.createUrlLink(String(task.id), { url: link.url, title: link.title })
          ),
        ]);
        const failed = linkResults.filter((r) => r.status === 'rejected');
        if (failed.length > 0) console.warn(`Failed to create ${failed.length} link(s):`, failed);
      }

      if (onTaskCreated) {
        onTaskCreated(task.id);
      } else {
        navigate(`/tasks/${task.id}`);
      }
    } else if (mode === 'edit' && taskId) {
      await TasksService.updateTask(taskId.toString(), {
        title: values.title,
        bodyMd: values.bodyMd || undefined,
        status,
        taskKind,
      });
      navigate(`/tasks/${taskId}`);
    }
  };

  const chevron = (open: boolean) => (
    <span className="text-gray-400 group-hover:text-gray-600">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
      </svg>
    </span>
  );

  return (
    <IssueForm
      initialTitle={initialTitle}
      initialBodyMd={initialBodyMd}
      initialLabelIds={initialLabelIds}
      initialProjectIds={initialProjectIds}
      initialLinks={initialLinks}
      initialProjectId={initialProjectId}
      lockedProjectId={lockedProjectId}
      titleLabel="Task Title *"
      titlePlaceholder="Enter task title..."
      bodyLabel="Task Description (Markdown, optional)"
      bodyPlaceholder="Enter task description in Markdown format..."
      submitLabel={mode === 'create' ? 'Create Task' : 'Update Task'}
      errorTitle="Error saving task"
      showProjects={mode === 'create'}
      showLabels={mode === 'create'}
      showLinks={mode === 'create'}
      validate={(v) => {
        const validation = validateTaskForm(v.title, v.bodyMd, status);
        if (validation.isValid) return null;
        return Object.values(validation.errors).join(', ') || 'Invalid task data';
      }}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      renderExtraFields={() => (
        <>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-github-green-500 appearance-none bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20viewBox%3d%220%200%2020%2020%22%20fill%3d%22%236b7280%22%3e%3cpath%20fill-rule%3d%22evenodd%22%20d%3d%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3d%22evenodd%22%2f%3e%3c%2fsvg%3e')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
            >
              <option value="inbox">Inbox</option>
              <option value="open">Open</option>
              <option value="next">Next</option>
              <option value="waiting">Waiting</option>
              <option value="scheduled">Scheduled</option>
              <option value="someday">Someday</option>
              <option value="done">Done</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Kind</label>
            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              <button type="button" onClick={() => setTaskKind('action')} className={`flex-1 px-3 py-2 text-sm ${taskKind === 'action' ? 'bg-github-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Action</button>
              <button type="button" onClick={() => setTaskKind('event')} className={`flex-1 px-3 py-2 text-sm border-l border-gray-300 ${taskKind === 'event' ? 'bg-github-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Event</button>
            </div>
          </div>

          {mode === 'create' && (
            <div className="border-b border-gray-200 pb-4">
              <button type="button" onClick={() => setIsScheduleOpen(!isScheduleOpen)} className="flex items-center justify-between w-full text-left mb-2 group">
                <label className="block text-sm font-medium text-gray-700 cursor-pointer group-hover:text-gray-900">Schedule</label>
                {chevron(isScheduleOpen)}
              </button>
              {isScheduleOpen && (
                <div className="mt-2">
                  <ScheduleInput value={scheduleData} onChange={setScheduleData} />
                </div>
              )}
              {!isScheduleOpen && scheduleData.scheduledStart && (
                <div className="text-sm text-gray-600 mt-1">
                  Scheduled: {scheduleData.scheduledStart.split('T')[0]}
                  {!scheduleData.isAllDay && scheduleData.scheduledStart.split('T')[1] && ` @ ${scheduleData.scheduledStart.split('T')[1].slice(0, 5)}`}
                  {scheduleData.isAllDay && ' (All day)'}
                </div>
              )}
            </div>
          )}
        </>
      )}
    />
  );
}
