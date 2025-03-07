import { Keyword } from "./keyword";

export default interface Article {
    _id: string;
    title: string;
    content: string;
    sourceId: string;
    categoryId: string;
    url: string;
    publishedDate: string | Date;
    updatedAt: Date;
    createdAt: Date;
    isArticleValid: boolean;
    keywords: Keyword[];
}