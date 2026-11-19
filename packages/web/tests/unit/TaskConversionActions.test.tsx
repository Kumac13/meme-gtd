import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TaskConversionActions from '../../src/components/TaskConversionActions';
import { TasksService } from '../../src/api/services/TasksService';
vi.mock('../../src/api/services/TasksService', () => ({ TasksService: {
  archiveTaskToArticle: vi.fn(), transferTaskToMemo: vi.fn(),
} }));
function Location() { return <div data-testid="location">{useLocation().pathname}</div>; }
function setup(onConverted = vi.fn()) {
  render(<MemoryRouter><TaskConversionActions taskId={10} onConverted={onConverted} /><Location /></MemoryRouter>);
  return onConverted;
}
describe('Task conversions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('waits for confirmation before archiving and then navigates to the copy', async () => {
    vi.mocked(TasksService.archiveTaskToArticle).mockResolvedValue({ articleId: 20 });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Archive to Article' }));
    const dialog = screen.getByRole('dialog', { name: 'Archive to Article?' });
    expect(dialog).toHaveTextContent('The original task will remain unchanged.');
    expect(TasksService.archiveTaskToArticle).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Cancel')).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archive to Article' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/articles/20'));
    expect(TasksService.archiveTaskToArticle).toHaveBeenCalledTimes(1);
    expect(TasksService.archiveTaskToArticle).toHaveBeenCalledWith('10');
    expect(TasksService.transferTaskToMemo).not.toHaveBeenCalled();
  });
  it('waits for confirmation before transferring the same issue', async () => {
    vi.mocked(TasksService.transferTaskToMemo).mockResolvedValue({ memoId: 10 });
    const onConverted = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Transfer to Memo' }));
    const dialog = screen.getByRole('dialog', { name: 'Transfer to Memo?' });
    expect(dialog).toHaveTextContent('Task status and scheduling will be removed.');
    expect(TasksService.transferTaskToMemo).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Transfer to Memo' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/memos/10'));
    expect(onConverted).toHaveBeenCalledOnce();
  });
  for (const action of ['Archive to Article', 'Transfer to Memo']) {
    it(`cancels ${action} without making a request`, () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: action }));
      fireEvent.click(within(screen.getByRole('dialog')).getByText('Cancel'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(TasksService.archiveTaskToArticle).not.toHaveBeenCalled();
      expect(TasksService.transferTaskToMemo).not.toHaveBeenCalled();
      expect(screen.getByTestId('location')).toHaveTextContent('/');
    });
  }
  it('shows failures in the dialog and allows retrying', async () => {
    vi.mocked(TasksService.transferTaskToMemo).mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce({ memoId: 10 });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Transfer to Memo' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Transfer to Memo' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Failed');
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Transfer to Memo' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/memos/10'));
  });
});
