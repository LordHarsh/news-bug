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
import { FaMapMarkedAlt } from "react-icons/fa"
import { useKeywordsStore } from "@/stores/useKeywords"
import { KeywordDetails } from "@/lib/types/keyword"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  viewMap: boolean
  setViewMap: (value: boolean) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  viewMap,
  setViewMap,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Get access to the keywords store
  const { keywords, setKeywords } = useKeywordsStore()

  // Track if filters are being applied from the store or UI
  const [isUpdatingFromStore, setIsUpdatingFromStore] = useState(false)

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

          // Apply the filter to the keywords in the store
          // This is a simple example - you might need more complex logic
          // depending on your exact requirements
          const filteredKeywords = data.filter(item =>
            (item as any).keyword?.toLowerCase().includes(filterValue.toLowerCase())
          ) as KeywordDetails[]

          setKeywords(filteredKeywords)
        } else {
          // If no keyword filter, reset to use all keywords
          setKeywords(data as KeywordDetails[])
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
  })

  // When keywords change in the store, update the table filter
  useEffect(() => {
    const keywordColumn = table.getColumn("keyword")
    if (keywordColumn) {
      const currentFilterValue = keywordColumn.getFilterValue() as string

      // Only update if the filter needs to change
      // This helps prevent infinite loops
      if (keywords.length < data.length && currentFilterValue === "") {
        setIsUpdatingFromStore(true)

        // Create a filter that would match the keywords in the store
        // This is a simplified approach - you may need to adjust based on your needs
        const keywordValues = keywords.map(k => k.keyword)
        if (keywordValues.length > 0) {
          // Using the first keyword as a filter example
          // You might want a more sophisticated approach
          keywordColumn.setFilterValue(keywordValues[0])
        }

        setTimeout(() => setIsUpdatingFromStore(false), 0)
      }
    }
  }, [keywords, table, data])

  return (
    <div className="m-2">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filter keyword..."
          value={(table.getColumn("keyword")?.getFilterValue() as string) ?? ""}
          onChange={(event) => {
            table.getColumn("keyword")?.setFilterValue(event.target.value)
          }}
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
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
          className="shadow-md hover:shadow-lg transition-shadow ml-2"
        >
          <FaMapMarkedAlt className="mr-2" />
          {viewMap ? 'Hide Map' : 'Show Map'}
        </Button>
      </div>
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