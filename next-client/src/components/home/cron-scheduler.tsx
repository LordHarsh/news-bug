import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from 'lucide-react';

export function UserFriendlyScheduler({ 
    onScheduleChange,
    initialCron = '0 0 * * *'
}: { 
    onScheduleChange: (cron: string) => void,
    initialCron?: string 
}) {
    const [scheduleType, setScheduleType] = useState('simple');
    const [frequency, setFrequency] = useState('daily');
    const [timeOfDay, setTimeOfDay] = useState('00:00');
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState('1');

    // Generate hours and minutes options
    const hours = Array.from({ length: 24 }, (_, i) => 
        i.toString().padStart(2, '0'));
    const minutes = Array.from({ length: 60 }, (_, i) => 
        i.toString().padStart(2, '0'));

    const weekdays = [
        { value: '1', label: 'Monday' },
        { value: '2', label: 'Tuesday' },
        { value: '3', label: 'Wednesday' },
        { value: '4', label: 'Thursday' },
        { value: '5', label: 'Friday' },
        { value: '6', label: 'Saturday' },
        { value: '0', label: 'Sunday' }
    ];

    const monthDays = Array.from({ length: 31 }, (_, i) => ({
        value: (i + 1).toString(),
        label: `${i + 1}${getOrdinalSuffix(i + 1)}`
    }));

    function getOrdinalSuffix(day: number) {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    const generateCronExpression = () => {
        const [hours, minutes] = timeOfDay.split(':');
        let cronExpression = '';

        switch (frequency) {
            case 'hourly':
                cronExpression = `0 * * * *`;
                break;
            case 'daily':
                cronExpression = `${minutes} ${hours} * * *`;
                break;
            case 'weekly':
                const daysStr = selectedDays.length ? selectedDays.join(',') : '*';
                cronExpression = `${minutes} ${hours} * * ${daysStr}`;
                break;
            case 'monthly':
                cronExpression = `${minutes} ${hours} ${selectedDate} * *`;
                break;
            default:
                cronExpression = '0 0 * * *';
        }

        onScheduleChange(cronExpression);
        return cronExpression;
    };

    useEffect(() => {
        generateCronExpression();
    }, [frequency, timeOfDay, selectedDays, selectedDate]);

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div>
                    <Label>Frequency</Label>
                    <Select 
                        value={frequency} 
                        onValueChange={setFrequency}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="hourly">Every Hour</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {frequency !== 'hourly' && (
                    <div>
                        <Label>Time of Day</Label>
                        <div className="flex space-x-2">
                            <Select 
                                value={timeOfDay.split(':')[0]}
                                onValueChange={(hour) => setTimeOfDay(`${hour}:${timeOfDay.split(':')[1]}`)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Hour" />
                                </SelectTrigger>
                                <SelectContent>
                                    {hours.map(hour => (
                                        <SelectItem key={hour} value={hour}>
                                            {hour}:00
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select 
                                value={timeOfDay.split(':')[1]}
                                onValueChange={(minute) => setTimeOfDay(`${timeOfDay.split(':')[0]}:${minute}`)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Minute" />
                                </SelectTrigger>
                                <SelectContent>
                                    {minutes.map(minute => (
                                        <SelectItem key={minute} value={minute}>
                                            {minute}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {frequency === 'weekly' && (
                    <div>
                        <Label>Days of Week</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {weekdays.map(day => (
                                <Button
                                    key={day.value}
                                    variant={selectedDays.includes(day.value) ? "default" : "outline"}
                                    className="w-full"
                                    onClick={() => {
                                        setSelectedDays(prev => 
                                            prev.includes(day.value)
                                                ? prev.filter(d => d !== day.value)
                                                : [...prev, day.value]
                                        );
                                    }}
                                >
                                    {day.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {frequency === 'monthly' && (
                    <div>
                        <Label>Day of Month</Label>
                        <Select 
                            value={selectedDate}
                            onValueChange={setSelectedDate}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {monthDays.map(day => (
                                    <SelectItem key={day.value} value={day.value}>
                                        {day.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <div className="pt-4 border-t">
                <div className="flex items-center space-x-2">
                    <Input 
                        value={generateCronExpression()} 
                        readOnly 
                        className="flex-grow font-mono text-sm"
                    />
                    <Popover>
                        <PopoverTrigger>
                            <Info className="h-5 w-5 text-gray-500" />
                        </PopoverTrigger>
                        <PopoverContent>
                            <div className="text-sm space-y-2">
                                <p><strong>Current Schedule:</strong></p>
                                {frequency === 'hourly' && <p>Runs at the start of every hour</p>}
                                {frequency === 'daily' && <p>Runs every day at {timeOfDay}</p>}
                                {frequency === 'weekly' && (
                                    <p>Runs every {selectedDays.map(d => 
                                        weekdays.find(w => w.value === d)?.label).join(', ')} at {timeOfDay}</p>
                                )}
                                {frequency === 'monthly' && (
                                    <p>Runs on the {monthDays.find(d => d.value === selectedDate)?.label} of every month at {timeOfDay}</p>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
    );
}