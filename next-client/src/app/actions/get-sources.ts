'use server';

import db from "@/lib/mongodb";
import { Source } from "@/lib/types/souces";

interface Props {
    categoryId: string;
}

export const getSources = async ({ categoryId }: Props) => {
    try {
        const sources = db.collection("sources");
        const result: Source[] = (await sources.find({ categoryId }).toArray()).map((doc) => ({
            _id: doc._id.toString(),
            title: doc.title,
            url: doc.url,
            categoryId: doc.categoryId,
            cronSchedule: doc.cronSchedule,
            isActive: doc.isActive,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            lastRunAt: doc.lastRunAt,
            nextRunAt: doc.nextRunAt,
            lastError: doc.lastError,
            status: doc.status,
            jobExecutionIds: doc.jobExecutionIds
        }));
        return { success: true, data: result };
    } catch (e: any) {
        console.error(e);
        return { success: false, error: e.message || "Error getting sources", data: [] };
    }
}