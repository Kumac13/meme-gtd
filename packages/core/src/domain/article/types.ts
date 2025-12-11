export interface ArticleMeta {
  originalUrl: string;
  siteName?: string;
  archivedAt: string; // ISO 8601
}

export interface Article {
  id: number;
  type: "article";
  title: string;
  bodyMd: string;
  status?: string;
  meta: ArticleMeta;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  isBookmarked: boolean;
  isDeleted: boolean;
}

export interface CreateArticleInput {
  title: string;
  bodyMd: string;
  originalUrl: string;
  siteName?: string;
}

export interface UpdateArticleInput {
  title?: string;
  bodyMd?: string;
  isBookmarked?: boolean;
  isDeleted?: boolean;
}
