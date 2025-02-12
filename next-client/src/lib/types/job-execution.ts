export interface JobExecution {
    _id: string;
    sourceId: string;
    categoryId: string;
    sourceUrl: string;
    categoryKeywords: string[];
    startedAt: string;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    duration: number | null;
    status: 'idle' | 'running' | 'error';
    error: string | null;
    metadata: Record<string, any>;
}