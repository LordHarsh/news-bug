import { Document } from 'mongodb';

export interface Source {
    _id: string;
    title: string;
    url: string;
    categoryId: string;
    cronSchedule: string;
    isActive: boolean;
    // Legacy documents written by the old pipeline have no timestamps at all.
    createdAt: string | null;
    updatedAt: string | null;
    lastRunAt: string | null;
    nextRunAt: string | null;
    lastError: string | null;
    status: 'idle' | 'running' | 'error';
    jobExecutionIds: string[];
}

function toIso(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return null;
}

/**
 * Serialize a source document for the client. Every date is guarded: mapping a
 * legacy document with `doc.updatedAt.toISOString()` throws, which used to make
 * a successful insert report failure and invite duplicate retries.
 */
export function serializeSource(doc: Document): Source {
    return {
        _id: doc._id.toString(),
        title: doc.title,
        url: doc.url,
        categoryId: doc.categoryId,
        cronSchedule: doc.cronSchedule,
        isActive: doc.isActive,
        createdAt: toIso(doc.createdAt),
        updatedAt: toIso(doc.updatedAt),
        lastRunAt: toIso(doc.lastRunAt),
        nextRunAt: toIso(doc.nextRunAt),
        lastError: doc.lastError ?? null,
        status: doc.status,
        jobExecutionIds: doc.jobExecutionIds ?? [],
    };
}
