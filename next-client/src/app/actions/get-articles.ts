'use server';

import { getDb } from '@/lib/mongodb';
import Article from '@/lib/types/article';

interface Props {
    categoryId: string;
}

export async function getArticles({ categoryId }: Props) {
    try {
        // Coerce: a client can send an object here and turn the scoped lookup
        // into "return everything".
        const id = String(categoryId ?? '');
        const articlesCollection = (await getDb()).collection('articles');
        const result: Article[] = (await articlesCollection.find({ categoryId: id, status: "completed" }).toArray()).map((doc) => ({
            _id: doc._id.toString(),
            title: doc.title,
            sourceId: doc.sourceId,
            categoryId: doc.categoryId,
            url: doc.url,
            publishedDate: doc.publishDate ?? null,
            content: doc.content,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            isArticleValid: doc.isArticleValid,
            keywords: doc.keywords
        }))
        return { success: true, data: result };
    } catch (e) {
        console.error(e);
        return { success: false, error: 'Error fetching articles', data: [] };
    }
}
