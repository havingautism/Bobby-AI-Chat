// 数据库迁移脚本 - 修复sqlite-vec向量表配置

use anyhow::Result;
use sqlx::Pool;
use sqlx::Sqlite;

pub async fn migrate_vector_table(pool: &Pool<Sqlite>) -> Result<()> {
    println!("🔄 开始迁移向量表以支持正确的余弦距离...");
    
    // 检查当前表结构
    let table_info = sqlx::query("PRAGMA table_info(knowledge_vectors)")
        .fetch_all(pool)
        .await?;
    
    println!("📋 当前向量表结构:");
    for row in table_info {
        let name: String = row.get(1);
        let type_: String = row.get(2);
        println!("   - {}: {}", name, type_);
    }
    
    // 备份现有数据
    println!("💾 备份现有向量数据...");
    let backup_data = sqlx::query("SELECT * FROM knowledge_vectors")
        .fetch_all(pool)
        .await?;
    
    println!("📊 备份了 {} 条向量记录", backup_data.len());
    
    // 删除旧的向量表
    println!("🗑️ 删除旧的向量表...");
    sqlx::query("DROP TABLE IF EXISTS knowledge_vectors")
        .execute(pool)
        .await?;
    
    // 创建新的向量表（使用正确的余弦距离配置）
    println!("🏗️ 创建新的向量表（支持余弦距离）...");
    sqlx::query(
        "CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vectors USING vec0(
            embedding float[1024],
            chunk_id TEXT,
            collection_id TEXT,
            created_at INTEGER,
            distance=cosine
        )"
    )
    .execute(pool)
    .await?;
    
    // 恢复数据
    if !backup_data.is_empty() {
        println!("🔄 恢复向量数据...");
        
        for (i, row) in backup_data.iter().enumerate() {
            let embedding: Vec<u8> = row.get(0);
            let chunk_id: String = row.get(1);
            let collection_id: String = row.get(2);
            let created_at: i64 = row.get(3);
            
            sqlx::query(
                "INSERT INTO knowledge_vectors (embedding, chunk_id, collection_id, created_at) 
                 VALUES (?, ?, ?, ?)"
            )
            .bind(&embedding)
            .bind(&chunk_id)
            .bind(&collection_id)
            .bind(created_at)
            .execute(pool)
            .await?;
            
            if (i + 1) % 100 == 0 {
                println!("   - 已恢复 {} / {} 条记录", i + 1, backup_data.len());
            }
        }
        
        println!("✅ 成功恢复 {} 条向量记录", backup_data.len());
    }
    
    // 验证新表结构
    println!("🔍 验证新表结构...");
    let new_table_info = sqlx::query("PRAGMA table_info(knowledge_vectors)")
        .fetch_all(pool)
        .await?;
    
    println!("📋 新向量表结构:");
    for row in new_table_info {
        let name: String = row.get(1);
        let type_: String = row.get(2);
        println!("   - {}: {}", name, type_);
    }
    
    // 测试余弦距离函数
    println!("🧪 测试余弦距离函数...");
    match sqlx::query("SELECT vec_distance_cosine(embedding, embedding) FROM knowledge_vectors LIMIT 1")
        .fetch_one(pool)
        .await
    {
        Ok(row) => {
            let distance: f64 = row.get(0);
            println!("✅ 余弦距离函数测试成功，距离: {:.6}", distance);
        }
        Err(e) => {
            println!("❌ 余弦距离函数测试失败: {}", e);
            return Err(anyhow::anyhow!("余弦距离函数不可用: {}", e));
        }
    }
    
    println!("🎉 向量表迁移完成！");
    println!("💡 现在使用正确的余弦距离进行向量搜索");
    
    Ok(())
}

// 检查是否需要迁移
pub async fn check_migration_needed(pool: &Pool<Sqlite>) -> Result<bool> {
    // 检查表是否存在
    let table_exists = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_vectors'")
        .fetch_optional(pool)
        .await?;
    
    if table_exists.is_none() {
        return Ok(false); // 表不存在，不需要迁移
    }
    
    // 检查是否支持余弦距离函数
    match sqlx::query("SELECT vec_distance_cosine(embedding, embedding) FROM knowledge_vectors LIMIT 1")
        .fetch_optional(pool)
        .await
    {
        Ok(Some(_)) => {
            println!("✅ 向量表已支持余弦距离，无需迁移");
            Ok(false)
        }
        Ok(None) => {
            println!("⚠️ 向量表为空，但支持余弦距离，无需迁移");
            Ok(false)
        }
        Err(_) => {
            println!("🔄 向量表需要迁移以支持余弦距离");
            Ok(true)
        }
    }
}
