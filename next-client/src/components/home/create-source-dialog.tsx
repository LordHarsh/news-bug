// components/create-source-dialog.tsx
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
import { Input } from '@/components/ui/input';
import { useState, useEffect, useActionState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useSelectedCategoryStore } from '@/stores/useSelectedCategoriesStore';
import { createSource } from '@/app/actions/create-source';

interface CreateSourceDialogProps {
    children: React.ReactNode;
}

interface FormState {
    message: string;
    success: boolean;
    errors: {
        title?: string[];
        url?: string[];
        categoryId?: string[];
    };
}

const initialState: FormState = {
    message: '',
    success: false,
    errors: {}
};

export function CreateSourceDialog({ children }: Readonly<CreateSourceDialogProps>) {
    const { toast } = useToast();
    const { selectedCategory } = useSelectedCategoryStore();
    const [isOpen, setIsOpen] = useState(false);

    const [state, formAction] = useActionState<FormState, FormData>(createSource, initialState);

    useEffect(() => {
        if (state.message) {
            if (state.success) {
                toast({
                    title: "Success",
                    description: state.message
                });
                setIsOpen(false);
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: state.message
                });
            }
        }
    }, [state, toast]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Source</DialogTitle>
                    <DialogDescription>
                        Add a new source to your selected category.
                    </DialogDescription>
                </DialogHeader>
                <form action={formAction}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-left">
                                Title
                            </Label>
                            <div className="col-span-3 space-y-2">
                                <Input
                                    id="title"
                                    name="title"
                                    className={state.errors?.title ? 'border-red-500' : ''}
                                />
                                {state.errors?.title && (
                                    <p className="text-sm text-red-500">
                                        {state.errors.title[0]}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="url" className="text-left">
                                URL
                            </Label>
                            <div className="col-span-3 space-y-2">
                                <Input
                                    id="url"
                                    name="url"
                                    placeholder="https://example.com"
                                    className={state.errors?.url ? 'border-red-500' : ''}
                                />
                                {state.errors?.url && (
                                    <p className="text-sm text-red-500">
                                        {state.errors.url[0]}
                                    </p>
                                )}
                            </div>
                        </div>
                        <input
                            type="hidden"
                            name="categoryId"
                            value={selectedCategory?.id}
                        />
                        {state.errors?.categoryId && (
                            <p className="text-sm text-red-500">
                                {state.errors.categoryId[0]}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <div className="flex flex-row justify-between w-full">
                            <Button
                                type="reset"
                                variant="outline"
                                onClick={() => {
                                    const form = document.querySelector('form');
                                    form?.reset();
                                }}
                            >
                                Clear
                            </Button>
                            <Button type="submit">Create</Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}