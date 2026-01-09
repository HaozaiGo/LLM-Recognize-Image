/**
 * API 配置
 * 
 * 问题说明：
 * 使用 `expo start --tunnel` 时，手机通过隧道连接 Expo 开发服务器，
 * 但后端 API 仍使用本地 IP，可能导致手机无法访问后端。
 * 
 * 解决方案：
 * 1. 不使用 tunnel：使用 `expo start` 或 `expo start --lan`，确保手机和电脑在同一 WiFi
 * 2. 为后端创建隧道：使用 ngrok (ngrok http 3000) 为后端创建公网隧道，然后更新下面的 URL
 * 3. 使用环境变量：设置 EXPO_PUBLIC_API_URL 环境变量来覆盖
 */

// 可以通过环境变量覆盖
const API_URL_ENV = process.env.EXPO_PUBLIC_API_URL;

// 开发环境 - 改为你的电脑本地 IP 地址
// 注意：使用 tunnel 模式时，如果你的后端不在公网，手机无法访问这个 IP
// 此时你需要：
// - 方案1: 不使用 tunnel，确保手机和电脑在同一 WiFi 网络（推荐用于开发）
// - 方案2: 为后端创建隧道（如使用 ngrok: ngrok http 3000），然后使用隧道地址
const DEV_API_URL = 'http://10.121.9.26:3000/api';

// 生产环境 API URL
const PROD_API_URL = 'https://your-backend-domain.com/api';

// 导出配置
export const API_URL = API_URL_ENV || (__DEV__ ? DEV_API_URL : PROD_API_URL);

