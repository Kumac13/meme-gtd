import { useState, useRef, DragEvent, ClipboardEvent } from 'react';
import EditableContent from './EditableContent';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { getShortcutHint } from '../utils/keyboard';
import { useImageUpload } from '../hooks/useImageUpload';
import { MarkdownTextarea } from './MarkdownTextarea';

export interface Comment {
  id: number;
  issueId: number;
  bodyMd: string;
  createdAt: string;
  updatedAt: string;
}

interface CommentSectionProps {
  comments: Comment[];
  loading: boolean;
  onAddComment: (bodyMd: string) => Promise<void>;
  onUpdateComment: (commentId: number, bodyMd: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
}

export default function CommentSection({
  comments,
  loading,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}: CommentSectionProps) {
  const [newCommentBody, setNewCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isUploading, uploadImage } = useImageUpload();

  const handleSubmitNewComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentBody.trim()) return;

    try {
      setSubmitting(true);
      await onAddComment(newCommentBody);
      setNewCommentBody('');
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = useKeyboardShortcut((e) => {
    // Get the form that contains this input element
    const form = (e.target as HTMLElement).closest('form');
    if (form) {
      form.requestSubmit();
    }
  }, { disabled: submitting || !newCommentBody.trim() });

  // Image upload handlers for new comment textarea
  const insertMarkdownRef = (markdownRef: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setNewCommentBody(prev => prev + '\n' + markdownRef);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = newCommentBody.slice(0, start);
    const after = newCommentBody.slice(end);

    const newValue = before + (before.endsWith('\n') || before === '' ? '' : '\n') + markdownRef + '\n' + after;
    setNewCommentBody(newValue);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = before.length + (before.endsWith('\n') || before === '' ? 0 : 1) + markdownRef.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleImageFile = async (file: File) => {
    if (isUploading) return;
    const result = await uploadImage(file);
    if (result.success && result.markdownRef) {
      insertMarkdownRef(result.markdownRef);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleImageFile(file);
        }
        return;
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleImageFile(files[0]);
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Comments ({comments.length})
      </h2>

      {/* Comments List */}
      {loading ? (
        <p className="text-gray-500">Loading comments...</p>
      ) : (
        <div className="space-y-4 mb-6">
          {comments.map((comment) => (
            <EditableContent
              key={comment.id}
              content={comment.bodyMd}
              createdAt={comment.createdAt}
              updatedAt={comment.updatedAt}
              onSave={(newBody) => onUpdateComment(comment.id, newBody)}
              onDelete={() => onDeleteComment(comment.id)}
            />
          ))}
        </div>
      )}

      {/* New Comment Form */}
      <form onSubmit={handleSubmitNewComment} className="bg-white border border-soft rounded-lg shadow-depth p-4">
        <MarkdownTextarea
          textareaRef={textareaRef}
          value={newCommentBody}
          onChange={setNewCommentBody}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          rows={4}
          placeholder="Write a comment..."
          disabled={submitting}
          isDragging={isDragging}
          isUploading={isUploading}
          minHeightClass="min-h-[100px]"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !newCommentBody.trim()}
            className="px-4 py-2 bg-github-green-600 text-white rounded-md hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Comment (${getShortcutHint()})`}
          >
            {submitting ? 'Commenting...' : 'Comment'}
          </button>
        </div>
      </form>
    </div>
  );
}
