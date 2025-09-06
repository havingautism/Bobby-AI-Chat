use std::process::{Command, Stdio, Child};
use std::path::PathBuf;
use std::fs;
use std::thread;
use std::time::Duration;
use reqwest;
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize)]
pub struct QdrantInfo {
    pub version: String,
    pub download_url: String,
    pub filename: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QdrantStatus {
    pub is_running: bool,
    pub pid: Option<u32>,
    pub port: u16,
    pub version: Option<String>,
    pub data_path: String,
}

pub struct QdrantManager {
    qdrant_process: Option<Child>,
    qdrant_path: PathBuf,
    data_path: PathBuf,
    port: u16,
    is_initialized: bool,
}

impl QdrantManager {
    pub fn new() -> Self {
        // 将数据目录放在项目根目录，避免Tauri监控
        let mut data_path = std::env::current_dir().unwrap();
        data_path.push(".."); // 向上一级到项目根目录
        data_path.push("qdrant_data");
        
        // 使用项目根目录下的编译二进制文件（从src-tauri目录向上一级）
        let mut qdrant_path = std::env::current_dir().unwrap();
        qdrant_path.push(".."); // 向上一级到项目根目录
        if cfg!(target_os = "windows") {
            qdrant_path.push("qdrant.exe");
        } else {
            qdrant_path.push("qdrant");
        }
        
        Self {
            qdrant_process: None,
            qdrant_path,
            data_path,
            port: 6333,
            is_initialized: false,
        }
    }

    /// 获取Qdrant最新版本信息
    pub async fn get_latest_version() -> Result<QdrantInfo, String> {
        let client = reqwest::Client::new();
        let response = client
            .get("https://api.github.com/repos/qdrant/qdrant/releases/latest")
            .header("User-Agent", "Tauri-App")
            .send()
            .await
            .map_err(|e| format!("获取版本信息失败: {}", e))?;

        let release: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("解析版本信息失败: {}", e))?;

        let version = release["tag_name"]
            .as_str()
            .ok_or("无法获取版本号")?
            .trim_start_matches('v')
            .to_string();

        // 根据操作系统选择下载文件
        let (filename, download_url) = if cfg!(target_os = "windows") {
            let filename = format!("qdrant-x86_64-pc-windows-msvc.zip");
            let download_url = format!(
                "https://github.com/qdrant/qdrant/releases/download/v{}/{}",
                version, filename
            );
            (filename, download_url)
        } else if cfg!(target_os = "linux") {
            let filename = format!("qdrant-x86_64-unknown-linux-gnu.tar.gz");
            let download_url = format!(
                "https://github.com/qdrant/qdrant/releases/download/v{}/{}",
                version, filename
            );
            (filename, download_url)
        } else if cfg!(target_os = "macos") {
            let filename = format!("qdrant-x86_64-apple-darwin.tar.gz");
            let download_url = format!(
                "https://github.com/qdrant/qdrant/releases/download/v{}/{}",
                version, filename
            );
            (filename, download_url)
        } else {
            return Err("不支持的操作系统".to_string());
        };

        Ok(QdrantInfo {
            version,
            download_url,
            filename,
        })
    }

    /// 下载Qdrant二进制文件
    pub async fn download_qdrant() -> Result<String, String> {
        let info = Self::get_latest_version().await?;
        
        println!("正在下载Qdrant v{}...", info.version);
        
        let client = reqwest::Client::new();
        let response = client
            .get(&info.download_url)
            .send()
            .await
            .map_err(|e| format!("下载失败: {}", e))?;

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("读取下载内容失败: {}", e))?;

        // 保存到临时文件
        let temp_path = std::env::temp_dir().join(&info.filename);
        fs::write(&temp_path, bytes)
            .map_err(|e| format!("保存文件失败: {}", e))?;

