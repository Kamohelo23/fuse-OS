"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Folder,
  ArrowRight,
  ArrowUp,
  Download,
  RefreshCw,
  Home,
  Upload,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Search,
  Eye,
  Edit,
  LogOut,
  FileText,
  X,
} from "lucide-react"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
 import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { useDropzone } from "react-dropzone" 
import { LoginForm } from "./components/login-form"
import { formatBytes, formatDate, getFileIcon } from "./utils/file-utils"
import { FilePreview } from "./components/file-preview"
import { SearchResults } from "./components/search-results"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export default function FileExplorer() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authToken, setAuthToken] = useState("")
  const [username, setUsername] = useState("")

  // File explorer state
  const [path, setPath] = useState("C:\\Users\\Public")
  const [directoryContent, setDirectoryContent] = useState<{ items: { name: string; isDirectory: boolean; path: string; size?: number; date?: string; time?: string }[] } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [viewMode, setViewMode] = useState("grid") // grid or list
  const [breadcrumbs, setBreadcrumbs] = useState<{ name: string; path: string }[]>([])

  // Upload state
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])

  // New folder state
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)

  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ path: string; isDirectory: boolean; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Rename state
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [itemToRename, setItemToRename] = useState<{ path: string; isDirectory: boolean; name: string } | null>(null)
  const [newName, setNewName] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)

  // Preview state
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [previewItem, setPreviewItem] = useState<{ path: string; isDirectory: boolean; name: string } | null>(null)
  const [previewData, setPreviewData] = useState(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Search state
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)

  // Check authentication on load
  const token = useState(false)

  // Check authentication on load
  useEffect(() => {
    const token = localStorage.getItem("authToken")
    if (token) {
      verifyToken(token)
    }
  }, [])

  // Verify authentication token
  const verifyToken = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setIsAuthenticated(true)
        setAuthToken(token)
        setUsername(data.user.username)
      } else {
        // Token invalid, clear it
        localStorage.removeItem("authToken")
      }
    } catch (err) {
      console.error("Auth verification error:", err)
    }
  }

  // Handle login
  const handleLogin = (token: string, user: string) => {
    localStorage.setItem("authToken", token)
    setAuthToken(token)
    setIsAuthenticated(true)
    setUsername(user)
  }

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("authToken")
    setAuthToken("")
    setIsAuthenticated(false)
    setUsername("")
  }

  // Update breadcrumbs when path changes
  useEffect(() => {
    const parts = path.split("\\")
    const crumbs = []

    // Add drive as first crumb
    if (parts[0]) {
      crumbs.push({
        name: parts[0] + "\\",
        path: parts[0] + "\\",
      })
    }

    // Add each folder in path
    for (let i = 1; i < parts.length; i++) {
      if (parts[i]) {
        const currentPath = parts.slice(0, i + 1).join("\\")
        crumbs.push({
          name: parts[i],
          path: currentPath,
        })
      }
    }

    setBreadcrumbs(crumbs)
  }, [path])

  // API request with authentication
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    if (!authToken && isAuthenticated) {
      throw new Error("Authentication token missing")
    }

    const headers = {
      ...options.headers,
      Authorization: `Bearer ${authToken}`,
    }

    return fetch(url, {
      ...options,
      headers,
    })
  }

  const fetchDirectoryContents = async () => {
    if (!isAuthenticated) return

    setIsLoading(true)
    setError("")

    try {
      const response = await authenticatedFetch(`${API_URL}/list?path=${encodeURIComponent(path)}`)
      const data = await response.json()

      if (response.ok) {
        setDirectoryContent(data)
      } else {
        setError(data.error || "Failed to fetch directory contents")
        toast({
          title: "Error",
          description: data.error || "Failed to fetch directory contents",
          variant: "destructive",
        })
      }
    } catch (err) {
      setError("Network error: " + (err instanceof Error ? err.message : "Unknown error"))
      toast({
        title: "Network Error",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    if (isAuthenticated) {
      fetchDirectoryContents()
    }
  }, [isAuthenticated])

  // Refresh when path changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchDirectoryContents()
    }
  }, [path, isAuthenticated])

  const navigateToDirectory = (dirPath: string) => {
    setPath(dirPath)
  }

  const goUpDirectory = () => {
    const parts = path.split("\\")
    if (parts.length > 1) {
      const upPath = parts.slice(0, -1).join("\\")
      setPath(upPath || "C:\\")
    }
  }

  const goHome = () => {
    setPath("C:\\Users\\Public")
  }

  const downloadFile = (filePath: string) => {
    window.open(`${API_URL}/download?path=${encodeURIComponent(filePath)}&token=${authToken}`, "_blank")
  }

  const handleUploadClick = () => {
    setUploadFiles([])
    setIsUploadDialogOpen(true)
  }

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadFiles(acceptedFiles)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  const handleFileUpload = async () => {
    if (uploadFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one file to upload",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    uploadFiles.forEach((file) => {
      formData.append("files", file)
    })
    formData.append("targetDirectory", path)

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + Math.random() * 10
          return newProgress >= 90 ? 90 : newProgress
        })
      }, 300)

      const response = await authenticatedFetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: `${uploadFiles.length} file(s) uploaded successfully`,
        })

        // Refresh directory contents after upload
        setTimeout(() => {
          fetchDirectoryContents()
          setIsUploadDialogOpen(false)
          setIsUploading(false)
          setUploadProgress(0)
          setUploadFiles([])
        }, 1000)
      } else {
        throw new Error(result.error || "Upload failed")
      }
    } catch (err) {
      toast({
        title: "Upload Failed",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive",
      })
      setIsUploading(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast({
        title: "Error",
        description: "Folder name cannot be empty",
        variant: "destructive",
      })
      return
    }

    setIsCreatingFolder(true)

    try {
      const response = await authenticatedFetch(`${API_URL}/mkdir`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: path,
          name: newFolderName,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "Folder created successfully",
        })

        // Refresh directory contents
        fetchDirectoryContents()
        setIsNewFolderDialogOpen(false)
        setNewFolderName("")
      } else {
        throw new Error(result.error || "Failed to create folder")
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsCreatingFolder(false)
    }
  }

  const confirmDelete = (item: { path: string; isDirectory: boolean; name: string }) => {
    setItemToDelete(item)
    setIsDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!itemToDelete) return

    setIsDeleting(true)

    try {
      const response = await authenticatedFetch(`${API_URL}/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: itemToDelete.path,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: `${itemToDelete.isDirectory ? "Folder" : "File"} deleted successfully`,
        })

        // Refresh directory contents
        fetchDirectoryContents()
      } else {
        throw new Error(result.error || "Failed to delete item")
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
      setItemToDelete(null)
    }
  }

  const confirmRename = (item: { path: string; isDirectory: boolean; name: string }) => {
    setItemToRename(item)
    setNewName(item.name)
    setIsRenameDialogOpen(true)
  }

  const handleRename = async () => {
    if (!itemToRename || !newName.trim()) return

    if (newName === itemToRename.name) {
      setIsRenameDialogOpen(false)
      return
    }

    setIsRenaming(true)

    try {
      const response = await authenticatedFetch(`${API_URL}/rename`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: itemToRename.path,
          newName: newName,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "Item renamed successfully",
        })

        // Refresh directory contents
        fetchDirectoryContents()
      } else {
        throw new Error(result.error || "Failed to rename item")
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsRenaming(false)
      setIsRenameDialogOpen(false)
      setItemToRename(null)
    }
  }

  const handlePreview = async (item: { path: string; isDirectory: boolean; name: string }) => {
    if (!item || item.isDirectory) return

    setPreviewItem(item)
    setIsPreviewDialogOpen(true)
    setIsLoadingPreview(true)
    setPreviewData(null)

    try {
      const response = await authenticatedFetch(`${API_URL}/preview?path=${encodeURIComponent(item.path)}`)

      if (response.ok) {
        const data = await response.json()
        setPreviewData(data)
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to load preview")
      }
    } catch (err) {
      toast({
        title: "Preview Error",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Error",
        description: "Please enter a search term",
        variant: "destructive",
      })
      return
    }

    setIsSearching(true)
    setSearchResults(null)

    try {
      const response = await authenticatedFetch(
        `${API_URL}/search?query=${encodeURIComponent(searchQuery)}&path=${encodeURIComponent(path)}`,
      )

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
      } else {
        const error = await response.json()
        throw new Error(error.error || "Search failed")
      }
    } catch (err) {
      toast({
        title: "Search Error",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const navigateToSearchResult = (resultPath: string) => {
    // Extract directory path from file path
    const dirPath = resultPath.substring(0, resultPath.lastIndexOf("\\"))
    setPath(dirPath)
    setIsSearchDialogOpen(false)
  }

  const items = directoryContent?.items || []

  // Sort items: directories first, then files alphabetically
  const sortedItems = [...items].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />
  }

  return (
    <>
      <Card className="w-full max-w-5xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Windows File Explorer</CardTitle>
              <CardDescription>Browse, upload, and download files from your Windows system</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Logged in as {username}</span>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="Enter Windows path"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && fetchDirectoryContents()}
            />
            <Button onClick={fetchDirectoryContents} disabled={isLoading}>
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Browse"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={goHome}>
              <Home className="h-4 w-4 mr-1" /> Home
            </Button>
            <Button variant="outline" size="sm" onClick={goUpDirectory} disabled={path === "C:\\"}>
              <ArrowUp className="h-4 w-4 mr-1" /> Up
            </Button>
            <Button variant="outline" size="sm" onClick={fetchDirectoryContents}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleUploadClick}>
              <Upload className="h-4 w-4 mr-1" /> Upload
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsNewFolderDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Folder
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsSearchDialogOpen(true)}>
              <Search className="h-4 w-4 mr-1" /> Search
            </Button>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewMode("grid")}>
                Grid
              </Button>
              <Button variant="outline" size="sm" onClick={() => setViewMode("list")}>
                List
              </Button>
            </div>
          </div>

          <Breadcrumb className="mb-4">
            {breadcrumbs.map((crumb, i) => (
              <BreadcrumbItem key={i}>
                <BreadcrumbLink onClick={() => navigateToDirectory(crumb.path)}>{crumb.name}</BreadcrumbLink>
                {i < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </BreadcrumbItem>
            ))}
          </Breadcrumb>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Separator className="my-4" />

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : viewMode === "grid" ? (
            <div className="border rounded-md p-4">
              {sortedItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {sortedItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex flex-col items-center p-3 hover:bg-muted rounded cursor-pointer border relative group"
                    >
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        {!item.isDirectory && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePreview({ ...item, path: `${path}\\${item.name}` })
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-yellow-500 hover:text-yellow-700 hover:bg-yellow-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            confirmRename({ ...item, path: `${path}\\${item.name}` })
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            confirmDelete({ ...item, path: `${path}\\${item.name}` })
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div
                        className="flex flex-col items-center"
                        onClick={() => (item.isDirectory ? navigateToDirectory(item.path) : downloadFile(item.path))}
                      >
                        {item.isDirectory ? (
                          <Folder className="h-12 w-12 text-blue-500 mb-2" />
                        ) : (
                          getFileIcon(item.name, "h-12 w-12 mb-2")
                        )}
                        <span className="text-center truncate w-full text-sm">{item.name}</span>
                        {!item.isDirectory && (
                          <span className="text-xs text-muted-foreground">{formatBytes(item.size || 0)}</span>
                        )}
                        {item.isDirectory ? (
                          <ArrowRight className="mt-2 h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Download className="mt-2 h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : directoryContent ? (
                <div className="text-center py-8">No files or folders found</div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">Click "Browse" to view directory contents</div>
              )}
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Date Modified</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.length > 0 ? (
                    sortedItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {item.isDirectory ? (
                            <Folder className="h-5 w-5 text-blue-500" />
                          ) : (
                            getFileIcon(item.name, "h-5 w-5")
                          )}
                        </TableCell>
                        <TableCell
                          className="font-medium cursor-pointer hover:underline"
                          onClick={() => (item.isDirectory ? navigateToDirectory(item.path) : downloadFile(item.path))}
                        >
                          {item.name}
                        </TableCell>
                        <TableCell>{item.isDirectory ? "--" : formatBytes(item.size ?? 0)}</TableCell>
                        <TableCell>{formatDate(item.date || "", item.time || "")}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {item.isDirectory ? (
                              <Button variant="ghost" size="icon" onClick={() => navigateToDirectory(item.path)}>
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => downloadFile(item.path)}>
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handlePreview(item)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-yellow-500"
                              onClick={() => confirmRename(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500"
                              onClick={() => confirmDelete(item)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        {directoryContent ? "No files or folders found" : "Click 'Browse' to view directory contents"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>Upload files to the current directory: {path}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {isUploading ? (
              <div className="space-y-4">
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-center text-sm text-muted-foreground">
                  {uploadProgress < 100 ? "Uploading..." : "Upload complete!"}
                </p>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`flex flex-col items-center justify-center gap-4 p-6 border-2 border-dashed rounded-lg ${
                  isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-center text-muted-foreground">
                  {isDragActive ? "Drop the files here..." : "Drag & drop files here, or click to select files"}
                </p>
                {uploadFiles.length > 0 && (
                  <div className="w-full">
                    <p className="text-sm font-medium mb-2">Selected files:</p>
                    <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                      {uploadFiles.map((file, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground">({formatBytes(file.size)})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUploadDialogOpen(false)}
              disabled={isUploading && uploadProgress < 100}
            >
              Cancel
            </Button>
            <Button onClick={handleFileUpload} disabled={isUploading || uploadFiles.length === 0}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>Enter a name for the new folder in: {path}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Input
              placeholder="Folder Name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFolderDialogOpen(false)} disabled={isCreatingFolder}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={isCreatingFolder || !newFolderName.trim()}>
              {isCreatingFolder ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {itemToDelete?.isDirectory ? "folder" : "file"}: {itemToDelete?.name}?
              {itemToDelete?.isDirectory && " All contents will be permanently deleted."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename {itemToRename?.isDirectory ? "Folder" : "File"}</DialogTitle>
            <DialogDescription>Enter a new name for: {itemToRename?.name}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Input
              placeholder="New Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)} disabled={isRenaming}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isRenaming || !newName.trim()}>
              {isRenaming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Renaming...
                </>
              ) : (
                "Rename"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Preview: {previewItem?.name}</span>
              <Button variant="ghost" size="icon" onClick={() => setIsPreviewDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden h-full">
            {isLoadingPreview ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewData ? (
              <FilePreview data={previewData} />
            ) : (
              <div className="flex justify-center items-center h-full">
                <p className="text-muted-foreground">Preview not available</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => downloadFile(previewItem?.path ?? "")}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Dialog */}
      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Search Files</DialogTitle>
            <DialogDescription>Search for files and folders in {path} and its subdirectories</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search term..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </>
                )}
              </Button>
            </div>

            {searchResults && (
              <SearchResults
                results={searchResults}
                onNavigate={navigateToSearchResult}
                onDownload={downloadFile}
                onPreview={(item: { path: string; isDirectory: boolean; name: string }) => {
                  setIsSearchDialogOpen(false)
                  setTimeout(() => handlePreview(item), 100)
                }}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSearchDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </>
  )
}
