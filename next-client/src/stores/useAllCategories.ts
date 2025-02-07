// stores/useCategoriesStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Category from '@/lib/types/category';

interface CategoriesState {
  categories: Category[];
  addCategory: (category: Category) => void;
  removeCategory: (id: string) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  setCategories: (categories: Category[]) => void;
}

export const useCategoriesStore = create<CategoriesState>()(
  persist(
    (set) => ({
      categories: [],
      addCategory: (category) =>
        set((state) => ({
          categories: [...state.categories, category]
        })),
      removeCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((cat) => cat.id !== id)
        })),
      updateCategory: (id, updates) =>
        set((state) => ({
          categories: state.categories.map((cat) =>
            cat.id === id ? { ...cat, ...updates } : cat
          )
        })),
      setCategories: (categories) => set({ categories })
    }),
    {
      name: 'newsbug-categories'
    }
  )
);
