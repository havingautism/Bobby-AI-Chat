// 移除database模块，使用tauri-plugin-sql

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_sql::Builder::default().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      ensure_data_directory,
      get_file_size
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
async fn ensure_data_directory() -> Result<(), String> {
  use std::fs;
  use std::path::Path;
  
  // 使用简单的相对路径
  let data_dir = Path::new("./data");
  
  if !data_dir.exists() {
    fs::create_dir_all(data_dir)
      .map_err(|e| format!("创建数据目录失败: {}", e))?;
  }
  
  Ok(())
}

// 移除自定义SQLite命令，使用tauri-plugin-sql

#[tauri::command]
async fn get_file_size(file_path: String) -> Result<u64, String> {
  use std::fs;
  
  let metadata = fs::metadata(&file_path)
    .map_err(|e| format!("获取文件信息失败: {}", e))?;
  
  Ok(metadata.len())
}
