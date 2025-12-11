import { Article, CreateArticleInput } from "./types";

export interface ArticleRepository {
  create(input: CreateArticleInput): Promise<Article>;
  // findById, findAll, etc. (defined later when needed or generalized)
}

export class ArticleService {
  constructor(private repository: ArticleRepository) {}

  async create(input: CreateArticleInput): Promise<Article> {
    // Validate input if needed (e.g. check if URL is valid)
    if (!input.title) {
        throw new Error("Title is required");
    }
    return this.repository.create(input);
  }
}
