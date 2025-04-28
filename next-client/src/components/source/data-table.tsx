"use client"

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  ColumnFiltersState,
  VisibilityState,
  getFilteredRowModel,
  SortingState,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEffect, useState } from "react"
import { 
  FaMapMarkedAlt, 
  FaFilter, 
  FaTimes, 
  FaCalendarAlt, 
  FaSearch, 
  FaChevronLeft, 
  FaChevronRight, 
  FaColumns, 
  FaRedo 
} from "react-icons/fa"
import { useKeywordsStore } from "@/stores/useKeywords"
import { KeywordDetails } from "@/lib/types/keyword"
import {
  Slider
} from "@/components/ui/slider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, subDays, isAfter, isBefore, parseISO } from "date-fns"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  viewMap: boolean
  setViewMap: (value: boolean) => void
}

// Define preset date options
const DATE_PRESETS = [
  // Today and yesterday
  { label: "Today", days: 0 },
  { label: "Yesterday", days: 1 },
  
  // Recent periods
  { label: "Last 3 days", days: 3 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  
  // Monthly periods
  { label: "Last 30 days", days: 30 },
  { label: "Last 60 days", days: 60 },
  { label: "Last 90 days", days: 90 },
  
  // Longer periods
  { label: "Last 6 months", days: 180 },
  { label: "Last year", days: 365 },
];

export function DataTable<TData, TValue>({
  columns,
  data,
  viewMap,
  setViewMap,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  
  // Original data reference to be able to reset to initial state
  const [originalData, setOriginalData] = useState<KeywordDetails[]>([]);
  
  // Case count filter range
  const [caseCountRange, setCaseCountRange] = useState<[number, number]>([0, 0]);
  const [appliedCaseCountRange, setAppliedCaseCountRange] = useState<[number, number]>([0, 0]);

  // Keyword filter state
  const [keywordFilter, setKeywordFilter] = useState("");

  // Date filter state
  const today = new Date();
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [appliedDateRange, setAppliedDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [selectedDatePreset, setSelectedDatePreset] = useState<string | null>(null);
  
  // Get access to the keywords store
  const { keywords, setKeywords } = useKeywordsStore()

  // Track if filters are being applied from the store or UI
  const [isUpdatingFromStore, setIsUpdatingFromStore] = useState(false)

  // Initialize originalData when data changes
  useEffect(() => {
    if (data && data.length > 0 && originalData.length === 0) {
      setOriginalData(data as KeywordDetails[]);
      
      // Find min and max case counts for slider initialization
      const keywordData = data as KeywordDetails[];
      if (keywordData.length > 0) {
        const minCase = Math.min(...keywordData.map(k => k.caseCount));
        const maxCase = Math.max(...keywordData.map(k => k.caseCount));
        setCaseCountRange([minCase, maxCase]);
        setAppliedCaseCountRange([minCase, maxCase]);
      }
    }
  }, [data, originalData]);

  // Keep keyword filter in sync with the table's filter
  useEffect(() => {
    const tableKeywordFilter = table.getColumn("keyword")?.getFilterValue() as string;
    if (tableKeywordFilter !== keywordFilter) {
      setKeywordFilter(tableKeywordFilter || "");
    }
  }, [columnFilters]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: (filters) => {
      setColumnFilters(filters)

      // Only update the store if the change came from the UI
      if (!isUpdatingFromStore) {
        // Get the actual filters array
        const actualFilters = typeof filters === 'function' ? filters(columnFilters) : filters;
        
        // Find the keyword filter if it exists
        const keywordFilter = actualFilters.find((filter: any) => filter.id === "keyword")

        if (keywordFilter) {
          const filterValue = keywordFilter.value as string
          applyAllFilters(filterValue);
        } else {
          // If filter is cleared, apply other filters
          applyAllFilters("");
        }
      }
    },
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

  // Apply all filters
  const applyAllFilters = (keywordFilter: string = "") => {
    let filteredKeywords = originalData;
    
    // Apply keyword filter
    if (keywordFilter) {
      filteredKeywords = filteredKeywords.filter(item =>
        item.keyword.toString().toLowerCase().includes(keywordFilter.toLowerCase())
      );
    }
    
    // Apply case count filter
    filteredKeywords = filteredKeywords.filter(item => 
      item.caseCount >= appliedCaseCountRange[0] && 
      item.caseCount <= appliedCaseCountRange[1]
    );

    // Apply date filter if set
    if (appliedDateRange.from || appliedDateRange.to) {
      filteredKeywords = filteredKeywords.filter(item => {
        const itemDate = new Date(item.date);
        
        if (appliedDateRange.from && appliedDateRange.to) {
          return isAfter(itemDate, appliedDateRange.from) && 
                 isBefore(itemDate, appliedDateRange.to);
        } else if (appliedDateRange.from) {
          return isAfter(itemDate, appliedDateRange.from);
        } else if (appliedDateRange.to) {
          return isBefore(itemDate, appliedDateRange.to);
        }
        return true;
      });
    }
    
    setKeywords(filteredKeywords);
  };

  // Apply filters from the filter panel
  const applyFilters = () => {
    // Update the table's keyword filter if needed
    if (keywordFilter !== (table.getColumn("keyword")?.getFilterValue() as string || "")) {
      table.getColumn("keyword")?.setFilterValue(keywordFilter);
    }
    
    setAppliedCaseCountRange(caseCountRange);
    setAppliedDateRange(dateRange);
    
    // Apply all filters
    applyAllFilters(keywordFilter);
  };

  // Apply preset date filter
  const applyDatePreset = (days: number) => {
    const fromDate = days === 0 
      ? new Date(today.setHours(0, 0, 0, 0)) // Start of today for "Today" option
      : subDays(today, days);
    const newDateRange = {
      from: fromDate,
      to: today
    };
    
    setDateRange(newDateRange);
    setSelectedDatePreset(days.toString());
  };

  // Reset all filters
  const resetFilters = () => {
    // Reset keyword filter
    setKeywordFilter("");
    table.getColumn("keyword")?.setFilterValue("");
    
    // Reset case count filter
    if (originalData.length > 0) {
      const minCase = Math.min(...originalData.map(k => k.caseCount));
      const maxCase = Math.max(...originalData.map(k => k.caseCount));
      setCaseCountRange([minCase, maxCase]);
      setAppliedCaseCountRange([minCase, maxCase]);
    }
    
    // Reset date filter
    setDateRange({ from: undefined, to: undefined });
    setAppliedDateRange({ from: undefined, to: undefined });
    setSelectedDatePreset(null);
    
    // Reset data to original
    setKeywords(originalData);
  };

  // Check if any filters are applied
  const hasActiveFilters = () => {
    return (
      keywordFilter !== "" ||
      appliedCaseCountRange[0] !== (originalData.length ? Math.min(...originalData.map(k => k.caseCount)) : 0) ||
      appliedCaseCountRange[1] !== (originalData.length ? Math.max(...originalData.map(k => k.caseCount)) : 100) ||
      appliedDateRange.from !== undefined || 
      appliedDateRange.to !== undefined
    );
  };

  return (
    <div className="space-y-4 p-1 sm:p-4 bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant={showFilterPanel ? "default" : "outline"} 
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="relative bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600/90 dark:hover:bg-indigo-600"
            size="sm"
          >
            <FaFilter className="mr-2" />
            Filters
            {hasActiveFilters() && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 border border-white dark:border-slate-800 animate-pulse"></span>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-700 dark:hover:border-indigo-600 dark:bg-slate-800 dark:hover:bg-slate-700">
                <FaColumns className="mr-2 text-indigo-600 dark:text-indigo-400" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 dark:bg-slate-800 dark:border-slate-700">
              {table
                .getAllColumns()
                .filter(
                  (column) => column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize dark:text-slate-200"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => setViewMap(!viewMap)}
            size="sm"
            variant={viewMap ? "default" : "outline"}
            className={viewMap ? 
              "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600/90 dark:hover:bg-emerald-600 transition-all duration-200" :
              "border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:hover:border-emerald-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-emerald-400 transition-all duration-200"
            }
          >
            <FaMapMarkedAlt className="mr-2" />
            {viewMap ? 'Hide Map' : 'Show Map'}
          </Button>
          
          {hasActiveFilters() && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={resetFilters}
              className="text-amber-600 hover:text-amber-700 border-amber-200 hover:border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:border-amber-600 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <FaRedo className="mr-2" />
              Reset Filters
            </Button>
          )}
        </div>
        
        {/* Quick search when filter panel is hidden */}
        <div className="relative w-full sm:w-auto max-w-sm ml-0 sm:ml-auto">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-indigo-400" />
          <Input
            placeholder="Quick search keywords..."
            value={(table.getColumn("keyword")?.getFilterValue() as string) ?? ""}
            onChange={(event) => {
              table.getColumn("keyword")?.setFilterValue(event.target.value)
            }}
            className="pl-9 w-full sm:max-w-sm border-indigo-200 focus-visible:ring-indigo-500 dark:border-indigo-700 dark:bg-slate-800 dark:placeholder:text-slate-400"
          />
        </div>
      </div>
      
      {showFilterPanel && (
        <Card className="mb-4 mx-auto border-l-4 border-l-indigo-500 bg-white dark:bg-slate-800 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20">
          <CardHeader className="pb-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-tr-md">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <FaFilter className="text-indigo-500" />
                Data Filters
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowFilterPanel(false)}
                className="rounded-full h-8 w-8 p-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
              >
                <FaTimes className="text-indigo-500" />
              </Button>
            </div>
            <CardDescription className="text-indigo-600/70 dark:text-indigo-400/80">Refine your results with these filters</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Keyword Filter */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center text-indigo-700 dark:text-indigo-300">
                  <FaSearch className="mr-2 text-indigo-500" />
                  Keyword
                </h4>
                <div className="relative">
                  <Input
                    placeholder="Filter by keyword..."
                    value={keywordFilter}
                    onChange={(e) => setKeywordFilter(e.target.value)}
                    className="w-full border-indigo-200 focus-visible:ring-indigo-500 dark:border-indigo-700 dark:bg-slate-700 dark:placeholder:text-slate-400"
                  />
                </div>
              </div>
              
              {/* Case Count Filter */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-indigo-700 dark:text-indigo-300">Case Count Range</h4>
                  <div className="text-sm bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200 px-2 py-1 rounded-md font-medium">
                    {caseCountRange[0]} - {caseCountRange[1]}
                  </div>
                </div>
                <Slider
                  defaultValue={caseCountRange}
                  min={originalData.length ? Math.min(...originalData.map(k => k.caseCount)) : 0}
                  max={originalData.length ? Math.max(...originalData.map(k => k.caseCount)) : 100}
                  step={1}
                  value={caseCountRange}
                  onValueChange={(values) => setCaseCountRange(values as [number, number])}
                  className="my-4"
                />
              </div>
              
              {/* Date Filter */}
              <div className="space-y-2 md:col-span-2">
                <h4 className="font-medium flex items-center text-indigo-700 dark:text-indigo-300">
                  <FaCalendarAlt className="mr-2 text-indigo-500" />
                  Date Filter
                </h4>
                
                <Tabs defaultValue="preset" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-indigo-100 dark:bg-indigo-800">
                    <TabsTrigger value="preset" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-100">Presets</TabsTrigger>
                    <TabsTrigger value="custom" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-100">Custom Range</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="preset" className="space-y-4 pt-4">
                    <Select 
                      value={selectedDatePreset || ""} 
                      onValueChange={(value) => {
                        if (value) {
                          const days = parseInt(value, 10);
                          applyDatePreset(days);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full border-indigo-200 dark:border-indigo-700 dark:bg-slate-700">
                        <SelectValue placeholder="Select a date range" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                        <SelectGroup>
                          <SelectLabel className="text-indigo-600 dark:text-indigo-300">Today & Yesterday</SelectLabel>
                          {DATE_PRESETS.slice(0, 2).map((preset) => (
                            <SelectItem key={preset.days} value={preset.days.toString()}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel className="text-indigo-600 dark:text-indigo-300">Recent Periods</SelectLabel>
                          {DATE_PRESETS.slice(2, 5).map((preset) => (
                            <SelectItem key={preset.days} value={preset.days.toString()}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel className="text-indigo-600 dark:text-indigo-300">Monthly Periods</SelectLabel>
                          {DATE_PRESETS.slice(5, 8).map((preset) => (
                            <SelectItem key={preset.days} value={preset.days.toString()}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel className="text-indigo-600 dark:text-indigo-300">Longer Periods</SelectLabel>
                          {DATE_PRESETS.slice(8).map((preset) => (
                            <SelectItem key={preset.days} value={preset.days.toString()}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    
                    {selectedDatePreset && (
                      <div className="flex items-center text-sm bg-indigo-100 dark:bg-indigo-800/60 text-indigo-700 dark:text-indigo-200 p-2 rounded-md">
                        <FaCalendarAlt className="mr-2 text-indigo-500" />
                        <span>
                          {dateRange.from && format(dateRange.from, 'PPP')} - {dateRange.to && format(dateRange.to, 'PPP')}
                        </span>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="custom" className="pt-4">
                    <div className="flex flex-col space-y-2">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col space-y-2">
                          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">From:</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal border-indigo-200 hover:border-indigo-300 dark:border-indigo-700 dark:hover:border-indigo-600 dark:bg-slate-700"
                              >
                                {dateRange.from ? (
                                  format(dateRange.from, "PPP")
                                ) : (
                                  <span className="text-gray-500 dark:text-slate-400">Pick a date</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={dateRange.from}
                                onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                                initialFocus
                                className="rounded-md border border-indigo-200 dark:border-indigo-700 dark:bg-slate-800"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        <div className="flex flex-col space-y-2">
                          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">To:</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal border-indigo-200 hover:border-indigo-300 dark:border-indigo-700 dark:hover:border-indigo-600 dark:bg-slate-700"
                              >
                                {dateRange.to ? (
                                  format(dateRange.to, "PPP")
                                ) : (
                                  <span className="text-gray-500 dark:text-slate-400">Pick a date</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={dateRange.to}
                                onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                                initialFocus
                                className="rounded-md border border-indigo-200 dark:border-indigo-700 dark:bg-slate-800"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      
                      {(dateRange.from || dateRange.to) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setDateRange({ from: undefined, to: undefined });
                            setSelectedDatePreset(null);
                          }}
                          className="self-start mt-2 border-amber-200 hover:border-amber-300 hover:bg-amber-50 text-amber-600 dark:border-amber-700 dark:hover:border-amber-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-amber-400"
                        >
                          <FaTimes className="mr-2" />
                          Clear Dates
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-between md:col-span-2 pt-4 border-t border-indigo-100 dark:border-indigo-700/50">
                <Button
                  variant="outline"
                  onClick={resetFilters}
                  className="border-amber-200 hover:border-amber-300 hover:bg-amber-50 text-amber-600 dark:border-amber-700 dark:hover:border-amber-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-amber-400"
                >
                  <FaTimes className="mr-2" />
                  Reset All
                </Button>
                <Button 
                  onClick={applyFilters}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600/90 dark:hover:bg-indigo-600"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="rounded-md border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden bg-white dark:bg-slate-800">
        <Table className="border-collapse">
          <TableHeader className="bg-indigo-50 dark:bg-indigo-900/30">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b-0 hover:bg-transparent dark:border-slate-700">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead 
                      key={header.id} 
                      className="font-semibold text-indigo-700 dark:text-indigo-300 h-11 border-b border-indigo-100 dark:border-indigo-800/50 px-4"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={`
                    transition-colors hover:bg-indigo-50/70 dark:hover:bg-indigo-900/30 
                    border-b border-slate-200 dark:border-slate-700
                    ${index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/80'}
                  `}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id} 
                      className="dark:text-slate-300 px-4 py-3 border-r last:border-r-0 border-slate-100 dark:border-slate-700/50"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-[200px] text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <FaSearch className="h-8 w-8 mb-2 opacity-20 text-indigo-300 dark:text-indigo-500/50" />
                    <p className="dark:text-slate-400">No results found.</p>
                    {hasActiveFilters() && (
                      <Button 
                        variant="link" 
                        onClick={resetFilters} 
                        className="mt-2 text-indigo-600 dark:text-indigo-400"
                      >
                        Reset filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between py-4">
        <div className="flex-1 text-sm text-indigo-600/70 dark:text-indigo-400/80">
          {table.getFilteredRowModel().rows.length} item(s) found
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 w-8 p-0 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-700 disabled:text-slate-300 dark:border-indigo-700 dark:hover:border-indigo-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-indigo-400 dark:disabled:text-slate-600"
          >
            <FaChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 w-8 p-0 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-700 disabled:text-slate-300 dark:border-indigo-700 dark:hover:border-indigo-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-indigo-400 dark:disabled:text-slate-600"
          >
            <FaChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}