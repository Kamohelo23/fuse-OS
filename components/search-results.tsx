"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowRight, Download, Eye, Folder } from "lucide-react"
import { getFileIcon } from "../utils/file-utils"

interface SearchResultItem {
  name: string;
  relativePath: string;
  path: string;
  isDirectory: boolean;
}

interface SearchResultsProps {
  results: {
    query: string;
    path: string;
    results: SearchResultItem[];
    count: number;
  };
  onNavigate: (path: string) => void;
  onDownload: (path: string) => void;
  onPreview: (item: SearchResultItem) => void;
}

export function SearchResults({ results, onNavigate, onDownload, onPreview }: SearchResultsProps) {
  if (!results) return null

  const { query, path, results: items, count } = results

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No results found for "{query}"</p>
      </div>
    )
  }

  return (
    <div className="border rounded-md">
      <div className="p-4 border-b">
        <p className="text-sm">
          Found <span className="font-medium">{count}</span> results for "{query}" in {path}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30px]"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Path</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={index}>
              <TableCell>
                {item.isDirectory ? <Folder className="h-5 w-5 text-blue-500" /> : getFileIcon(item.name, "h-5 w-5")}
              </TableCell>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{item.relativePath}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onNavigate(item.path)}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  {!item.isDirectory && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => onDownload(item.path)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onPreview(item)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
