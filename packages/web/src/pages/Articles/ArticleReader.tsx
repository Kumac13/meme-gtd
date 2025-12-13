import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArticlesService } from "../../api/services/ArticlesService";
import ItemDetail, { type Item } from "../../components/ItemDetail";
import { ItemDetailPanel } from "../../components/ItemDetailPanel";
import LoadingState from "../../components/LoadingState";
import ErrorState from "../../components/ErrorState";
import type { Article } from "meme-gtd-shared";

export const ArticleReader: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  // Support clicking on linked items within the reader
  const [selectedItem, setSelectedItem] = useState<{ id: number; type: "memo" | "task" | "article" } | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchArticle = async () => {
      try {
        setLoading(true);
        const data = await ArticlesService.getApiArticles1(Number(id));
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
      await ArticlesService.deleteApiArticles(Number(id));
      navigate("/articles");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError("Failed to delete article: " + message);
      setDeleting(false);
    }
  };

  const handleBookmarkToggle = async () => {
    // Bookmark logic
    try {
        setBookmarking(true);
        alert("Bookmark feature for articles is pending backend implementation.");
    } finally {
        setBookmarking(false);
    }
  };

  const handleUpdate = (updatedItem: Item) => {
    setArticle(updatedItem as Article);
  };

  const handleItemClick = (itemId: number, itemType: "memo" | "task" | "article") => {
    setSelectedItem({ id: itemId, type: itemType });
  };

  const handlePanelClose = () => {
    setSelectedItem(null);
  };

  if (loading) return <LoadingState message="Loading article..." />;
  if (error || !article) return <ErrorState error={error || "Article not found"} title="Error" />;

  return (
    <>
      <ItemDetail
        item={article}
        itemType="article"
        onDelete={handleDelete}
        onBookmarkToggle={handleBookmarkToggle}
        onUpdate={handleUpdate}
        deleting={deleting}
        bookmarking={bookmarking}
        onItemClick={handleItemClick}
      />
      <ItemDetailPanel
        itemId={selectedItem?.id ?? null}
        itemType={selectedItem?.type ?? null}
        onClose={handlePanelClose}
      />
    </>
  );
};