'use server';

import db from "@/lib/mongodb";
import { z } from "zod";
import { validateCronExpression } from '@/lib/cron-validator';
import { Source } from "@/lib/types/souces";

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
    data: Source[];
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
            data: [],
            errors: validatedFields.error.flatten().fieldErrors
        };
    }

    try {
        const sourcesCollection = db.collection("sources");

        // Create the initial source document
        const now = new Date();
        const sourceDocument = {
            ...validatedFields.data,
            status: 'idle' as const,
            jobExecutionIds: [] as Array<string>,
            createdAt: now,
            updatedAt: now,
            lastRunAt: null,
            nextRunAt: now,
            lastError: null,
        };

        const result = await sourcesCollection.insertOne(sourceDocument);

        if (!result.acknowledged) {
            return {
                message: "Failed to insert source",
                success: false,
                data: [],
                errors: {}
            };
        }
        const sources: Source[] = (await sourcesCollection.find({ categoryId: validatedFields.data.categoryId }).toArray()).map((source) => ({
            ...source,
            _id: source._id.toString(),
            title: source.title,
            url: source.url,
            categoryId: source.categoryId,
            cronSchedule: source.cronSchedule,
            isActive: source.isActive,
            createdAt: source.createdAt.toISOString(),
            updatedAt: source.updatedAt.toISOString(),
            lastRunAt: source.lastRunAt ? source.lastRunAt.toISOString() : null,
            nextRunAt: source.nextRunAt ? source.nextRunAt.toISOString() : null,
            lastError: source.lastError,
            status: source.status,
            jobExecutionIds: source.jobExecutionIds,
        }));

        return {
            message: "Source created successfully!",
            success: true,
            data: sources,
            errors: {}
        };
    } catch (e: any) {
        console.error(e);
        return {
            message: e.message || "Error creating source",
            success: false,
            data: [],
            errors: {}
        };
    }
}