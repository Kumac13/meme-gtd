import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TaskConversionActions from '../../src/components/TaskConversionActions';
import { TasksService } from '../../src/api/services/TasksService';
vi.mock('../../src/api/services/TasksService', () => ({ TasksService: {
  archiveTaskToArticle: vi.fn(), transferTaskToMemo: vi.fn(),
} }));
function Location() { return <div data-testid="location">{useLocation().pathname}</div>; }
describe('Task conversions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('archives to an article and navigates to the new copy', async () => {
    vi.mocked(TasksService.archiveTaskToArticle).mockResolvedValue({ articleId: 20 });
    render(<MemoryRouter><TaskConversionActions taskId={10} /><Location /></MemoryRouter>);
    fireEvent.click(screen.getByText('Archive to Article'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/articles/20'));
    expect(TasksService.archiveTaskToArticle).toHaveBeenCalledWith('10');
    expect(TasksService.transferTaskToMemo).not.toHaveBeenCalled();
  });
  it('transfers the same issue and navigates to its memo', async () => {
    vi.mocked(TasksService.transferTaskToMemo).mockResolvedValue({ memoId: 10 });
    const onConverted = vi.fn();
    render(<MemoryRouter><TaskConversionActions taskId={10} onConverted={onConverted} /><Location /></MemoryRouter>);
    fireEvent.click(screen.getByText('Transfer to Memo'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/memos/10'));
    expect(onConverted).toHaveBeenCalledOnce();
  });
  it('shows failures and allows retrying without navigation', async () => {
    vi.mocked(TasksService.transferTaskToMemo).mockRejectedValue(new Error('Failed'));
    render(<MemoryRouter><TaskConversionActions taskId={10} /><Location /></MemoryRouter>);
    fireEvent.click(screen.getByText('Transfer to Memo'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed');
    expect(screen.getByText('Transfer to Memo')).toBeEnabled();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });
});
