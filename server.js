require("dotenv").config()
const express = require("express")
const cors = require("cors")
const { exec } = require("child_process")
const path = require("path")
const fs = require("fs")
const crypto = require("crypto")
const multer = require("multer")
const { promisify } = require("util")
const execPromise = promisify(exec)
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")

const app = express()

// CORS Configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : ["http://localhost:3001"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Disposition"],
  credentials: true,
  maxAge: 86400, // 24 hours
}

app.use(cors(corsOptions))

// Enable preflight requests for all routes
app.options("*", cors(corsOptions))

app.use(express.json())

// Environment variables
const PSEXEC = process.env.PSEXEC_PATH
const USER = process.env.WINDOWS_USERNAME
const PASS = process.env.WINDOWS_PASSWORD
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

// Validate environment variables
if (!PSEXEC || !USER || !PASS) {
  console.error("Missing required environment variables")
  process.exit(1)
}

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, "temp")
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir)
}

// Create preview directory if it doesn't exist
const previewDir = path.join(__dirname, "public", "previews")
if (!fs.existsSync(previewDir)) {
  fs.mkdirSync(previewDir, { recursive: true })
}

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")))

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString("hex")
    cb(null, uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
})

// Authentication middleware
const authenticateToken = (req, res, next) => {
  // For development, you can bypass authentication
  if (process.env.NODE_ENV === "development" && process.env.BYPASS_AUTH === "true") {
    return next()
  }

  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).send({ error: "Authentication required" })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).send({ error: "Invalid or expired token" })
    }
    req.user = user
    next()
  })
}

