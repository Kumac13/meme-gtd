import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArticlesService } from "../../api/services/ArticlesService";
// Use generated type or shared type
import type { Article } from "meme-gtd-shared";

export const ArticleList: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const data = await ArticlesService.getApiArticles();
        // Cast to shared Article type (assuming compatibility)
        setArticles(data as unknown as Article[]);
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
              {article.meta && (article.meta as any).siteName && (
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {(article.meta as any).siteName}
                </span>
              )}
              {article.meta && (article.meta as any).archivedAt && (
                <time dateTime={(article.meta as any).archivedAt}>
                  {new Date((article.meta as any).archivedAt).toLocaleDateString()}
                </time>
              )}
              {article.meta && (article.meta as any).originalUrl && (
                <span className="truncate max-w-xs">{(article.meta as any).originalUrl}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
