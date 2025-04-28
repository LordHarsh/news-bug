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
import { FaMapMarkedAlt, FaFilter, FaTimes, FaCalendarAlt, FaSearch } from "react-icons/fa"
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
  { label: "Last 3 days", days: 3 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 10 days", days: 10 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 60 days", days: 60 },
  { label: "Last 90 days", days: 90 },
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
    const fromDate = subDays(today, days);
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
    <div className="m-2">
      <div className="flex items-center py-4">
        <Button 
          variant="outline" 
          onClick={() => setShowFilterPanel(!showFilterPanel)}
          className="mr-2 relative"
        >
          <FaFilter className="mr-2" />
          Filters
          {hasActiveFilters() && (
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="mr-2">
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter(
                (column) => column.getCanHide()
              )
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
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
          className="shadow-md hover:shadow-lg transition-shadow"
        >
          <FaMapMarkedAlt className="mr-2" />
          {viewMap ? 'Hide Map' : 'Show Map'}
        </Button>
        
        {/* Quick search when filter panel is hidden */}
        {!showFilterPanel && (
          <div className="relative ml-auto max-w-sm">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Quick search keywords..."
              value={(table.getColumn("keyword")?.getFilterValue() as string) ?? ""}
              onChange={(event) => {
                table.getColumn("keyword")?.setFilterValue(event.target.value)
              }}
              className="pl-9 max-w-sm"
            />
          </div>
        )}
      </div>
      
      {showFilterPanel && (
        <Card className="mb-4 max-w-4xl mx-auto">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Data Filters</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowFilterPanel(false)}
              >
                <FaTimes />
              </Button>
            </div>
            <CardDescription>Refine your results with these filters</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Keyword Filter */}
              <div className="space-y-2">
                <h4 className="font-medium">Keyword</h4>
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Filter by keyword..."
                    value={keywordFilter}
                    onChange={(e) => setKeywordFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <Separator className="my-4" />
              
              {/* Case Count Filter */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Case Count Range</h4>
                  <div className="text-sm text-gray-500">
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
              
              <Separator className="my-4" />
              
              {/* Date Filter */}
              <div className="space-y-2">
                <h4 className="font-medium">Date Filter</h4>
                
                <Tabs defaultValue="preset" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preset">Presets</TabsTrigger>
                    <TabsTrigger value="custom">Custom Range</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="preset" className="space-y-4">
                    <Select 
                      value={selectedDatePreset || ""} 
                      onValueChange={(value) => {
                        if (value) {
                          const days = parseInt(value, 10);
                          applyDatePreset(days);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a date range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Time Periods</SelectLabel>
                          {DATE_PRESETS.map((preset) => (
                            <SelectItem key={preset.days} value={preset.days.toString()}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    
                    {selectedDatePreset && (
                      <div className="flex items-center text-sm">
                        <FaCalendarAlt className="mr-2 text-gray-500" />
                        <span>
                          {dateRange.from && format(dateRange.from, 'PPP')} - {dateRange.to && format(dateRange.to, 'PPP')}
                        </span>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="custom">
                    <div className="flex flex-col space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="flex items-center">
                          <span className="w-16">From:</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                {dateRange.from ? (
                                  format(dateRange.from, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={dateRange.from}
                                onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        <div className="flex items-center">
                          <span className="w-16">To:</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                {dateRange.to ? (
                                  format(dateRange.to, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={dateRange.to}
                                onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                                initialFocus
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
                        >
                          Clear Dates
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              
              <Separator className="my-4" />
              
              {/* Action Buttons */}
              <div className="flex justify-between">
                <Button
                  variant="destructive"
                  onClick={resetFilters}
                >
                  Reset All Filters
                </Button>
                <Button onClick={applyFilters}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
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
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  )
}