import React, { useState, KeyboardEvent, useRef } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function KeywordsTagInput({
    initialKeywords = [],
    onChange
}: {
    initialKeywords?: string[],
    onChange: (keywords: string[]) => void
}) {
    const [keywords, setKeywords] = useState<string[]>(initialKeywords);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const addKeyword = () => {
        const newKeyword = inputValue.trim();
        if (newKeyword && !keywords.includes(newKeyword)) {
            const updatedKeywords = [...keywords, newKeyword];
            setKeywords(updatedKeywords);
            setInputValue('');
            onChange(updatedKeywords);
        }
    };

    const removeKeyword = (keywordToRemove: string) => {
        const updatedKeywords = keywords.filter(k => k !== keywordToRemove);
        setKeywords(updatedKeywords);
        onChange(updatedKeywords);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addKeyword();
        } else if (e.key === 'Backspace' && inputValue === '' && keywords.length > 0) {
            removeKeyword(keywords[keywords.length - 1]);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2 items-center border p-2 rounded">
                {keywords.map((keyword) => (
                    <div
                        key={keyword}
                        className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"
                    >
                        {keyword}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="ml-1 h-5 w-5 p-0"
                            onClick={() => removeKeyword(keyword)}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                ))}
                <div className="flex flex-grow">
                    <Input
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Add keywords (press Enter to add)"
                        className="flex-grow border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    {inputValue.trim() && (
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={addKeyword}
                            className="ml-1"
                        >
                            Add
                        </Button>
                    )}
                </div>
            </div>
            <div className="text-xs text-gray-500">
                Enter each keyword or phrase and press Enter. Multi-word phrases are supported.
            </div>
        </div>
    );
}