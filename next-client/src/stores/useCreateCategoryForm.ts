import { create } from 'zustand';

type CategoryFormState = {
  title: string;
  keywords: string[];
  description: string;
  setTitle: (title: string) => void;
  setKeywords: (keywords: string[]) => void;
  setDescription: (description: string) => void;
  reset: () => void;
};

export const useCategoryFormStore = create<CategoryFormState>((set) => ({
  title: '',
  keywords: [],
  description: '',
  setTitle: (title) => set({ title }),
  setKeywords: (keywords) => set({ keywords }),
  setDescription: (description) => set({ description }),
  reset: () => set({ title: '', keywords: [], description: '' }),
}));