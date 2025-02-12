'use server';
import db from '@/lib/mongodb';


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
    const categories = db.collection('categories');
    // Validate the input
    if (!title) {
      throw new Error('Title is required');
    }
    if (!keywords || keywords.length === 0) {
      throw new Error('Keywords are required');
    }
    const category = {
      title,
      keywords,
      description,
    };
    const result = await categories.insertOne(category);
    if (!result.acknowledged) {
      throw new Error('Failed to insert category');
    }
    return {
      success: true,
      insertedId: result.insertedId.toString()
    };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message || 'Error creating category' };
  }
}