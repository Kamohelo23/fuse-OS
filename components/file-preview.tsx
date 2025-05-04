"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import Image from "next/image"
import { FileText } from "lucide-react"

interface FileData {
  type: "text" | "binary";
  extension: string;
  name: string;
  content: string;
  url?: string;
  truncated?: boolean;
}

export function FilePreview({ data }: { data: FileData }) {
  const [activeTab, setActiveTab] = useState("preview")

  if (!data) return null

  const { type, extension, name, content, url, truncated } = data

  // Determine if this is a code file
  const isCode = ["js", "jsx", "ts", "tsx", "html", "css", "py", "java", "c", "cpp", "cs"].includes(extension)

  // Determine if this is a data file
  const isData = ["json", "xml", "csv"].includes(extension)

  // Determine if this is an image
  const isImage = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(extension)

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="preview" className="w-full h-full flex flex-col">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          {type === "text" && <TabsTrigger value="raw">Raw</TabsTrigger>}
        </TabsList>
        <TabsContent value="preview" className="flex-1 overflow-auto">
          {type === "text" && (
            <div className="h-full">
              {isCode && (
                <div className="bg-zinc-900 text-zinc-100 p-4 rounded-md h-full overflow-auto">
                  <pre className="text-sm font-mono">
                    <code>{content}</code>
                  </pre>
                </div>
              )}
              {isData && (
                <div className="bg-zinc-900 text-zinc-100 p-4 rounded-md h-full overflow-auto">
                  <pre className="text-sm font-mono">
                    <code>{content}</code>
                  </pre>
                </div>
              )}
              {!isCode && !isData && (
                <Card className="p-4 h-full overflow-auto">
                  <pre className="text-sm whitespace-pre-wrap">{content}</pre>
                </Card>
              )}
            </div>
          )}
          {type === "binary" && isImage && (
            <div className="flex items-center justify-center h-full">
              <div className="relative max-w-full max-h-full">
                <Image
                  src={url || "/placeholder.svg"}
                  alt={name}
                  width={800}
                  height={600}
                  className="object-contain max-h-[60vh]"
                  style={{ objectFit: "contain" }}
                />
              </div>
            </div>
          )}
          {type === "binary" && !isImage && (
            <div className="flex flex-col items-center justify-center h-full">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Preview not available for this file type</p>
            </div>
          )}
        </TabsContent>
        {type === "text" && (
          <TabsContent value="raw" className="flex-1 overflow-auto">
            <Card className="p-4 h-full overflow-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap">{content}</pre>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      {truncated && (
        <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded-md">
          This file is too large to display completely. Download the file to view its full contents.
        </div>
      )}
    </div>
  )
}
