import { create } from "zustand";
import { persist } from "zustand/middleware";
import Article from "@/lib/types/article";

interface ArticlesState {
    articles: Article[];
    addArticle: (article: Article) => void;
    removeArticle: (_id: string) => void;
    updateArticle: (_id: string, updates: Partial<Article>) => void;
    setArticles: (articles: Article[]) => void;
    resetArticles: () => void;
}

export const useArticlesStore = create<ArticlesState>()(
    persist(
        (set) => ({
            articles: [],
            addArticle: (article) =>
                set((state) => ({
                    articles: [...state.articles, article]
                })),
            removeArticle: (_id) =>
                set((state) => ({
                    articles: state.articles.filter((art) => art._id !== _id)
                })),
            updateArticle: (_id, updates) =>
                set((state) => ({
                    articles: state.articles.map((art) =>
                        art._id === _id ? { ...art, ...updates } : art
                    )
                }),
                ),
            setArticles: (articles) => set({ articles }),
            resetArticles: () => set({ articles: [] })
        }),
        {
            name: 'newsbug-articles'
        }
    )
);