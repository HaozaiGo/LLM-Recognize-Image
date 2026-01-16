require("dotenv").config();
const OpenAI = require("openai");
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const sharp = require("sharp");
const { HttpProxyAgent } = require("http-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { Ollama } = require('ollama');
const mysql = require('mysql2/promise');
const { ChatOpenAI } = require('@langchain/openai');
const { SqlDatabase } = require('langchain/sql_db');
const { SqlDatabaseChain } = require('langchain/chains/sql_db');
const { DataSource } = require('typeorm');

let undiciDispatcher = null;
try {
  const undici = require('undici');
  const timeout = parseInt(process.env.OLLAMA_TIMEOUT || "1800000");
  undiciDispatcher = new undici.Agent({
    headersTimeout: timeout,
    bodyTimeout: timeout,
    connectTimeout: 10000,
  });
  undici.setGlobalDispatcher(undiciDispatcher);
  console.log(`Undici dispatcher configured with timeout: ${timeout}ms`);
} catch (e) {
  console.warn('Failed to set undici dispatcher:', e.message);
  console.warn('Undici not available, using default fetch timeout');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter,
});

// Serve uploaded images statically
app.use("/uploads", express.static(uploadsDir));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Image upload endpoint
app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      url: fileUrl,
      fullUrl: `${req.protocol}://${req.get("host")}${fileUrl}`,
    };

    // Process image with OpenAI Vision API for accurate image analysis
    let analysis = null;
    let processed = false;
    let processingError = null;
    const recognitionType = req.body.type || 'printer';
    
    const getPrompt = (type) => {
      if (type === 'medicine') {
        return '请分析这张图片中的药品信息。请告诉我图片中显示的药品名称以及该药品的功效介绍。请以JSON格式返回答案，包含"medicine_name"和"efficacy"两个键。';
      }
      return '请分析这张图片中的打印机信息。请告诉我图片中显示的是什么型号的打印机以及这台打印机使用的纸张尺寸。请以JSON格式返回答案，包含"printer_model"和"paper_size"两个键。';
    };

    // Use OpenAI Vision API if configured, otherwise try DeepSeek
    if (process.env.OPENAI_API_KEY) {
      try {
        const imagePath = req.file.path;
        // Resize image for OpenAI Vision API (recommended max 2048x2048)
        const resizedImageBuffer = await sharp(imagePath)
          .resize(2048, 2048, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();

        // Convert to base64
        const imageBase64 = resizedImageBuffer.toString("base64");

        // Use OpenAI Vision API for actual image analysis
        let lastError = null;
        const maxRetries = process.env.PROXY_URL ? 2 : 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const openaiConfig = {
              apiKey: process.env.OPENAI_API_KEY,
            };
            if (process.env.PROXY_URL && attempt === 1) {
              openaiConfig.httpAgent = new HttpsProxyAgent(process.env.PROXY_URL);
            }
            const openai = new OpenAI(openaiConfig);
            
            const completion = await openai.chat.completions.create(
              {
                model: process.env.OPENAI_VISION_MODEL || "gpt-4o", // or "gpt-4-vision-preview" or "gpt-4o-mini"
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: getPrompt(recognitionType),
                      },
                      {
                        type: "image_url",
                        image_url: {
                          url: `data:image/jpeg;base64,${imageBase64}`,
                        },
                      },
                    ],
                  },
                ],
                max_tokens: 1000,
              },
              {
                timeout: 60000, // 60 second timeout
              }
            );

            analysis = completion.choices[0].message.content;
            processed = true;
            console.log(
              `Image ${req.file.filename} processed successfully with OpenAI Vision`
            );
            break; // Success, exit retry loop
          } catch (retryError) {
            lastError = retryError;
            console.error(
              `OpenAI Vision API attempt ${attempt}/${maxRetries} failed:`,
              retryError.message
            );

            const isConnectionError = 
              retryError.message?.includes("Connection error") ||
              retryError.message?.includes("ECONNREFUSED") ||
              retryError.message?.includes("ETIMEDOUT") ||
              retryError.message?.includes("ECONNRESET") ||
              retryError.code === "ECONNREFUSED" ||
              retryError.code === "ETIMEDOUT" ||
              retryError.code === "ECONNRESET" ||
              retryError.cause?.code === "ECONNREFUSED" ||
              retryError.cause?.code === "ECONNRESET";

            // If it's a connection error and not the last attempt
            if (attempt < maxRetries && isConnectionError) {
              if (process.env.PROXY_URL && attempt === 1) {
                console.log(`Proxy connection failed, retrying without proxy...`);
              } else {
                const waitTime = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
                console.log(`Retrying in ${waitTime}ms...`);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
              }
            } else {
              // Not a connection error or last attempt, throw immediately
              throw retryError;
            }
          }
        }

        // If all retries failed
        if (!processed && lastError) {
          throw lastError;
        }
      } catch (error) {
        console.error(
          `Error processing image ${req.file.filename} with OpenAI:`,
          error.message
        );
        console.error("Full error:", error);

        const isQuotaError = error.message.includes("429") || error.status === 429 || error.message.includes("quota");
        
        if (isQuotaError && process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_BASE_URL) {
          console.log("OpenAI quota exceeded, falling back to DeepSeek...");
        } else {
          if (
            error.message.includes("Connection error") ||
            error.code === "ECONNREFUSED"
          ) {
            processingError =
              "无法连接到OpenAI API。请检查网络连接或配置OPENAI_BASE_URL。";
          } else if (error.message.includes("401") || error.status === 401) {
            processingError = "OpenAI API密钥无效。请检查OPENAI_API_KEY配置。";
          } else if (isQuotaError) {
            processingError = "OpenAI API配额已超限，请稍后重试。";
          } else {
            processingError =
              error.message || "Failed to process image with OpenAI Vision API";
          }
          processed = false;
        }
      }
    }
    
    if (!processed && process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_BASE_URL) {
      // Fallback to DeepSeek (note: DeepSeek doesn't support vision, so results will be inaccurate)
      try {
        const imagePath = req.file.path;
        const openai = new OpenAI({
          baseURL: 'https://api.deepseek.com',
          apiKey: process.env.DEEPSEEK_API_KEY,
        });
        // Resize and compress image to reduce token count
        const resizedImageBuffer = await sharp(imagePath)
          .resize(1024, 1024, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toBuffer();

        const imageBase64 = resizedImageBuffer.toString("base64");
        const estimatedTokens = Math.ceil(imageBase64.length / 4);

        let finalImageBase64 = imageBase64;
        if (estimatedTokens > 100000) {
          console.log("Image still too large, reducing further...");
          const smallerBuffer = await sharp(imagePath)
            .resize(512, 512, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality: 70 })
            .toBuffer();
          finalImageBase64 = smallerBuffer.toString("base64");
        }

        // DeepSeek API: Note - this won't actually analyze the image, just the text
        const response = await openai.chat.completions.create(
          {
            model: "deepseek-chat",
            messages: [
              {
                role: "user",
                content: `${getPrompt(recognitionType)}\n\n图片base64数据: data:image/jpeg;base64,${finalImageBase64}`,
              },
            ],
          },
        );

        analysis = response.choices[0].message.content;
        console.log(analysis, '--------------------------------');
        processed = true;
        console.log(
          `Image ${req.file.filename} processed with DeepSeek (note: may be inaccurate)`
        );
      } catch (error) {
        console.error(
          `Error processing image ${req.file.filename}:`,
          error.message
        );
        console.error("Error details:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data) {
          processingError =
            error.response.data.error?.message ||
            JSON.stringify(error.response.data);
        } else {
          processingError =
            error.message || "Failed to process image with DeepSeek API";
        }
        processed = false;
      }
    }

    res.json({
      message: "File uploaded successfully",
      file: fileInfo,
      analysis: analysis,
      processed: processed,
      ...(processingError && { processingError: processingError }),
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message || "Failed to upload file" });
  }
});

