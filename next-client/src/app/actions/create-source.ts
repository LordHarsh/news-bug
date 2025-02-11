'use server';

import clientPromise from "@/lib/mongodb";
import { z } from "zod";
import { validateCronExpression } from '@/lib/cron-validator';

// Job Execution Schema
const jobExecutionSchema = z.object({
    id: z.string(),
    startedAt: z.date(),
    completedAt: z.date().optional(),
    status: z.enum(['running', 'failed', 'completed']),
    error: z.string().optional(),
    duration: z.number().optional(),
    metadata: z.record(z.any()).optional()
})

type JobExecutionSchema = z.infer<typeof jobExecutionSchema>;

// Source Schema
const sourceSchema = z.object({
    categoryId: z.string().min(1, "Category is required"),
    title: z.string().min(1, "Title is required"),
    url: z.string().url("Invalid URL format"),
    cronSchedule: z.string().refine(
        (value) => validateCronExpression(value),
        { message: "Invalid cron expression" }
    ),
    isActive: z.boolean(),
});

type FormState = {
    message: string;
    success: boolean;
    errors: {
        title?: string[];
        url?: string[];
        cronSchedule?: string[];
        categoryId?: string[];
    };
};

export async function createSource(prevState: FormState, formData: FormData): Promise<FormState> {
    // Parse and validate the form data
    const validatedFields = sourceSchema.safeParse({
        categoryId: formData.get('categoryId'),
        title: formData.get('title'),
        url: formData.get('url'),
        cronSchedule: formData.get('cronScheduleType') === 'custom'
            ? formData.get('customCronSchedule')
            : formData.get('cronSchedule'),
        isActive: formData.get('isActive') === 'true',
    });

    if (!validatedFields.success) {
        return {
            message: "Validation failed",
            success: false,
            errors: validatedFields.error.flatten().fieldErrors
        };
    }

    try {
        const client = await clientPromise;
        const db = client.db("newsdb");
        const sources = db.collection("sources");

        // Create the initial source document
        const now = new Date();
        const sourceDocument = {
            ...validatedFields.data,
            status: 'idle' as const,
            executionHistory: [] as Array<JobExecutionSchema>,
            createdAt: now,
            updatedAt: now,
            lastRunAt: null,
            nextRunAt: null,
            lastError: null,
            currentRetry: 0,
        };

        const result = await sources.insertOne(sourceDocument);

        if (!result.acknowledged) {
            return {
                message: "Failed to insert source",
                success: false,
                errors: {}
            };
        }

        return {
            message: "Source created successfully!",
            success: true,
            errors: {}
        };
    } catch (e: any) {
        console.error(e);
        return {
            message: e.message || "Error creating source",
            success: false,
            errors: {}
        };
    }
}