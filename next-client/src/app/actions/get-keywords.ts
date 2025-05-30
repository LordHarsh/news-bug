"use server";

import db from '@/lib/mongodb';
import { KeywordDetails } from "@/lib/types/keyword";
import { ObjectId, UUID } from 'mongodb';
import { BSON } from 'mongodb';

export async function getKeywords({ categoryId }: { categoryId: string }) {
    try {
        const pipeline = [
            // Match articles with the specific categoryId
            {
                $match: {
                    categoryId: categoryId,
                    isArticleValid: true,
                    // location is not unknown
                    location: { $ne: "unknown" }
                }
            },
            // Unwind the keywords array
            {
                $unwind: "$keywords"
            },
            // Filter out keywords with unknown location
            {
                $match: {
                    "keywords.location": { $ne: "unknown" }
                }
            },
            // Reshape the document to include articleId and date
            {
                $project: {
                    _id: 0,
                    location: "$keywords.location",
                    keyword: "$keywords.keyword",
                    caseCount: "$keywords.caseCount",
                    latitude: "$keywords.latitude",
                    longitude: "$keywords.longitude",
                    articleId: "$_id",
                    sourceId: "$sourceId",
                    date: { $ifNull: ["$publishDate", "$createdAt"] }
                }
            }
        ]
        const keywordCollection = (db.collection('articles'));

        const result: KeywordDetails[] = (await keywordCollection.aggregate(pipeline).toArray()).map((doc, i) => {
            return {
                _id: i + 1,
                keyword: doc.keyword,
                caseCount: doc.caseCount,
                location: doc.location,
                latitude: doc.latitude,
                longitude: doc.longitude,
                articleId: doc.articleId.toString(),
                sourceId: doc.sourceId ? doc.sourceId.toString() : '',
                date: doc.date
            }
        });
        console.log("data", result)
        return { success: true, data: result };
    } catch (e: any) {
        console.error(e);
        return { success: false, error: e.message || 'Error fetching keywords', data: [] };
    }
}