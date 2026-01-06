# Star Printer - Image Upload Project

A full-stack application for uploading images via HTTP API, built with Vue3 frontend and Node.js/Express backend.

## Project Structure

```
star-printer/
├── backend/          # Node.js/Express API server
├── front/            # Vue3 frontend application
└── README.md
```

## Features

- Image upload via drag & drop or file selection
- Image preview after upload
- File size validation (max 10MB)
- Image type validation (JPEG, PNG, GIF, WebP)
- Copy image URL to clipboard
- Modern, responsive UI

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The backend server will run on `http://localhost:3000`

### Frontend Setup

1. Navigate to the front directory:
```bash
cd front
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## API Endpoints

### POST /api/upload
Upload an image file.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: FormData with 'image' field

**Response:**
```json
{
  "message": "File uploaded successfully",
  "file": {
    "filename": "image-1234567890-123456789.jpg",
    "originalName": "photo.jpg",
    "size": 123456,
    "url": "/uploads/image-1234567890-123456789.jpg",
    "fullUrl": "http://localhost:3000/uploads/image-1234567890-123456789.jpg"
  }
}
```

### GET /api/images
Get list of all uploaded images.

**Response:**
```json
{
  "images": [
    {
      "filename": "image-1234567890-123456789.jpg",
      "url": "/uploads/image-1234567890-123456789.jpg",
      "fullUrl": "http://localhost:3000/uploads/image-1234567890-123456789.jpg"
    }
  ]
}
```

### GET /api/health
Health check endpoint.

## Usage

1. Start both backend and frontend servers
2. Open your browser and navigate to `http://localhost:5173`
3. Drag and drop an image or click to select a file
4. Once uploaded, you can view the preview and copy the image URL

## Technologies Used

### Backend
- Node.js
- Express.js
- Multer (file upload handling)
- CORS

### Frontend
- Vue 3
- Vite
- Axios
- Modern CSS

## Notes

- Uploaded images are stored in `backend/uploads/` directory
- Maximum file size: 10MB
- Supported formats: JPEG, JPG, PNG, GIF, WebP

