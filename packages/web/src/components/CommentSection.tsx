import { useState, useEffect } from 'react';
import { CommentsService } from '../api/services/CommentsService';
import { formatDateTime, formatRelativeTime } from '../utils/dates';
import { MarkdownRenderer } from '../utils/markdown';

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
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingBody, setEditingBody] = useState('');

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

  const handleStartEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingBody(comment.bodyMd);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingBody('');
  };

  const handleSaveEdit = async (commentId: number) => {
    if (!editingBody.trim()) return;

    try {
      const updatedComment =
        itemType === 'memo'
          ? await CommentsService.updateMemoComment(String(itemId), String(commentId), {
              bodyMd: editingBody,
            })
          : await CommentsService.updateTaskComment(String(itemId), String(commentId), {
              bodyMd: editingBody,
            });
      setComments(comments.map((c) => (c.id === commentId ? updatedComment : c)));
      setEditingCommentId(null);
      setEditingBody('');
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      if (itemType === 'memo') {
        await CommentsService.deleteMemoComment(String(itemId), String(commentId));
      } else {
        await CommentsService.deleteTaskComment(String(itemId), String(commentId));
      }
      setComments(comments.filter((c) => c.id !== commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Comments ({comments.length})
      </h2>

      {/* New Comment Form */}
      <form onSubmit={handleSubmitNewComment} className="mb-6">
        <textarea
          value={newCommentBody}
          onChange={(e) => setNewCommentBody(e.target.value)}
          placeholder="Write a comment..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
          disabled={submitting}
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !newCommentBody.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Commenting...' : 'Comment'}
          </button>
        </div>
      </form>

      {/* Comments List */}
      {loading ? (
        <p className="text-gray-500">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-gray-500">No comments yet</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500">
                  <span title={formatDateTime(comment.createdAt)}>
                    {formatRelativeTime(comment.createdAt)}
                  </span>
                  {comment.updatedAt !== comment.createdAt && (
                    <span className="ml-2">(edited)</span>
                  )}
                </div>
                {editingCommentId !== comment.id && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleStartEdit(comment)}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {editingCommentId === comment.id ? (
                <div>
                  <textarea
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                  />
                  <div className="mt-2 flex justify-end space-x-2">
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(comment.id)}
                      disabled={!editingBody.trim()}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <MarkdownRenderer content={comment.bodyMd} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
