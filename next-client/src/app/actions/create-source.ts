// app/actions/create-source.ts
'use server';

import clientPromise from "@/lib/mongodb";
import { z } from "zod";

const sourceSchema = z.object({
    title: z.string().min(1, "Title is required"),
    url: z.string().url("Invalid URL format"),
    categoryId: z.string().min(1, "Category ID is required"),
});

type FormState = {
    message: string;
    success: boolean;
    errors: {
        title?: string[];
        url?: string[];
        categoryId?: string[];
    };
};

export async function createSource(prevState: FormState, formData: FormData): Promise<FormState> {
    const validatedFields = sourceSchema.safeParse({
        title: formData.get('title'),
        url: formData.get('url'),
        categoryId: formData.get('categoryId'),
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
        
        const result = await sources.insertOne(validatedFields.data);
        
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