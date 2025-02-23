import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Source } from "@/lib/types/souces";

interface SourcesState {
    sources: Source[];
    addSource: (source: Source) => void;
    removeSource: (_id: string) => void;
    updateSource: (_id: string, updates: Partial<Source>) => void;
    setSources: (sources: Source[]) => void;
    resetSources: () => void;
}

export const useSourcesStore = create<SourcesState>()(
    persist(
        (set) => ({
            sources: [],
            addSource: (source) =>
                set((state) => ({
                    sources: [...state.sources, source]
                })),
            removeSource: (_id) =>
                set((state) => ({
                    sources: state.sources.filter((src) => src._id !== _id)
                })),
            updateSource: (_id, updates) =>
                set((state) => ({
                    sources: state.sources.map((src) =>
                        src._id === _id ? { ...src, ...updates } : src
                    )
                }),
                ),
            setSources: (sources) => set({ sources }),
            resetSources: () => set({ sources: [] })
        }),
        {
            name: 'newsbug-sources'
        }
    )
);