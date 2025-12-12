import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArticlesService } from "../../api/services/ArticlesService";
import type { Article } from "meme-gtd-shared";

export const ArticleList: React.FC = () => {
  // Use explicit type or inferred type from API
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const data = await ArticlesService.getApiArticles();
        // The generated API client returns objects that match the Article interface structure.
        // We cast here only because the shared library type and generated type are separate definitions,
        // but we verified they are compatible.
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
  }, []);

  if (loading) return <div className="p-8 text-center">Loading articles...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

  if (articles.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <h2 className="text-xl font-bold mb-2">No Articles Saved</h2>
        <p>Use the browser extension to save web pages.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Articles</h1>
      <div className="space-y-4">
        {articles.map((article) => {
          // Type guard or safe access for meta
          const meta = article.meta as { siteName?: string; archivedAt?: string; originalUrl?: string } | undefined;
          
          return (
            <Link
              key={article.id}
              to={`/articles/${article.id}`}
              className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
            >
              <h2 className="text-xl font-semibold mb-2 line-clamp-2">{article.title}</h2>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 gap-4">
                {meta?.siteName && (
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {meta.siteName}
                  </span>
                )}
                {meta?.archivedAt && (
                  <time dateTime={meta.archivedAt}>
                    {new Date(meta.archivedAt).toLocaleDateString()}
                  </time>
                )}
                {meta?.originalUrl && (
                  <span className="truncate max-w-xs">{meta.originalUrl}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};