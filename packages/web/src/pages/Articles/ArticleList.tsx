import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArticlesService } from "../../api/services/ArticlesService";
import SearchInput from "../../components/SearchInput";
import ItemList from "../../components/ItemList";
import LoadingState from "../../components/LoadingState";
import ErrorState from "../../components/ErrorState";
import EmptyState from "../../components/EmptyState";
import type { Article } from "meme-gtd-shared";

export const ArticleList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const searchQuery = searchParams.get('q') || '';

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        const data = await ArticlesService.listArticles(undefined, undefined, searchQuery || undefined);
        setArticles(data as unknown as Article[]);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    setSearchParams(params);
  };

  const handleDelete = async (id: number) => {
    await ArticlesService.deleteArticle(String(id));
    setArticles(articles.filter((article) => article.id !== id));
  };

  if (loading) {
    return <LoadingState message="Loading articles..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading articles" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-4">
        <SearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search articles"
          itemType="article"
        />
      </div>

      {articles.length === 0 ? (
        <EmptyState
          message="No articles saved"
          submessage="Use the browser extension to save web pages"
        />
      ) : (
        <ItemList
          items={articles}
          itemType="article"
          basePath="/articles"
          currentFilters={searchParams}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};