        println!("下载完成: {}", temp_path.display());
        Ok(temp_path.to_string_lossy().to_string())
    }

    /// 从源代码编译Qdrant
    pub async fn compile_qdrant() -> Result<String, String> {
        println!("🔨 开始从源代码编译Qdrant...");
        
        // 检查Rust是否安装
        let rust_check = Command::new("cargo")
            .arg("--version")
            .output();
        
        if rust_check.is_err() {
            return Err("Rust未安装，请先安装Rust: https://rustup.rs/".to_string());
        }
        
        // 创建qdrant源码目录
        let mut qdrant_src_dir = std::env::current_dir().unwrap();
        qdrant_src_dir.push("qdrant_src");
        
        // 克隆或更新Qdrant仓库
        if !qdrant_src_dir.exists() {
            println!("📥 克隆Qdrant仓库...");
            let clone_result = Command::new("git")
                .args(&["clone", "https://github.com/qdrant/qdrant.git", "qdrant_src"])
                .output()
                .map_err(|e| format!("克隆仓库失败: {}", e))?;
            
            if !clone_result.status.success() {
                return Err("克隆Qdrant仓库失败".to_string());
            }
        } else {
            println!("📥 更新Qdrant仓库...");
            let update_result = Command::new("git")
                .args(&["pull"])
                .current_dir(&qdrant_src_dir)
                .output()
                .map_err(|e| format!("更新仓库失败: {}", e))?;
            
            if !update_result.status.success() {
                return Err("更新Qdrant仓库失败".to_string());
            }
        }
        
        // 编译Qdrant
        println!("🔨 编译Qdrant...");
        let compile_result = Command::new("cargo")
            .args(&["build", "--release", "--bin", "qdrant"])
            .current_dir(&qdrant_src_dir)
            .output()
            .map_err(|e| format!("编译失败: {}", e))?;
        
        if !compile_result.status.success() {
            let error_output = String::from_utf8_lossy(&compile_result.stderr);
            return Err(format!("编译失败: {}", error_output));
        }
        
        // 复制二进制文件到项目根目录
        let mut source_binary = qdrant_src_dir.clone();
        source_binary.push("target");
        source_binary.push("release");
        
        let mut target_binary = std::env::current_dir().unwrap();
        
        if cfg!(target_os = "windows") {
            source_binary.push("qdrant.exe");
            target_binary.push("qdrant.exe");
        } else {
            source_binary.push("qdrant");
            target_binary.push("qdrant");
        }
        
        if !source_binary.exists() {
            return Err("编译后的二进制文件不存在".to_string());
        }
        
        // 复制文件
        fs::copy(&source_binary, &target_binary)
            .map_err(|e| format!("复制二进制文件失败: {}", e))?;
        
        // 设置执行权限（Linux/Mac）
        #[cfg(not(target_os = "windows"))]
        {
            Command::new("chmod")
                .args(&["+x", &target_binary.to_string_lossy()])
                .output()
                .map_err(|e| format!("设置执行权限失败: {}", e))?;
        }
        
        println!("✅ Qdrant编译完成: {}", target_binary.display());
        Ok(target_binary.to_string_lossy().to_string())
    }

    /// 检查Qdrant是否已安装（编译的二进制文件）
    pub fn is_installed(&self) -> bool {
        self.qdrant_path.exists()
    }

    /// 启动Qdrant服务
    pub fn start(&mut self) -> Result<(), String> {
        if self.qdrant_process.is_some() {
            return Ok(()); // 已经在运行
        }

        // 确保Qdrant已安装
        if !self.is_installed() {
            return Err("Qdrant未安装，请先安装".to_string());
        }

        // 创建数据目录
        fs::create_dir_all(&self.data_path)
            .map_err(|e| format!("创建数据目录失败: {}", e))?;

        println!("启动Qdrant服务: {}", self.qdrant_path.display());

        // 启动Qdrant进程
        let child = Command::new(&self.qdrant_path)
            .env("QDRANT__SERVICE__HTTP_PORT", &self.port.to_string())
            .env("QDRANT__SERVICE__HOST", "127.0.0.1")
            .env("QDRANT__STORAGE__STORAGE_PATH", self.data_path.to_string_lossy().to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("启动Qdrant失败: {}", e))?;

        self.qdrant_process = Some(child);
        self.is_initialized = true;

        // 等待服务启动
        thread::sleep(Duration::from_secs(3));

        // 检查服务是否正常运行
        if self.is_running() {
            println!("✅ Qdrant服务启动成功，端口: {}", self.port);
            Ok(())
        } else {
            Err("Qdrant服务启动失败".to_string())
        }
    }

    /// 停止Qdrant服务
    pub fn stop(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.qdrant_process.take() {
            child.kill().map_err(|e| format!("停止Qdrant失败: {}", e))?;
            child.wait().map_err(|e| format!("等待Qdrant退出失败: {}", e))?;
            println!("✅ Qdrant服务已停止");
        }
        Ok(())
    }

    /// 检查Qdrant是否正在运行
    pub fn is_running(&self) -> bool {
        // 尝试连接到Qdrant API
        let client = reqwest::blocking::Client::new();
        let response = client
            .get(&format!("http://127.0.0.1:{}/health", self.port))
            .timeout(Duration::from_secs(2))
            .send();
        
        response.is_ok()
    }

    /// 获取Qdrant状态
    pub fn get_status(&self) -> QdrantStatus {
        let is_running = self.is_running();
        let pid = if let Some(ref child) = self.qdrant_process {
            Some(child.id())
        } else {
            None
        };

        QdrantStatus {
            is_running,
            pid,
            port: self.port,
            version: None, // 可以添加版本检测逻辑
            data_path: self.data_path.to_string_lossy().to_string(),
        }
    }

    /// 获取Qdrant版本
    pub fn get_version(&self) -> Result<String, String> {
        if !self.is_installed() {
            return Err("Qdrant未安装".to_string());
        }

        let output = Command::new(&self.qdrant_path)
            .arg("--version")
            .output()
            .map_err(|e| format!("获取版本失败: {}", e))?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout);
            Ok(version.trim().to_string())
        } else {
            Err("获取版本失败".to_string())
        }
    }
}

impl Drop for QdrantManager {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

// Tauri命令：编译Qdrant
#[tauri::command]
pub async fn compile_qdrant() -> Result<String, String> {
    QdrantManager::compile_qdrant().await
}

// Tauri命令：启动Qdrant
#[tauri::command]
pub async fn start_qdrant(
    manager: State<'_, Mutex<QdrantManager>>,
) -> Result<String, String> {
    let mut manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.start()?;
    Ok("Qdrant服务启动成功".to_string())
}

// Tauri命令：停止Qdrant
#[tauri::command]
pub async fn stop_qdrant(
    manager: State<'_, Mutex<QdrantManager>>,
) -> Result<String, String> {
    let mut manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.stop()?;
    Ok("Qdrant服务已停止".to_string())
}

// Tauri命令：获取Qdrant状态
#[tauri::command]
pub async fn get_qdrant_status(
    manager: State<'_, Mutex<QdrantManager>>,
) -> Result<QdrantStatus, String> {
    let manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(manager.get_status())
}

// Tauri命令：检查Qdrant是否已安装
#[tauri::command]
pub async fn is_qdrant_installed(
    manager: State<'_, Mutex<QdrantManager>>,
) -> Result<bool, String> {
    let manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(manager.is_installed())
}

// Tauri命令：获取Qdrant版本
#[tauri::command]
pub async fn get_qdrant_version(
    manager: State<'_, Mutex<QdrantManager>>,
) -> Result<String, String> {
    let manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.get_version()
}