import { apiClient } from "../client";
import type { Article } from "meme-gtd-shared";

export const ArticlesService = {
  async getArticle(id: string): Promise<Article> {
    const response = await apiClient.get(`/articles/${id}`);
    return response.data;
  },

  async deleteArticle(id: string): Promise<void> {
    await apiClient.delete(`/articles/${id}`);
  },
};
