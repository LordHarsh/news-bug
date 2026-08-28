'use server';

import { getDb } from '@/lib/mongodb';
import { Source, serializeSource } from "@/lib/types/souces";

interface Props {
    categoryId: string;
}

export const getSources = async ({ categoryId }: Props) => {
    try {
        // Coerce: server actions deserialize whatever the client sends, so a
        // TypeScript `string` can arrive as `{ $ne: null }` and widen the query.
        const id = String(categoryId ?? '');
        const sources = (await getDb()).collection("sources");
        const result: Source[] = (await sources.find({ categoryId: id }).toArray()).map(
            serializeSource
        );
        return { success: true, data: result };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Error getting sources", data: [] };
    }
}
