'use server';

import clientPromise from '@/lib/mongodb';
import Category from '@/lib/types/category';

export async function getCategories() {
  try {
    const client = await clientPromise;
    const db = client.db('newsdb');
    const categories = db.collection('categories');
    const result = (await categories.find({}).toArray()).map(doc => ({
      id: doc._id.toString(),
      title: doc.title,
      description: doc.description,
      keywords: doc.keywords
    })) as Category[];
    return { success: true, data: result };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message || 'Error fetching categories', data: [] };
  }
}