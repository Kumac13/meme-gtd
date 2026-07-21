import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LabelsService } from '../../src/api/services/LabelsService';
import { TemplatesService } from '../../src/api/services/TemplatesService';
import TemplateChooser from '../../src/components/TemplateChooser';

vi.mock('../../src/api/services/TemplatesService', () => ({
  TemplatesService: {
    listTemplates: vi.fn(),
    getTemplate: vi.fn(),
  },
}));

vi.mock('../../src/api/services/LabelsService', () => ({
  LabelsService: {
    listLabels: vi.fn(),
  },
}));

describe('TemplateChooser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(TemplatesService.listTemplates).mockResolvedValue({
      data: [{ id: 7, title: 'Daily review' }],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    } as never);
  });

  it('loads templates for the requested target and supports blank creation', async () => {
    const onBlank = vi.fn();

    render(
      <TemplateChooser
        target="task"
        blankLabel="Blank task"
        onBlank={onBlank}
        onTemplate={vi.fn()}
      />
    );

    expect(await screen.findByRole('button', { name: 'Daily review' })).toBeInTheDocument();
    expect(TemplatesService.listTemplates).toHaveBeenCalledWith(undefined, undefined, undefined, 'task');

    fireEvent.click(screen.getByRole('button', { name: 'Blank task' }));
    expect(onBlank).toHaveBeenCalledOnce();
  });

  it('converts template labels and projects into shared form initial values', async () => {
    vi.mocked(TemplatesService.getTemplate).mockResolvedValue({
      id: 7,
      title: 'Daily review',
      bodyMd: 'Template body',
      labels: ['work', 'missing'],
      projectIds: [3],
    } as never);
    vi.mocked(LabelsService.listLabels).mockResolvedValue([
      { id: 11, name: 'work' },
    ] as never);
    const onTemplate = vi.fn();

    render(
      <TemplateChooser
        target="task"
        blankLabel="Blank task"
        onBlank={vi.fn()}
        onTemplate={onTemplate}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Daily review' }));

    await waitFor(() => {
      expect(onTemplate).toHaveBeenCalledWith({
        bodyMd: 'Template body',
        labelIds: [11],
        projectIds: [3],
      });
    });
  });
});
