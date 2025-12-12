import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Article } from "meme-gtd-shared";

export const ArticleList: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const res = await fetch("/api/articles");
        if (!res.ok) throw new Error("Failed to fetch articles");
        const data = await res.json();
        setArticles(data);
      } catch (err: any) {
        setError(err.message);
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
        {articles.map((article) => (
          <Link
            key={article.id}
            to={`/articles/${article.id}`}
            className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
          >
            <h2 className="text-xl font-semibold mb-2 line-clamp-2">{article.title}</h2>
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 gap-4">
              {article.meta.siteName && (
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {article.meta.siteName}
                </span>
              )}
              <time dateTime={article.meta.archivedAt}>
                {new Date(article.meta.archivedAt).toLocaleDateString()}
              </time>
              <span className="truncate max-w-xs">{article.meta.originalUrl}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};