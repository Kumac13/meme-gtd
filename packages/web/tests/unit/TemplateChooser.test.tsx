import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LabelsService } from '../../src/api/services/LabelsService';
import { TemplatesService } from '../../src/api/services/TemplatesService';
import TemplateChooser from '../../src/components/TemplateChooser';
import TemplateCreationFlow from '../../src/components/TemplateCreationFlow';

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
    const onSelect = vi.fn();

    render(
      <TemplateChooser
        target="task"
        onSelect={onSelect}
      />
    );

    expect(await screen.findByRole('button', { name: 'Daily review' })).toBeInTheDocument();
    expect(TemplatesService.listTemplates).toHaveBeenCalledWith(undefined, undefined, undefined, 'task');

    fireEvent.click(screen.getByRole('button', { name: 'Blank task' }));
    expect(onSelect).toHaveBeenCalledWith({ bodyMd: '', labelIds: [], projectIds: [] });
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
    const onSelect = vi.fn();

    render(
      <TemplateChooser
        target="task"
        onSelect={onSelect}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Daily review' }));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({
        bodyMd: 'Template body',
        labelIds: [11],
        projectIds: [3],
      });
    });
  });

  it('owns the chooser-to-form transition', async () => {
    render(
      <TemplateCreationFlow target="article">
        {(initialValues) => <div>Form body: {initialValues.bodyMd || 'blank'}</div>}
      </TemplateCreationFlow>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Blank article' }));

    expect(screen.getByText('Form body: blank')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Blank article' })).not.toBeInTheDocument();
  });

});
