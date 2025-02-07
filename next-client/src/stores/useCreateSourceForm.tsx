// stores/useCreateSourceForm.ts
import { create } from 'zustand';

interface SourceFormState {
    title: string;
    url: string;
    setTitle: (title: string) => void;
    setUrl: (url: string) => void;
    reset: () => void;
}

export const useSourceFormStore = create<SourceFormState>((set) => ({
    title: '',
    url: '',
    setTitle: (title) => set({ title }),
    setUrl: (url) => set({ url }),
    reset: () => set({ title: '', url: '' }),
}));

