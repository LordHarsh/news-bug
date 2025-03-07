'use server';

import db from '@/lib/mongodb';
import Article from '@/lib/types/article';

interface Props {
    categoryId: string;
}

export async function getArticles({ categoryId }: Props) {
    try {
        const articlesCollection = db.collection('articles');
        const result: Article[] = (await articlesCollection.find({ categoryId, status: "completed" }).toArray()).map((doc) => ({
            _id: doc._id.toString(),
            title: doc.title,
            sourceId: doc.sourceId,
            categoryId: doc.categoryId,
            url: doc.url,
            publishedDate: doc.publishedDate,
            content: doc.content,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            isArticleValid: doc.isArticleValid,
            keywords: doc.keywords
        }))
        return { success: true, data: result };
    } catch (e: any) {
        console.error(e);
        return { success: false, error: e.message || 'Error fetching articles', data: [] };
    }
}