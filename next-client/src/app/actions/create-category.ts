'use server';
import db from '@/lib/mongodb';
import Category from '@/lib/types/category';


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
    const categoriesCollection = db.collection('categories');
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
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message || 'Error creating category' };
  }
}