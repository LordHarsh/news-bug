'use client';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCategoryFormStore } from '@/stores/useCreateCategoryForm';
import { createCategory } from '@/app/actions/create-category';
import { useState } from 'react';
import { KeywordsTagInput } from './keyword-tag-input';
import { Input } from '../ui/input';
import { useToast } from "@/hooks/use-toast"


export function CreateCategoryDialog({ children }: Readonly<{ children: React.ReactNode; }>) {
    const { toast } = useToast();
    const { title, keywords, description, setTitle, setKeywords, setDescription, reset } = useCategoryFormStore();
    const [isOpen, setIsOpen] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Title is required"
            });
            return;
        }

        if (keywords.length === 0) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "At least one keyword is required"
            });
            return;
        }

        try {
            const result = await createCategory({ title, keywords, description });

            if (result.success) {
                toast({
                    title: "Success",
                    description: "Category created successfully!"
                });
                reset();
                setIsOpen(false);
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: result.error ? `Failed to create category.\n${result.error}` : "Failed to create category. Please try again."
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "An unexpected error occurred"
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Category</DialogTitle>
                    <DialogDescription>
                        Add a new category to organize your content.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-left">
                                Title
                            </Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="keywords" className="text-left">
                                Keywords
                            </Label>
                            <div className="col-span-3">
                                <KeywordsTagInput
                                    initialKeywords={keywords}
                                    onChange={setKeywords}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-left">
                                Description
                            </Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <div className="flex flex-row justify-between w-full">
                            <Button type="reset" onClick={reset} variant="outline">Clear</Button>
                            <Button type="submit">Create</Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}