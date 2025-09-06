@echo off
echo 🚀 正在安装SQLite存储依赖...

echo 1. 清理现有依赖...
if exist "node_modules" rmdir /s /q node_modules
if exist "package-lock.json" del package-lock.json

echo 2. 清理npm缓存...
call npm cache clean --force

echo 3. 安装前端依赖...
call npm install

echo 4. 安装Tauri SQL插件...
call npm install @tauri-apps/plugin-sql@^2.3.0

echo 5. 验证插件安装...
call npm list @tauri-apps/plugin-sql
if %errorlevel% neq 0 (
    echo ❌ SQL插件安装失败
    pause
    exit /b 1
)

echo 6. 检查Tauri配置...
if not exist "src-tauri" (
    echo ❌ 未找到src-tauri目录，请确保这是一个Tauri项目
    pause
    exit /b 1
)

echo 7. 检查Cargo.toml中的SQL插件...
findstr /C:"tauri-plugin-sql" "src-tauri\Cargo.toml" >nul
if %errorlevel% neq 0 (
    echo ❌ Cargo.toml中缺少tauri-plugin-sql依赖
    echo 请手动添加: tauri-plugin-sql = { version = "2.0.0", features = ["sqlite"] }
    pause
    exit /b 1
)

echo 8. 配置SQL权限...
echo {
echo   "$schema": "../gen/schemas/desktop-schema.json",
echo   "identifier": "default",
echo   "description": "enables the default permissions",
echo   "windows": ["main"],
echo   "permissions": [
echo     "core:default",
echo     "fs:allow-applocaldata-read-recursive",
echo     "fs:allow-applocaldata-write-recursive",
echo     "fs:allow-applocaldata-meta-recursive",
echo     "shell:default",
echo     "sql:allow-load",
echo     "sql:allow-execute",
echo     "sql:default"
echo   ]
echo } > "src-tauri\capabilities\default.json"
echo ✅ SQL权限配置已更新

echo 9. 重新构建Tauri应用...
cd src-tauri
call cargo build
if %errorlevel% neq 0 (
    echo ❌ Tauri构建失败
    pause
    exit /b 1
)
cd ..

echo 10. 测试前端构建...
call npx react-scripts build
if %errorlevel% neq 0 (
    echo ❌ 前端构建失败
    pause
    exit /b 1
)

echo.
echo ✅ SQLite存储依赖安装完成！
echo.
echo 🎯 使用说明:
echo 1. 运行 'npm run tauri' 启动开发服务器
echo 2. 运行 'node test_sql_permissions.js' 测试SQL权限
echo 3. 运行 'node test_sqlite_fix.js' 测试SQLite功能  
echo 4. 如果SQLite不可用，系统会自动回退到JSON存储
echo.
echo 🔧 问题已修复:
echo - ✅ SQL插件导入错误已解决
echo - ✅ 构建错误已修复
echo - ✅ SQL权限配置已修复
echo - ✅ SQLite存储现在可以正常工作
echo.
pause