// Get all uploaded images
app.get("/api/images", (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const images = files.map((file) => ({
      filename: file,
      url: `/uploads/${file}`,
      fullUrl: `${req.protocol}://${req.get("host")}/uploads/${file}`,
    }));
    res.json({ images });
  } catch (error) {
    console.error("Error reading images:", error);
    res.status(500).json({ error: "Failed to read images" });
  }
});
app.post("/api/test", async (req, res) => {
  try {
    const openaiConfig = {
      apiKey: process.env.OPENAI_API_KEY,
    };
    if (process.env.PROXY_URL) {
      openaiConfig.httpAgent = new HttpsProxyAgent(process.env.PROXY_URL);
    }
    const client = new OpenAI(openaiConfig);
    async function test() {
      const res = await client.models.list();
      return res.data;
    }
    const data = await test();
    res.json({ message: "Test completed", data: data });
  } catch (error) {
    console.error("Error testing OpenAI:", error);
    res.status(500).json({ error: "Failed to test OpenAI" });
  }
});

// DeepSeek chat completion endpoint
app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.DEEPSEEK_API_KEY || !process.env.DEEPSEEK_BASE_URL) {
      return res
        .status(500)
        .json({ error: "DeepSeek API configuration is missing" });
    }

    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL,
    });

    const { messages, message, model = "deepseek-chat" } = req.body;
    console.log("Received request body:", { messages, message, model });

    // Support both formats: messages array or single message string
    let chatMessages;
    if (messages && Array.isArray(messages)) {
      chatMessages = messages;
    } else if (message && typeof message === "string") {
      // If single message is provided, wrap it in messages array
      chatMessages = [{ role: "user", content: message }];
    } else {
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      return res.status(400).json({
        error: "Messages array or message string is required",
        received: req.body,
      });
    }

    const completion = await openai.chat.completions.create({
      messages: chatMessages,
      model: model,
    });

    console.log(completion.choices[0].message.content);
    res.json({ completion: completion.choices[0].message.content });
  } catch (error) {
    console.error("Chat completion error:", error);

    // Handle specific API errors
    if (error.status === 402) {
      return res.status(402).json({
        error: "Insufficient Balance",
        message:
          "Your DeepSeek API account has insufficient balance. Please recharge your account.",
        details: error.error || null,
      });
    }

    if (error.status === 401) {
      return res.status(401).json({
        error: "Authentication Failed",
        message:
          "Invalid API key. Please check your DEEPSEEK_API_KEY in the .env file.",
        details: error.error || null,
      });
    }

    // Handle other API errors
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      error: error.message || "Failed to get chat completion",
      details: error.error || error.response?.data || null,
    });
  }
});

