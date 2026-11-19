import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmationModal from '../../src/components/ConfirmationModal';

describe('shared confirmation modal', () => {
  it('focuses Cancel and restores focus to the trigger when closed', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const { rerender } = render(<ConfirmationModal isOpen title="Continue?" onConfirm={vi.fn()} onClose={vi.fn()}>Details</ConfirmationModal>);
    expect(screen.getByText('Cancel')).toHaveFocus();
    rerender(<ConfirmationModal isOpen={false} title="Continue?" onConfirm={vi.fn()} onClose={vi.fn()}>Details</ConfirmationModal>);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
  it('treats Escape and backdrop clicks as cancellation, never confirmation', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmationModal isOpen title="Continue?" onConfirm={onConfirm} onClose={onClose}>Details</ConfirmationModal>);
    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Details'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('prevents duplicate execution and cancellation while pending', async () => {
    let finish!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const onClose = vi.fn();
    render(<ConfirmationModal isOpen title="Continue?" onConfirm={onConfirm} onClose={onClose}>Details</ConfirmationModal>);
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByRole('dialog'));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Processing...')).toBeDisabled();
    finish();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
