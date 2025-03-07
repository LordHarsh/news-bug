import { create } from "zustand";
import { persist } from "zustand/middleware";
import { KeywordDetails } from "@/lib/types/keyword";

interface KeywordsState {
    keywords: KeywordDetails[];
    addKeyword: (keyword: KeywordDetails) => void;
    setKeywords: (keywords: KeywordDetails[]) => void;
    resetKeywords: () => void;
}

export const useKeywordsStore = create<KeywordsState>()(
    persist(
        (set) => ({
            keywords: [],
            addKeyword: (keyword) =>
                set((state) => ({
                    keywords: [...state.keywords, keyword]
                })),
            setKeywords: (keywords) => set({ keywords }),
            resetKeywords: () => set({ keywords: [] })
        }),
        {
            name: 'newsbug-keywords'
        }
    )
);