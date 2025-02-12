export interface Source {
    _id: string;
    title: string;
    url: string;
    categoryId: string;
    cronSchedule: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    lastRunAt: string | null;
    nextRunAt: string;
    lastError: string | null;
    status: 'idle' | 'running' | 'error';
    executionHistory: string[];
}