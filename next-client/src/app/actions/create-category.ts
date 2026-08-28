'use server';
import { getDb } from '@/lib/mongodb';
import Category from '@/lib/types/category';
import { z } from 'zod';

const categorySchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  // Keywords drive the AI prompt, so reject blanks that would tell the model
  // to hunt for nothing.
  keywords: z
    .array(z.string().trim().min(1))
    .min(1, 'At least one keyword is required'),
  description: z.string().trim().optional(),
});


export async function createCategory(
  {
    title,
    keywords,
    description,
  }: {
    title: string;
    keywords: string[];
    description?: string;
  }
) {
  try {
    // Validate at runtime: TypeScript types are erased, and a server action
    // receives whatever the client serialized.
    const parsed = categorySchema.safeParse({ title, keywords, description });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid category',
      };
    }

    const categoriesCollection = (await getDb()).collection('categories');
    const now = new Date();
    const category = {
      title: parsed.data.title,
      keywords: parsed.data.keywords,
      description: parsed.data.description ?? '',
      createdAt: now,
      updatedAt: now,
    };
    const result = await categoriesCollection.insertOne(category);
    if (!result.acknowledged) {
      throw new Error('Failed to insert category');
    }
    const categories: Category[] = (await categoriesCollection.find({}).toArray()).map(doc => ({
      id: doc._id.toString(),
      title: doc.title,
      description: doc.description,
      keywords: doc.keywords,
    }));
    return {
      success: true,
      insertedId: result.insertedId.toString(),
      data: categories,
    };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Error creating category' };
  }
}