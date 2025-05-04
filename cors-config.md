# CORS Configuration for Windows File Explorer

This document explains the Cross-Origin Resource Sharing (CORS) configuration used in the Windows File Explorer application.

## What is CORS?

CORS (Cross-Origin Resource Sharing) is a security feature implemented by browsers that restricts web pages from making requests to a different domain than the one that served the original page. This is a security measure to prevent malicious websites from accessing sensitive data.

## Current Configuration

The application uses the following CORS configuration:

\`\`\`javascript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
  credentials: true,
  maxAge: 86400 // 24 hours
}
\`\`\`

### Configuration Options Explained

- **origin**: Specifies which origins are allowed to access the API
  - In development: Defaults to `http://localhost:3001`
  - In production: Set via the `ALLOWED_ORIGINS` environment variable (comma-separated list)
  
- **methods**: HTTP methods that are allowed when accessing the API
  - Includes: GET, POST, PUT, DELETE, OPTIONS

- **allowedHeaders**: HTTP headers that can be used when making the actual request
  - Content-Type: For specifying the media type of the resource
  - Authorization: For sending authentication credentials

- **exposedHeaders**: Headers that browsers are allowed to access
  - Content-Disposition: Used for file downloads to specify filename

- **credentials**: Whether the request can include user credentials like cookies, HTTP authentication or client-side SSL certificates
  - Set to `true` to allow credentials

- **maxAge**: How long the results of a preflight request can be cached
  - Set to 86400 seconds (24 hours)

## Environment Variables

To configure CORS for different environments, set the following environment variable:

- **ALLOWED_ORIGINS**: Comma-separated list of allowed origins
  - Example: `https://your-app.vercel.app,https://your-other-domain.com`

## Security Considerations

1. **Be specific with origins**: In production, always specify exact domains rather than using wildcards (`*`)
2. **Limit exposed headers**: Only expose headers that are necessary for your frontend
3. **Review regularly**: Update your CORS policy as your application evolves

## Testing CORS Configuration

You can test if your CORS configuration is working correctly by:

1. Accessing your API from different origins
2. Checking browser console for CORS errors
3. Using tools like Postman to test preflight requests
\`\`\`

Let's also update the package.json to ensure we have the latest version of the cors package:

```typescriptreact file="package.json"
[v0-no-op-code-block-prefix]{
  "name": "windows-file-explorer",
  "version": "2.0.0",
  "description": "Windows file explorer web interface with advanced features",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