// Ollama connection test endpoint
app.get("/api/ollama/test", async (req, res) => {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const url = new URL(ollamaUrl);
    const host = `${url.hostname}${url.port ? `:${url.port}` : ''}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${url.protocol}//${host}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
    
    if (response.ok) {
      const data = await response.json();
      res.json({ 
        success: true, 
        message: "Ollama 连接成功",
        url: ollamaUrl,
        models: data.models || []
      });
    } else {
      res.status(response.status).json({ 
        success: false, 
        message: `Ollama 响应错误: ${response.status}`,
        url: ollamaUrl
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message,
      code: error.code,
      url: process.env.OLLAMA_URL || "http://localhost:11434"
    });
  }
});

// Speech to text endpoint
app.post("/api/speech-to-text", async (req, res) => {
  let tempFilePath = null;
  try {
    if (req.body.audio) {
      const audioBuffer = Buffer.from(req.body.audio, "base64");
      const format = req.body.format || "m4a";
      tempFilePath = path.join(uploadsDir, `audio-${Date.now()}.${format}`);
      fs.writeFileSync(tempFilePath, audioBuffer);
    } else if (req.file) {
      tempFilePath = req.file.path;
    } else {
      return res.status(400).json({ error: "No audio data provided" });
    }

    if (!process.env.OPENAI_API_KEY) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }

    let openai;
    let lastError = null;
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const openaiConfig = {
          apiKey: process.env.OPENAI_API_KEY,
        };
        if (process.env.PROXY_URL && attempt === 1) {
          openaiConfig.httpAgent = new HttpsProxyAgent(process.env.PROXY_URL);
        }
        openai = new OpenAI(openaiConfig);

        const transcription = await openai.audio.transcriptions.create(
          {
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
            language: "zh",
          },
          {
            timeout: 60000,
          }
        );

        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }

        return res.json({ text: transcription.text });
      } catch (retryError) {
        lastError = retryError;
        const isConnectionError = 
          retryError.message?.includes("Connection error") ||
          retryError.message?.includes("ECONNREFUSED") ||
          retryError.message?.includes("ETIMEDOUT") ||
          retryError.message?.includes("ECONNRESET") ||
          retryError.code === "ECONNREFUSED" ||
          retryError.code === "ETIMEDOUT" ||
          retryError.code === "ECONNRESET" ||
          retryError.cause?.code === "ECONNREFUSED" ||
          retryError.cause?.code === "ECONNRESET";
        
        if (attempt < maxRetries && isConnectionError) {
          if (process.env.PROXY_URL && attempt === 1) {
            console.log(`Proxy connection failed, retrying without proxy...`);
          } else {
            console.log(`Connection failed, retrying...`);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw retryError;
      }
    }

  } catch (error) {
    console.error("Speech to text error:", error);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    let errorMessage = "Failed to transcribe audio";
    if (error.message?.includes("Connection error") || 
        error.cause?.code === "ECONNREFUSED" || 
        error.cause?.code === "ECONNRESET") {
      errorMessage = "无法连接到 OpenAI API。请检查网络连接或代理设置。";
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      error: errorMessage 
    });
  }
});

// Query users with langchain endpoint
app.post("/api/query-users", async (req, res) => {
  let datasource = null;
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const dbConfig = {
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'rootpassword',
      database: process.env.MYSQL_DATABASE || 'mydatabase',
    };

    datasource = new DataSource({
      type: 'mysql',
      host: dbConfig.host,
      port: dbConfig.port,
      username: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      synchronize: false,
      logging: false,
      entities: [],
    });

    await datasource.initialize();
    console.log('DataSource initialized');
    console.log('Connected to database:', dbConfig.database);

    const connection = datasource.driver.connection;
    
    const databases = await connection.query('SHOW DATABASES');
    console.log('Available databases:', databases.map(d => Object.values(d)[0]));
    
    const tables = await connection.query('SHOW TABLES');
    console.log('Database tables:', tables);

    const db = await SqlDatabase.fromDataSourceParams({
      appDataSource: datasource,
      sampleRowsInTableInfo: 3,
    });
    console.log('SqlDatabase created');
    
    const dbTables = db.allTables.map(t => t.tableName);
    console.log('SqlDatabase available tables:', dbTables);

    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0,
      timeout: 30000,
      maxRetries: 2,
    });

    const chain = new SqlDatabaseChain({
      llm,
      database: db,
      verbose: true,
    });
    console.log('Chain created, starting query:', query);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.error('Query timeout after 60 seconds');
        reject(new Error('Query timeout after 60 seconds'));
      }, 60000);
    });

    console.log('Calling chain.run...');
    
    try {
      const result = await Promise.race([
        chain.run(query),
        timeoutPromise
      ]);

      console.log('Query result received:', result);
      console.log('Result type:', typeof result);
      console.log('Result length:', result?.length);
      
      await datasource.destroy();
      console.log('DataSource destroyed');
      
      res.json({ result });
    } catch (chainError) {
      console.error('Chain run error:', chainError);
      await datasource.destroy();
      throw chainError;
    }
  } catch (error) {
    console.error("Query users error:", error);
    if (datasource && datasource.isInitialized) {
      await datasource.destroy();
    }
    res.status(500).json({
      error: error.message || "Failed to query users",
    });
  }
});

// Ollama chat endpoint
app.post("/api/ollama/chat", async (req, res) => {
  try {
    const { message, image, model = "gemma3" } = req.body;
    if (!message && !image) {
      return res.status(400).json({ error: "Message or image is required" });
    }

    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const url = new URL(ollamaUrl);
    const host = `${url.hostname}${url.port ? `:${url.port}` : ''}`;
    const timeout = parseInt(process.env.OLLAMA_TIMEOUT || "1800000");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const ollamaClient = new Ollama({ 
      host: host,
      fetch: async (url, options) => {
        const fetchOptions = {
          ...options,
          signal: controller.signal,
          headers: {
            ...options?.headers,
            'Connection': 'keep-alive',
          },
        };
        if (undiciDispatcher) {
          fetchOptions.dispatcher = undiciDispatcher;
        }
        return fetch(url, fetchOptions).finally(() => clearTimeout(timeoutId));
      }
    });

    const requestBody = {
      model: model,
      messages: [
        {
          role: "user",
          content: message || "请分析这张图片",
          ...(image && { images: [image] }),
        },
      ],
    };
    
    const response = await ollamaClient.chat(requestBody);
    res.json({ content: response.message?.content || response.response });
  } catch (error) {
    console.error("Ollama chat error:", error);
    console.error("Ollama URL:", process.env.OLLAMA_URL || "http://localhost:11434");
    
    let errorMessage = error.message || "Failed to get ollama response";
    if (error.code === "ECONNREFUSED" || error.message?.includes("fetch failed") || error.message?.includes("ECONNREFUSED")) {
      errorMessage = "无法连接到 Ollama 服务。请确保 Ollama 正在运行，或检查 OLLAMA_URL 配置。";
    } else if (error.code === "UND_ERR_HEADERS_TIMEOUT" || error.message?.includes("Headers Timeout") || error.message?.includes("timeout")) {
      errorMessage = "Ollama 服务响应超时。请检查 Ollama 服务状态或增加 OLLAMA_TIMEOUT 配置。";
    }
    
    res.status(500).json({
      error: errorMessage,
      details: error.response?.data || null,
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File too large. Maximum size is 10MB" });
    }
  }
  res.status(500).json({ error: error.message || "Internal server error" });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

server.timeout = parseInt(process.env.SERVER_TIMEOUT || "1800000");
server.keepAliveTimeout = 65000;
server.headersTimeout = parseInt(process.env.SERVER_TIMEOUT || "1800000");
