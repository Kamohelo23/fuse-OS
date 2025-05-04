import {
  FileText,
  FileImage,
  FileCode,
  FileAudio,
  FileVideo,
  FileIcon as FilePdf,
  FileArchive,
  File,
} from "lucide-react"

// Format bytes to human-readable format
export function formatBytes(bytes: number, decimals = 2) {
  if (!bytes || bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

// Get appropriate icon based on file extension
export function getFileIcon(filename: string, className = "h-5 w-5") {
  const extension = filename.split(".").pop()?.toLowerCase()

  // Image files
  if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(extension)) {
    return <FileImage className={`${className} text-green-500`} />
  }

  // Document files
  if (["doc", "docx", "txt", "rtf", "odt"].includes(extension)) {
    return <FileText className={`${className} text-blue-500`} />
  }

  // Code files
  if (["js", "jsx", "ts", "tsx", "html", "css", "json", "xml", "py", "java", "c", "cpp", "cs"].includes(extension)) {
    return <FileCode className={`${className} text-yellow-500`} />
  }

  // PDF files
  if (extension === "pdf") {
    return <FilePdf className={`${className} text-red-500`} />
  }

  // Audio files
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(extension)) {
    return <FileAudio className={`${className} text-purple-500`} />
  }

  // Video files
  if (["mp4", "avi", "mov", "wmv", "flv", "mkv", "webm"].includes(extension)) {
    return <FileVideo className={`${className} text-pink-500`} />
  }

  // Archive files
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
    return <FileArchive className={`${className} text-orange-500`} />
  }

  // Default file icon
  return <File className={`${className} text-gray-500`} />
}

// Format date and time
export function formatDate(date: string, time: string) {
  if (!date || !time) return ""
  return `${date} ${time}`
}

// Get file type category
export function getFileType(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase()

  // Images
  if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(extension)) {
    return "image"
  }

  // Documents
  if (["doc", "docx", "txt", "rtf", "odt", "pdf"].includes(extension)) {
    return "document"
  }

  // Code
  if (["js", "jsx", "ts", "tsx", "html", "css", "py", "java", "c", "cpp", "cs"].includes(extension)) {
    return "code"
  }

  // Data
  if (["json", "xml", "csv"].includes(extension)) {
    return "data"
  }

  // Media
  if (["mp3", "wav", "ogg", "flac", "m4a", "mp4", "avi", "mov", "wmv", "flv", "mkv", "webm"].includes(extension)) {
    return "media"
  }

  // Archives
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
    return "archive"
  }

  return "other"
}