// Sanitize path to prevent command injection
function sanitizePath(inputPath) {
  // Remove any characters that could be used for command injection
  return inputPath.replace(/[&;|`$<>]/g, "")
}

// Validate path is a valid Windows path
function isValidWindowsPath(inputPath) {
  // Basic Windows path validation - improved regex
  const windowsPathRegex = /^[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$/
  return windowsPathRegex.test(inputPath)
}

// Parse directory listing into structured data
function parseDirectoryListing(output) {
  const lines = output.split("\n")
  const results = []

  let currentDir = ""

  for (const line of lines) {
    // Extract current directory
    if (line.includes("Directory of")) {
      currentDir = line.split("Directory of ")[1].trim()
      continue
    }

    // Skip summary lines and empty lines
    if (line.includes("File(s)") || line.includes("Dir(s)") || !line.trim() || line.includes("Volume in drive")) {
      continue
    }

    // Parse file/directory entries
    const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}\s+[AP]M)/)
    if (dateMatch) {
      const isDirectory = line.includes("<DIR>")
      let size = "0"
      let name = ""

      if (isDirectory) {
        const parts = line.trim().split(/\s+/)
        name = parts.slice(4).join(" ")
      } else {
        const parts = line.trim().split(/\s+/)
        size = parts[3].replace(/,/g, "")
        name = parts.slice(4).join(" ")
      }

      // Skip . and .. entries
      if (name !== "." && name !== "..") {
        results.push({
          name,
          isDirectory,
          size: isDirectory ? null : Number.parseInt(size, 10),
          path: path.join(currentDir, name).replace(/\\/g, "\\"),
          date: dateMatch[1],
          time: dateMatch[2],
        })
      }
    }
  }

  return results
}

// Get file extension
function getFileExtension(filename) {
  return filename.split(".").pop().toLowerCase()
}

// Check if file is previewable
function isPreviewable(filename) {
  const ext = getFileExtension(filename)
  return [
    // Images
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "svg",
    "webp",
    // Text
    "txt",
    "md",
    "json",
    "xml",
    "csv",
    "log",
    // Code
    "js",
    "jsx",
    "ts",
    "tsx",
    "html",
    "css",
    "py",
    "java",
    "c",
    "cpp",
    "cs",
    // Documents
    "pdf",
  ].includes(ext)
}

// Authentication endpoints
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body

  // In a real app, you would validate against a database
  // For this example, we'll use the Windows credentials from env vars
  if (username === USER && password === PASS) {
    // Create token
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "24h" })
    res.send({ token, username })
  } else {
    res.status(401).send({ error: "Invalid credentials" })
  }
})

app.get("/auth/verify", authenticateToken, (req, res) => {
  res.send({ valid: true, user: req.user })
})

// List directory contents
app.get("/list", authenticateToken, (req, res) => {
  let targetPath = req.query.path || "C:\\Users\\Public"

  // Sanitize and validate path
  targetPath = sanitizePath(targetPath)

  if (!isValidWindowsPath(targetPath)) {
    return res.status(400).send({ error: "Invalid Windows path format" })
  }

  // Create a temporary output file for capturing command output
  const outputFile = path.join(tempDir, `output_${Date.now()}.txt`)

  // Build command with proper escaping
  // Using redirection to file to avoid stdout buffering issues with PsExec
  const cmd = `"${PSEXEC}" -accepteula -nobanner -u "${USER}" -p "${PASS}" cmd /c "dir "${targetPath}" > "${outputFile}""`

  console.log("Running directory listing command...")

  exec(cmd, { maxBuffer: 1024 * 1000 }, (error, stdout, stderr) => {
    if (error) {
      console.error("Execution error:", error)
      return res.status(500).send({ error: stderr || error.message })
    }

    // Read the output file
    fs.readFile(outputFile, "utf8", (err, data) => {
      // Clean up the temporary file
      fs.unlink(outputFile, () => {})

      if (err) {
        return res.status(500).send({ error: "Failed to read command output" })
      }

      try {
        // Parse the directory listing into structured data
        const parsedData = parseDirectoryListing(data)
        res.send({
          path: targetPath,
          items: parsedData,
          rawOutput: data, // Include raw output for debugging
        })
      } catch (parseError) {
        console.error("Parse error:", parseError)
        res.send({
          path: targetPath,
          items: [],
          rawOutput: data,
          parseError: parseError.message,
        })
      }
    })
  })
})

// Search files
app.get("/search", authenticateToken, async (req, res) => {
  const { query, path: searchPath } = req.query

  if (!query) {
    return res.status(400).send({ error: "Search query is required" })
  }

  let targetPath = searchPath || "C:\\Users\\Public"

  // Sanitize and validate path
  targetPath = sanitizePath(targetPath)

  if (!isValidWindowsPath(targetPath)) {
    return res.status(400).send({ error: "Invalid Windows path format" })
  }

  // Create a temporary output file for capturing command output
  const outputFile = path.join(tempDir, `search_${Date.now()}.txt`)

  // Build command with proper escaping - using dir /s /b to search recursively
  const cmd = `"${PSEXEC}" -accepteula -nobanner -u "${USER}" -p "${PASS}" cmd /c "dir "${targetPath}\\*${query}*" /s /b > "${outputFile}""`

  console.log("Running search command...")

  try {
    await execPromise(cmd, { maxBuffer: 1024 * 1000 * 10 })

    // Read the output file
    const data = await fs.promises.readFile(outputFile, "utf8")

    // Clean up the temporary file
    fs.unlink(outputFile, () => {})

    // Process the results
    const results = data
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const filePath = line.trim()
        const name = path.basename(filePath)
        const isDirectory = !path.extname(filePath)

        return {
          name,
          path: filePath,
          isDirectory,
          relativePath: filePath.replace(targetPath, "").replace(/^\\/, ""),
        }
      })

    res.send({
      query,
      path: targetPath,
      results,
      count: results.length,
    })
  } catch (error) {
    console.error("Search error:", error)
    res.status(500).send({
      error: "Failed to perform search",
      details: error.message,
    })
  }
})

// Download file endpoint
app.get("/download", authenticateToken, (req, res) => {
  let filePath = req.query.path

  if (!filePath) {
    return res.status(400).send({ error: "File path is required" })
  }

  // Sanitize and validate path
  filePath = sanitizePath(filePath)

  if (!isValidWindowsPath(filePath)) {
    return res.status(400).send({ error: "Invalid Windows path format" })
  }

  // Generate a unique temporary file name
  const tempFileName = crypto.randomBytes(16).toString("hex")
  const tempFilePath = path.join(tempDir, tempFileName)

  // Command to copy the file to our temp directory
  const cmd = `"${PSEXEC}" -accepteula -nobanner -u "${USER}" -p "${PASS}" cmd /c "copy "${filePath}" "${tempFilePath}" /Y"`

  console.log("Running file copy command...")

  exec(cmd, { maxBuffer: 1024 * 1000 * 10 }, (error, stdout, stderr) => {
    if (error) {
      console.error("Execution error:", error)
      return res.status(500).send({ error: stderr || error.message })
    }

    // Check if the file was copied successfully
    if (!fs.existsSync(tempFilePath)) {
      return res.status(500).send({ error: "Failed to copy file" })
    }

    // Get the original filename
    const fileName = path.basename(filePath)

    // Set headers for file download
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
    res.setHeader("Content-Type", "application/octet-stream")

    // Stream the file to the client
    const fileStream = fs.createReadStream(tempFilePath)
    fileStream.pipe(res)

    // Clean up the temp file after sending
    fileStream.on("end", () => {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error("Error deleting temp file:", err)
      })
    })
  })
})

// Preview file endpoint
app.get("/preview", authenticateToken, async (req, res) => {
  let filePath = req.query.path

  if (!filePath) {
    return res.status(400).send({ error: "File path is required" })
  }

  // Sanitize and validate path
  filePath = sanitizePath(filePath)

  if (!isValidWindowsPath(filePath)) {
    return res.status(400).send({ error: "Invalid Windows path format" })
  }

  const fileName = path.basename(filePath)

  if (!isPreviewable(fileName)) {
    return res.status(400).send({ error: "File type not supported for preview" })
  }

  // Generate a unique preview file name
  const previewFileName = crypto.randomBytes(16).toString("hex") + path.extname(fileName)
  const previewFilePath = path.join(previewDir, previewFileName)

  try {
    // Command to copy the file to our preview directory
    const cmd = `"${PSEXEC}" -accepteula -nobanner -u "${USER}" -p "${PASS}" cmd /c "copy "${filePath}" "${previewFilePath}" /Y"`
    await execPromise(cmd)

    // Check if the file was copied successfully
    if (!fs.existsSync(previewFilePath)) {
      return res.status(500).send({ error: "Failed to copy file for preview" })
    }

    // For text files, read the content
    const ext = getFileExtension(fileName)
    if (
      [
        "txt",
        "md",
        "json",
        "xml",
        "csv",
        "log",
        "js",
        "jsx",
        "ts",
        "tsx",
        "html",
        "css",
        "py",
        "java",
        "c",
        "cpp",
        "cs",
      ].includes(ext)
    ) {
      const content = await fs.promises.readFile(previewFilePath, "utf8")

      // Limit content size for large files
      const maxLength = 100000 // 100KB
      const truncated = content.length > maxLength
      const previewContent = truncated
        ? content.substring(0, maxLength) + "...\n\n[File truncated due to size]"
        : content

      res.send({
        type: "text",
        content: previewContent,
        truncated,
        extension: ext,
        name: fileName,
      })
    } else {
      // For binary files like images, return the URL
      const previewUrl = `/previews/${previewFileName}`
      res.send({
        type: "binary",
        url: previewUrl,
        extension: ext,
        name: fileName,
      })
    }
  } catch (error) {
    console.error("Preview error:", error)
    res.status(500).send({
      error: "Failed to generate preview",
      details: error.message,
    })
  }
})

// File info endpoint
app.get("/fileinfo", authenticateToken, (req, res) => {
  let filePath = req.query.path

  if (!filePath) {
    return res.status(400).send({ error: "File path is required" })
  }

  // Sanitize and validate path
  filePath = sanitizePath(filePath)

  if (!isValidWindowsPath(filePath)) {
    return res.status(400).send({ error: "Invalid Windows path format" })
  }

  // Create a temporary output file for capturing command output
  const outputFile = path.join(tempDir, `fileinfo_${Date.now()}.txt`)

  // Command to get file info
  const cmd = `"${PSEXEC}" -accepteula -nobanner -u "${USER}" -p "${PASS}" cmd /c "dir "${filePath}" /a > "${outputFile}""`

  console.log("Running file info command...")

  exec(cmd, { maxBuffer: 1024 * 1000 }, (error, stdout, stderr) => {
    if (error) {
      console.error("Execution error:", error)
      return res.status(500).send({ error: stderr || error.message })
    }

    // Read the output file
    fs.readFile(outputFile, "utf8", (err, data) => {
      // Clean up the temporary file
      fs.unlink(outputFile, () => {})

      if (err) {
        return res.status(500).send({ error: "Failed to read command output" })
      }

      try {
        // Parse the file info
        const parsedData = parseDirectoryListing(data)
        res.send({
          fileInfo: parsedData.length > 0 ? parsedData[0] : null,
          rawOutput: data,
        })
      } catch (parseError) {
        console.error("Parse error:", parseError)
        res.send({
          fileInfo: null,
          rawOutput: data,
          parseError: parseError.message,
        })
      }
    })
  })
})

// File upload endpoint - now supports multiple files
app.post("/upload", authenticateToken, upload.array("files"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send({ error: "No files uploaded" })
    }

    let targetDir = req.body.targetDirectory
    if (!targetDir) {
      return res.status(400).send({ error: "Target directory is required" })
    }

    // Sanitize and validate path
    targetDir = sanitizePath(targetDir)
    if (!isValidWindowsPath(targetDir)) {
      return res.status(400).send({ error: "Invalid Windows path format" })
    }

    // Ensure target directory exists
    const checkDirCmd = `"${PSEXEC}" -accepteula -nobanner -u "${USER}" -p "${PASS}" cmd /c "if not exist "${targetDir}\\" mkdir "${targetDir}"""`
    await execPromise(checkDirCmd)

    // Process each uploaded file
    const results = []
    for (const file of req.files) {
      // Get the uploaded file path and original name
      const tempFilePath = file.path
      const originalFilename = file.originalname
      const targetFilePath = path.join(targetDir, originalFilename).replace(/\//g, "\\")

      // Copy the file to the target directory
      const copyCmd = `"${PSEXEC}" -accepteula -nobanner -u "${USER}" -p "${PASS}" cmd /c "copy "${tempFilePath}" "${targetFilePath}" /Y"`

      console.log("Uploading file to:", targetFilePath)
      await execPromise(copyCmd)

      // Clean up the temp file
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error("Error deleting temp file:", err)
      })

      results.push({
        filename: originalFilename,
        targetPath: targetFilePath,
        size: file.size,
      })
    }

    res.send({
      success: true,
      message: `${req.files.length} file(s) uploaded successfully`,
      files: results,
    })
  } catch (error) {
    console.error("Upload error:", error)
    res.status(500).send({
      error: "Failed to upload file(s)",
      details: error.message,
    })
  }
})

// Create directory endpoint
app.post("/mkdir", authenticateToken, async (req, res) => {
  try {
    const { path: dirPath, name } = req.body

    if (!dirPath || !name) {
      return res.status(400).send({ error: "Directory path and name are required" })
    }

    // Sanitize and validate path
    const sanitizedPath = sanitizePath(dirPath)
    if (!isValidWindowsPath(sanitizedPath)) {
      return res.status(400).send({ error: "Invalid Windows path format" })
    }

    // Sanitize directory name
    const sanitizedName = name.replace(/[\\/:*?"<>|]/g, "")
    if (sanitizedName !== name) {
      return res.status(400).send({ error: "Directory name contains invalid characters" })
    }

    const fullPath = path.join(sanitizedPath, sanitizedName).replace(/\//g, "\\")

    // Create the directory
    const mkdirCmd = `"${PSEXEC}" -accepteula -nobanner -u "${USER}" -p "${PASS}" cmd /c "mkdir "${fullPath}""`

    console.log("Creating directory:", fullPath)
    const { stdout, stderr } = await execPromise(mkdirCmd)

    res.send({
      success: true,
      message: "Directory created successfully",
      path: fullPath,
    })
  } catch (error) {
    console.error("Create directory error:", error)
    res.status(500).send({
      error: "Failed to create directory",
      details: error.message,
    })
  }
})

// Rename file/directory endpoint
app.post("/rename", authenticateToken, async (req, res) => {
  try {
    const { path: itemPath, newName } = req.body

    if (!itemPath || !newName) {
      return res.status(400).send({ error: "Path and new name are required" })
    }

    // Sanitize and validate path
    const sanitizedPath = sanitizePath(itemPath)
    if (!isValidWindowsPath(sanitizedPath)) {
      return res.status(400).send({ error: "Invalid Windows path format" })
    }

    // Sanitize new name
    const sanitizedName = newName.replace(/[\\/:*?"<>|]/g, "")
    if (sanitizedName !== newName) {
      return res.status(400).send({ error: "New name contains invalid characters" })
    }

    // Get directory and current filename
    const dirPath = path.dirname(sanitizedPath)
    const newPath = path.join(dirPath, sanitizedName).replace(/\//g, "\\")

    // Rename the file or directory
    const renameCmd = `"${PSEXEC}" -accepteula -nobanner -u "${USER}" -p "${PASS}" cmd /c "rename "${sanitizedPath}" "${sanitizedName}""`

    console.log(`Renaming ${sanitizedPath} to ${newPath}`)
    const { stdout, stderr } = await execPromise(renameCmd)

    res.send({
      success: true,
      message: "Item renamed successfully",
      oldPath: sanitizedPath,
      newPath: newPath,
    })
  } catch (error) {
    console.error("Rename error:", error)
    res.status(500).send({
      error: "Failed to rename item",
      details: error.message,
    })
  }
})

// Delete file/directory endpoint
app.delete("/delete", authenticateToken, async (req, res) => {
  try {
    const { path: targetPath } = req.body

    if (!targetPath) {
      return res.status(400).send({ error: "Path is required" })
    }

    // Sanitize and validate path
    const sanitizedPath = sanitizePath(targetPath)
    if (!isValidWindowsPath(sanitizedPath)) {
      return res.status(400).send({ error: "Invalid Windows path format" })
    }

    // Check if it's a directory or file
    const checkCmd = `"${PSEXEC}" -accepteula -nobanner -u "${USER}" -p "${PASS}" cmd /c "if exist "${sanitizedPath}\\*" (echo directory) else (echo file)"`

    const { stdout } = await execPromise(checkCmd)
    const isDirectory = stdout.trim().toLowerCase() === "directory"

    // Delete the file or directory
    let deleteCmd
    if (isDirectory) {
      deleteCmd = `"${PSEXEC}" -accepteula -nobanner -u "${USER}" -p "${PASS}" cmd /c "rmdir /s /q "${sanitizedPath}""`
    } else {
      deleteCmd = `"${PSEXEC}" -accepteula -nobanner -u "${USER}" -p "${PASS}" cmd /c "del /f /q "${sanitizedPath}""`
    }

    console.log(`Deleting ${isDirectory ? "directory" : "file"}:`, sanitizedPath)
    await execPromise(deleteCmd)

    res.send({
      success: true,
      message: `${isDirectory ? "Directory" : "File"} deleted successfully`,
      path: sanitizedPath,
    })
  } catch (error) {
    console.error("Delete error:", error)
    res.status(500).send({
      error: "Failed to delete item",
      details: error.message,
    })
  }
})

// Add a simple health check endpoint
app.get("/health", (req, res) => {
  res.send({ status: "ok", version: "2.0.0" })
})

// Clean up temp directory on startup
fs.readdir(tempDir, (err, files) => {
  if (err) return
  for (const file of files) {
    fs.unlink(path.join(tempDir, file), (err) => {
      if (err) console.error("Error deleting temp file:", err)
    })
  }
})

// Clean up preview directory on startup (files older than 1 hour)
fs.readdir(previewDir, (err, files) => {
  if (err) return
  const now = Date.now()
  for (const file of files) {
    const filePath = path.join(previewDir, file)
    fs.stat(filePath, (err, stats) => {
      if (err) return
      // Delete files older than 1 hour
      if (now - stats.mtime.getTime() > 3600000) {
        fs.unlink(filePath, (err) => {
          if (err) console.error("Error deleting preview file:", err)
        })
      }
    })
  }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`File server running on http://localhost:${PORT}`)
})