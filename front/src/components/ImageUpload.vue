<template>
  <div class="upload-container">
    <div class="upload-box" 
         @dragover.prevent="isDragging = true"
         @dragleave.prevent="isDragging = false"
         @drop.prevent="handleDrop"
         :class="{ 'dragging': isDragging }">
      <input 
        type="file" 
        ref="fileInput" 
        @change="handleFileSelect" 
        accept="image/*"
        style="display: none"
      />
      
      <div v-if="!uploadedImage" class="upload-content">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <p class="upload-text">Drag and drop an image here, or click to select</p>
        <button @click="$refs.fileInput.click()" class="upload-button">
          Choose File
        </button>
      </div>

      <div v-else class="uploaded-content">
        <img :src="uploadedImage.url" :alt="uploadedImage.originalName" class="preview-image" />
        <div class="image-info">
          <p><strong>File:</strong> {{ uploadedImage.originalName }}</p>
          <p><strong>Size:</strong> {{ formatFileSize(uploadedImage.size) }}</p>
          <div v-if="analysis" class="analysis-block">
            <p><strong>Analysis:</strong></p>
            <pre><code>{{ analysis }}</code></pre>
          </div>
          <div class="button-group">
            <button @click="uploadNew" class="btn btn-primary">Upload Another</button>
            <button @click="copyUrl" class="btn btn-secondary">Copy URL</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="uploading" class="upload-progress">
      <div class="spinner"></div>
      <p>Uploading...</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'

const fileInput = ref(null)
const isDragging = ref(false)
const uploading = ref(false)
const error = ref(null)
const uploadedImage = ref(null)
const analysis = ref('')

// const API_URL = 'http://localhost:3000/api'
const API_URL = 'http://10.121.9.26:3000/api'
const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    uploadFile(file)
  }
}

const handleDrop = (event) => {
  isDragging.value = false
  const file = event.dataTransfer.files[0]
  if (file && file.type.startsWith('image/')) {
    uploadFile(file)
  } else {
    error.value = 'Please drop an image file'
  }
}

const uploadFile = async (file) => {
  uploading.value = true
  error.value = null
  uploadedImage.value = null

  const formData = new FormData()
  formData.append('image', file)

  try {
    const response = await axios.post(`${API_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    uploadedImage.value = response.data.file
    analysis.value = formatAnalysis(response.data.analysis)
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to upload image. Please try again.'
    console.error('Upload error:', err)
  } finally {
    uploading.value = false
  }
}

const uploadNew = () => {
  uploadedImage.value = null
  error.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const copyUrl = async () => {
  if (uploadedImage.value?.fullUrl) {
    try {
      await navigator.clipboard.writeText(uploadedImage.value.fullUrl)
      alert('URL copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const formatAnalysis = (data) => {
  if (!data) return ''
  try {
    if (typeof data === 'string') {
      const trimmed = data.trim()
      if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
        const inner = trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '')
        return inner.trim()
      }
      return JSON.stringify(JSON.parse(trimmed), null, 2)
    }
    return JSON.stringify(data, null, 2)
  } catch (err) {
    console.warn('Failed to parse analysis as JSON, showing raw text.', err)
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  }
}
</script>

<style scoped>
.upload-container {
  background: white;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.upload-box {
  border: 3px dashed #ccc;
  border-radius: 8px;
  padding: 60px 20px;
  text-align: center;
  transition: all 0.3s ease;
  background: #f9f9f9;
  cursor: pointer;
}

.upload-box:hover,
.upload-box.dragging {
  border-color: #667eea;
  background: #f0f0ff;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.upload-content svg {
  color: #667eea;
  margin-bottom: 10px;
}

.upload-text {
  color: #666;
  font-size: 1.1rem;
  margin: 0;
}

.upload-button {
  background: #667eea;
  color: white;
  border: none;
  padding: 12px 30px;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s ease;
}

.upload-button:hover {
  background: #5568d3;
}

.uploaded-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.preview-image {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.image-info {
  text-align: center;
  width: 100%;
}

.image-info p {
  margin: 10px 0;
  color: #333;
}

.analysis-block {
  text-align: left;
  margin-top: 15px;
}

.analysis-block pre {
  background: #1e1e1e;
  color: #c5e4ff;
  padding: 15px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.9rem;
  max-height: 240px;
}

.button-group {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.error-message {
  margin-top: 20px;
  padding: 15px;
  background: #fee;
  color: #c33;
  border-radius: 6px;
  border: 1px solid #fcc;
}

.upload-progress {
  margin-top: 20px;
  text-align: center;
  color: #667eea;
}

.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>

