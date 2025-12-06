import { useState, useEffect, useRef, DragEvent, ClipboardEvent } from 'react';
import { CommentsService } from '../api/services/CommentsService';
import EditableContent from './EditableContent';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { getShortcutHint } from '../utils/keyboard';
import { useImageUpload } from '../hooks/useImageUpload';

interface Comment {
  id: number;
  issueId: number;
  bodyMd: string;
  createdAt: string;
  updatedAt: string;
}

interface CommentSectionProps {
  itemId: number;
  itemType: 'memo' | 'task';
}

export default function CommentSection({ itemId, itemType }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCommentBody, setNewCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isUploading, uploadImage } = useImageUpload();

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response =
        itemType === 'memo'
          ? await CommentsService.listMemoComments(String(itemId))
          : await CommentsService.listTaskComments(String(itemId));
      setComments(response);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [itemId, itemType]);

  const handleSubmitNewComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentBody.trim()) return;

    try {
      setSubmitting(true);
      const newComment =
        itemType === 'memo'
          ? await CommentsService.createMemoComment(String(itemId), { bodyMd: newCommentBody })
          : await CommentsService.createTaskComment(String(itemId), { bodyMd: newCommentBody });
      setComments([...comments, newComment]);
      setNewCommentBody('');
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateComment = async (commentId: number, newBody: string) => {
    const updatedComment =
      itemType === 'memo'
        ? await CommentsService.updateMemoComment(String(itemId), String(commentId), {
            bodyMd: newBody,
          })
        : await CommentsService.updateTaskComment(String(itemId), String(commentId), {
            bodyMd: newBody,
          });
    setComments(comments.map((c) => (c.id === commentId ? updatedComment : c)));
  };

  const handleDeleteComment = async (commentId: number) => {
    if (itemType === 'memo') {
      await CommentsService.deleteMemoComment(String(itemId), String(commentId));
    } else {
      await CommentsService.deleteTaskComment(String(itemId), String(commentId));
    }
    setComments(comments.filter((c) => c.id !== commentId));
  };

  const handleKeyDown = useKeyboardShortcut(() => {
    const form = document.querySelector('form');
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
              onSave={(newBody) => handleUpdateComment(comment.id, newBody)}
              onDelete={() => handleDeleteComment(comment.id)}
            />
          ))}
        </div>
      )}

      {/* New Comment Form */}
      <form onSubmit={handleSubmitNewComment} className="bg-white border border-gray-200 rounded-lg p-4">
        <textarea
          ref={textareaRef}
          value={newCommentBody}
          onChange={(e) => setNewCommentBody(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-keyshortcuts="Control+Enter"
          placeholder="Write a comment..."
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500 min-h-[100px] ${
            isDragging ? 'border-github-green-500 bg-github-green-50' : 'border-gray-300'
          } ${isUploading ? 'opacity-50' : ''}`}
          disabled={submitting || isUploading}
        />
        {isUploading && (
          <div className="mt-1 text-xs text-gray-500">Uploading image...</div>
        )}
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
