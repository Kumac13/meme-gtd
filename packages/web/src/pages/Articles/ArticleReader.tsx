import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArticlesService } from "../../api/services/ArticlesService";
import ItemDetail, { type Item } from "../../components/ItemDetail";
import { ItemDetailPanel } from "../../components/ItemDetailPanel";
import LoadingState from "../../components/LoadingState";
import ErrorState from "../../components/ErrorState";
import type { Article } from "meme-gtd-shared";
import { stripArticleBlockIds } from "../../utils/markdown";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";

export const ArticleReader: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const { copy } = useCopyToClipboard();
  // Support clicking on linked items within the reader
  const [selectedItem, setSelectedItem] = useState<{ id: number; type: "memo" | "task" | "article" } | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchArticle = async () => {
      try {
        setLoading(true);
        const data = await ArticlesService.getArticle(String(id));
        setArticle(data as unknown as Article);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to load article");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await ArticlesService.deleteArticle(String(id));
      navigate("/articles");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError("Failed to delete article: " + message);
      setDeleting(false);
    }
  };

  const handleBookmarkToggle = async () => {
    if (!id || !article) return;
    try {
      setBookmarking(true);
      if (article.isBookmarked) {
        await ArticlesService.unbookmarkArticle(String(id));
      } else {
        await ArticlesService.bookmarkArticle(String(id));
      }
      setArticle({ ...article, isBookmarked: !article.isBookmarked });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError("Failed to update bookmark: " + message);
    } finally {
      setBookmarking(false);
    }
  };

  const handleUpdate = (updatedItem: Item) => {
    // Before setting, cleanse bodyMd from block IDs
    const cleansedItem = {
      ...updatedItem,
      bodyMd: stripArticleBlockIds(updatedItem.bodyMd)
    };
    setArticle(cleansedItem as Article);
  };

  const handleItemClick = (itemId: number, itemType: "memo" | "task" | "article") => {
    setSelectedItem({ id: itemId, type: itemType });
  };

  const handlePanelClose = () => {
    setSelectedItem(null);
  };

  if (loading) return <LoadingState message="Loading article..." />;
  if (error || !article) return <ErrorState error={error || "Article not found"} title="Error" />;

  // Clone article and cleanse bodyMd before passing to ItemDetail
  const cleansedArticle: Article = {
    ...article,
    bodyMd: stripArticleBlockIds(article.bodyMd)
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Handle copy all contents
  const handleCopyAll = () => {
    const content = `${article.title}\n\n${article.meta?.originalUrl || ''}\n\n${article.bodyMd}`;
    void copy(content);
  };

  // Build article actions for sidebar (same style as Task's Copy All Contents / Archive to Memo)
  const articleSidebarActions = (
    <>
      {/* Source URL */}
      {article.meta?.originalUrl && (
        <a
          href={article.meta.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-2 py-2 text-gray-700 hover:text-github-green-600 hover:bg-gray-50 rounded-md transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span className="text-sm truncate">{article.meta.originalUrl}</span>
        </a>
      )}

      {/* Saved date */}
      <div className="flex items-center gap-3 px-2 py-2 text-gray-500">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm">Saved {formatDate(article.createdAt)}</span>
      </div>

      {/* Copy All Contents */}
      <button
        onClick={handleCopyAll}
        className="flex items-center gap-3 px-2 py-2 w-full text-left text-gray-700 hover:text-github-green-600 hover:bg-gray-50 rounded-md transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span className="text-sm">Copy All Contents</span>
      </button>
    </>
  );

  return (
    <>
      <ItemDetail
        item={cleansedArticle}
        itemType="article"
        onDelete={handleDelete}
        onBookmarkToggle={handleBookmarkToggle}
        onUpdate={handleUpdate}
        deleting={deleting}
        bookmarking={bookmarking}
        onItemClick={handleItemClick}
        sidebarActions={articleSidebarActions}
      />
      <ItemDetailPanel
        itemId={selectedItem?.id ?? null}
        itemType={selectedItem?.type ?? null}
        onClose={handlePanelClose}
      />
    </>
  );
};
