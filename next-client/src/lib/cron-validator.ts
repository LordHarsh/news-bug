// lib/cron-validator.ts
export function validateCronExpression(expression: string): boolean {
    // Cron expression regex pattern
    const cronPattern = /^(\*|([0-5]?\d)(-([0-5]?\d))?|(\*\/[0-5]?\d)) (\*|([01]?\d|2[0-3])(-([01]?\d|2[0-3]))?|(\*\/([01]?\d|2[0-3]))) (\*|([1-9]|[12]\d|3[01])(-([1-9]|[12]\d|3[01]))?|(\*\/([1-9]|[12]\d|3[01]))) (\*|([1-9]|1[0-2])(-([1-9]|1[0-2]))?|(\*\/([1-9]|1[0-2]))) (\*|[0-6](-[0-6])?|(\*\/[0-6]))$/;

    // Basic syntax check
    if (!cronPattern.test(expression)) {
        return false;
    }

    // Split the expression into components
    const parts = expression.split(' ');
    
    // Validate each part's range
    const ranges = [
        { min: 0, max: 59 },   // Minutes
        { min: 0, max: 23 },   // Hours
        { min: 1, max: 31 },   // Day of month
        { min: 1, max: 12 },   // Month
        { min: 0, max: 6 }     // Day of week
    ];

    return parts.every((part, index) => {
        if (part === '*') return true;
        
        // Check for step values
        if (part.includes('/')) {
            const [, step] = part.split('/');
            return !isNaN(Number(step)) && 
                   Number(step) > 0 && 
                   Number(step) <= ranges[index].max;
        }
        
        // Check for range values
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            return start >= ranges[index].min && 
                   end <= ranges[index].max && 
                   start <= end;
        }
        
        // Check single values
        const num = Number(part);
        return !isNaN(num) && 
               num >= ranges[index].min && 
               num <= ranges[index].max;
    });
}