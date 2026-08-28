"use server";

import { getDb } from '@/lib/mongodb';
import { KeywordDetails } from "@/lib/types/keyword";

export async function getKeywords({ categoryId }: { categoryId: string }) {
    try {
        // Coerce: server-action arguments are client-controlled at runtime.
        const id = String(categoryId ?? '');

        const pipeline = [
            {
                $match: {
                    categoryId: id,
                    isArticleValid: true,
                    status: 'completed',
                }
            },
            { $unwind: "$keywords" },
            {
                $match: {
                    // Only mentions that resolved to a real place can be mapped.
                    "keywords.location": { $ne: "unknown" },
                    "keywords.latitude": { $type: "number" },
                    "keywords.longitude": { $type: "number" },
                }
            },
            {
                $project: {
                    location: "$keywords.location",
                    keyword: "$keywords.keyword",
                    caseCount: "$keywords.caseCount",
                    latitude: "$keywords.latitude",
                    longitude: "$keywords.longitude",
                    articleId: "$_id",
                    sourceId: "$sourceId",
                    date: { $ifNull: ["$publishDate", "$createdAt"] }
                }
            },
            // One outbreak, one point. News reports running totals, and the same
            // story is syndicated across outlets — summing every article's
            // figure multiplied a 5,000-case outbreak into tens of thousands.
            // Group per week so distinct waves stay distinct, and take the
            // largest figure reported for that place rather than the sum.
            {
                $group: {
                    _id: {
                        keyword: "$keyword",
                        location: "$location",
                        week: { $dateTrunc: { date: "$date", unit: "week" } }
                    },
                    caseCount: { $max: "$caseCount" },
                    latitude: { $first: "$latitude" },
                    longitude: { $first: "$longitude" },
                    articleIds: { $addToSet: "$articleId" },
                    sourceIds: { $addToSet: "$sourceId" },
                    date: { $max: "$date" }
                }
            },
            { $sort: { date: -1 } }
        ];

        const articles = (await getDb()).collection('articles');
        const rows = await articles.aggregate(pipeline).toArray();

        const result: KeywordDetails[] = rows.map((doc, i) => ({
            _id: i + 1,
            keyword: doc._id.keyword,
            caseCount: doc.caseCount,
            location: doc._id.location,
            latitude: doc.latitude,
            longitude: doc.longitude,
            articleId: (doc.articleIds ?? []).map((x: unknown) => String(x)),
            sourceId: (doc.sourceIds ?? []).filter(Boolean).map((x: unknown) => String(x)),
            date: doc.date,
        }));

        return { success: true, data: result };
    } catch (e) {
        console.error(e);
        return { success: false, error: 'Error fetching keywords', data: [] };
    }
}
