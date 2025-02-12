import React, { useState, useEffect, useActionState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createSource } from '@/app/actions/create-source';
import { useSelectedCategoryStore } from '@/stores/useSelectedCategoriesStore';
import { useSourcesStore } from '@/stores/useAllSources';
import { Source } from '@/lib/types/souces';

interface CreateSourceDialogProps {
    children: React.ReactNode;
}

interface FormState {
    message: string;
    success: boolean;
    data: Source[];
    errors: {
        title?: string[];
        url?: string[];
        cronSchedule?: string[];
    };
}

const initialState: FormState = {
    message: '',
    success: false,
    data: [],
    errors: {}
};

const frequencies = [
    { label: 'Every minute', value: '* * * * *' },
    { label: 'Every 5 minutes', value: '*/5 * * * *' },
    { label: 'Every 15 minutes', value: '*/15 * * * *' },
    { label: 'Every 30 minutes', value: '*/30 * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every 2 hours', value: '0 */2 * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Every 12 hours', value: '0 */12 * * *' },
    { label: 'Daily', value: '0 12 * * *' },
    { label: 'Weekly', value: '0 12 * * 0' },
    { label: 'Monthly', value: '0 12 1 * *' },
];

export function CreateSourceDialog({ children }: Readonly<CreateSourceDialogProps>) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const [selectedFrequency, setSelectedFrequency] = useState(frequencies[4].value); // Default to hourly
    const { selectedCategory } = useSelectedCategoryStore();
    const { setSources } = useSourcesStore();

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

    const handleSubmit = (formData: FormData) => {
        formData.set('cronSchedule', selectedFrequency);
        formAction(formData);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                    <DialogTitle>Create Source</DialogTitle>
                    <DialogDescription>
                        Add a new source
                    </DialogDescription>
                </DialogHeader>
                <form action={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <input type="hidden" name="categoryId" value={selectedCategory?.id} />

                        {/* Title Field */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-left">
                                Title
                            </Label>
                            <div className="col-span-3 space-y-2">
                                <Input
                                    id="title"
                                    name="title"
                                    maxLength={100}
                                    className={state.errors?.title ? 'border-red-500' : ''}
                                />
                                {state.errors?.title && (
                                    <p className="text-sm text-red-500">
                                        {state.errors.title[0]}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* URL Field */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="url" className="text-left">
                                URL
                            </Label>
                            <div className="col-span-3 space-y-2">
                                <Input
                                    id="url"
                                    name="url"
                                    type="url"
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

                        {/* Schedule Field */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="frequency" className="text-left">
                                Schedule
                            </Label>
                            <div className="col-span-3 space-y-2">
                                <Select
                                    value={selectedFrequency}
                                    onValueChange={setSelectedFrequency}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Schedule" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {frequencies.map((freq) => (
                                            <SelectItem key={freq.value} value={freq.value}>
                                                {freq.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {state.errors?.cronSchedule && (
                                    <p className="text-sm text-red-500">
                                        {state.errors.cronSchedule[0]}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Active Status */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="isActive" className="text-left">
                                Active
                            </Label>
                            <div className="col-span-3">
                                <input
                                    type="hidden"
                                    name="isActive"
                                    value={isActive.toString()}
                                />
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <div className="flex flex-row justify-between w-full">
                            <Button
                                type="reset"
                                variant="outline"
                                onClick={() => {
                                    const form = document.querySelector('form');
                                    form?.reset();
                                    setIsActive(true);
                                    setSelectedFrequency(frequencies[4].value);
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