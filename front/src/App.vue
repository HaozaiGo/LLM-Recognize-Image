<template>
  <div id="app">
    <div class="container">
      <h1>Image Upload</h1>
      <ImageUpload />
    </div>
  </div>
</template>

<script setup>
import ImageUpload from './components/ImageUpload.vue'
</script>

<style>
#app {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.container {
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  color: white;
  text-align: center;
  margin-bottom: 30px;
  font-size: 2.5rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}
</style>

