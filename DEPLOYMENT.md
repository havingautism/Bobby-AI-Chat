# 🚀 部署指南

## 📦 构建应用

### 本地构建
```bash
# 安装依赖
npm install

# 构建生产版本
npm run build

# 构建完成后，build目录包含可部署的静态文件
```

## 🌐 部署到静态托管平台

### 1. Vercel（推荐）

#### 方法一：通过Git仓库
1. 将代码推送到GitHub/GitLab
2. 访问 [vercel.com](https://vercel.com)
3. 导入您的仓库
4. Vercel会自动检测React项目并部署

#### 方法二：通过CLI
```bash
# 安装Vercel CLI
npm i -g vercel

# 在项目根目录运行
vercel

# 按提示完成部署
```

### 2. Netlify

#### 方法一：拖拽部署
1. 运行 `npm run build`
2. 访问 [netlify.com](https://netlify.com)
3. 将build文件夹拖拽到部署区域

#### 方法二：Git集成
1. 将代码推送到GitHub
2. 在Netlify中连接仓库
3. 设置构建命令：`npm run build`
4. 设置发布目录：`build`

### 3. GitHub Pages

```bash
# 安装gh-pages
npm install --save-dev gh-pages

# 在package.json中添加homepage字段
"homepage": "https://yourusername.github.io/your-repo-name"

# 添加部署脚本
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d build"
}

# 部署
npm run deploy
```

### 4. 阿里云OSS

1. 创建OSS存储桶
2. 开启静态网站托管
3. 上传build目录中的所有文件
4. 配置默认首页为index.html

## 🔧 环境变量配置

### 开发环境
创建 `.env.local` 文件：
```env
REACT_APP_API_BASE_URL=https://api.siliconflow.cn/v1/chat/completions
REACT_APP_API_KEY=your-api-key-here
REACT_APP_MODEL=deepseek-ai/DeepSeek-V3
```

### 生产环境

#### Vercel
在项目设置中添加环境变量：
- `REACT_APP_API_BASE_URL`
- `REACT_APP_API_KEY`
- `REACT_APP_MODEL`

#### Netlify
在Site settings > Environment variables中添加相同变量

## 🛡️ 安全配置

### API密钥保护
- 永远不要在代码中硬编码API密钥
- 使用环境变量存储敏感信息
- 在生产环境中设置适当的CORS策略

### HTTPS配置
- 大多数现代托管平台默认提供HTTPS
- 确保API调用使用HTTPS协议
- 配置安全头部（CSP、HSTS等）

## 📊 性能优化

### 构建优化
```bash
# 分析构建包大小
npm install --save-dev webpack-bundle-analyzer
npm run build
npx webpack-bundle-analyzer build/static/js/*.js
```

### CDN配置
- 使用CDN加速静态资源
- 配置适当的缓存策略
- 启用Gzip压缩

## 🔍 监控和分析

### 错误监控
推荐集成：
- Sentry（错误追踪）
- LogRocket（用户会话录制）
- Google Analytics（用户行为分析）

### 性能监控
- Web Vitals
- Lighthouse CI
- 实时用户监控（RUM）

## 🚀 CI/CD配置

### GitHub Actions示例
```yaml
name: Deploy to Vercel

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    - name: Install dependencies
      run: npm ci
    - name: Build
      run: npm run build
    - name: Deploy to Vercel
      uses: vercel/action@v20
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.ORG_ID }}
        vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## 🐛 常见部署问题

### 路由问题
单页应用需要配置路由回退：
- Vercel：已在vercel.json中配置
- Netlify：创建_redirects文件：`/* /index.html 200`
- Apache：配置.htaccess文件

### 环境变量未生效
- 确保变量名以REACT_APP_开头
- 重新构建应用
- 检查平台环境变量设置

### API跨域问题
- 确保API服务器配置了正确的CORS
- 考虑使用代理服务器
- 检查API密钥权限

## 📝 部署检查清单

- [ ] 代码已推送到Git仓库
- [ ] 环境变量已正确配置
- [ ] 构建过程无错误
- [ ] 静态资源路径正确
- [ ] API连接测试通过
- [ ] 移动端适配正常
- [ ] HTTPS证书有效
- [ ] 性能指标达标
- [ ] 错误监控已配置
- [ ] 备份策略已制定

## 🎯 部署后验证

1. **功能测试**
   - 基础聊天功能
   - 多对话管理
   - 搜索功能
   - 设置面板

2. **性能测试**
   - 页面加载速度
   - API响应时间
   - 移动端体验

3. **兼容性测试**
   - 不同浏览器
   - 不同设备尺寸
   - 不同网络环境

---

**部署成功后，您的ChatGPT克隆应用就可以为用户提供服务了！** 🎉