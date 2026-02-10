"use client"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface WinnersFiltersProps {
  onSearchChange: (query: string) => void
  onTimeFilterChange: (filter: "all" | "week" | "month") => void
  searchQuery: string
  timeFilter: "all" | "week" | "month"
}

export function WinnersFilters({ onSearchChange, onTimeFilterChange, searchQuery, timeFilter }: WinnersFiltersProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="relative flex-1 md:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          placeholder="Search by name or prize..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
          aria-label="Search winners by name or prize"
        />
      </div>

      <div className="flex gap-2" role="group" aria-label="Filter by time period">
        <Button
          variant={timeFilter === "week" ? "default" : "outline"}
          size="sm"
          onClick={() => onTimeFilterChange("week")}
        >
          This Week
        </Button>
        <Button
          variant={timeFilter === "month" ? "default" : "outline"}
          size="sm"
          onClick={() => onTimeFilterChange("month")}
        >
          This Month
        </Button>
        <Button
          variant={timeFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => onTimeFilterChange("all")}
        >
          All Time
        </Button>
      </div>
    </div>
  )
}
