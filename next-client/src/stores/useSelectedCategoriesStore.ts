
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Category from '@/lib/types/category';

// stores/useSelectedCategoryStore.ts
interface SelectedCategoryState {
    selectedCategory: Category | null;
    setSelectedCategory: (category: Category | null) => void;
    resetSelectedCategory: () => void;
}

export const useSelectedCategoryStore = create<SelectedCategoryState>()(
    persist(
        (set) => ({
            selectedCategory: null,
            setSelectedCategory: (category) => set({ selectedCategory: category }),
            resetSelectedCategory: () => set({ selectedCategory: null })
        }),
        {
            name: 'newsbug-selected-category'
        }
    )
);