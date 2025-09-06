// 简单检查数据库路径
const fs = require('fs');
const path = require('path');
const os = require('os');

function checkDbPath() {
  console.log('🔍 检查数据库路径...');
  
  // 1. 检查项目根目录
  const projectRoot = process.cwd();
  console.log('📁 项目根目录:', projectRoot);
  
  // 2. 检查开发模式路径
  const devDbPath = path.join(projectRoot, 'data', 'ai_chat.db');
  console.log('📁 开发模式数据库路径:', devDbPath);
  
  // 3. 检查生产模式路径
  const homeDir = os.homedir();
  let prodDbPath;
  
  if (process.platform === 'win32') {
    prodDbPath = path.join(homeDir, 'AppData', 'Local', 'AI-Chat', 'ai_chat.db');
  } else if (process.platform === 'darwin') {
    prodDbPath = path.join(homeDir, 'Library', 'Application Support', 'AI-Chat', 'ai_chat.db');
  } else {
    prodDbPath = path.join(homeDir, '.local', 'share', 'AI-Chat', 'ai_chat.db');
  }
  
  console.log('📁 生产模式数据库路径:', prodDbPath);
  
  // 4. 检查文件是否存在
  console.log('\n📊 文件存在性检查:');
  
  if (fs.existsSync(devDbPath)) {
    const stats = fs.statSync(devDbPath);
    console.log('✅ 开发模式数据库存在:', devDbPath);
    console.log('   📊 文件大小:', stats.size, 'bytes');
    console.log('   📅 创建时间:', stats.birthtime.toLocaleString());
    console.log('   📅 修改时间:', stats.mtime.toLocaleString());
  } else {
    console.log('❌ 开发模式数据库不存在:', devDbPath);
  }
  
  if (fs.existsSync(prodDbPath)) {
    const stats = fs.statSync(prodDbPath);
    console.log('✅ 生产模式数据库存在:', prodDbPath);
    console.log('   📊 文件大小:', stats.size, 'bytes');
    console.log('   📅 创建时间:', stats.birthtime.toLocaleString());
    console.log('   📅 修改时间:', stats.mtime.toLocaleString());
  } else {
    console.log('❌ 生产模式数据库不存在:', prodDbPath);
  }
  
  // 5. 检查项目根目录下的所有.db文件
  console.log('\n🔍 搜索项目根目录下的所有.db文件:');
  try {
    const files = fs.readdirSync(projectRoot);
    const dbFiles = files.filter(file => file.endsWith('.db'));
    
    if (dbFiles.length > 0) {
      console.log('✅ 找到数据库文件:');
      dbFiles.forEach(file => {
        const filePath = path.join(projectRoot, file);
        const stats = fs.statSync(filePath);
        console.log(`   📄 ${file} (${stats.size} bytes)`);
      });
    } else {
      console.log('❌ 项目根目录下没有找到.db文件');
    }
  } catch (error) {
    console.log('❌ 无法读取项目根目录:', error.message);
  }
  
  // 6. 检查data目录
  const dataDir = path.join(projectRoot, 'data');
  console.log('\n📁 检查data目录:');
  
  if (fs.existsSync(dataDir)) {
    console.log('✅ data目录存在:', dataDir);
    try {
      const files = fs.readdirSync(dataDir);
      console.log('   📄 目录内容:', files);
    } catch (error) {
      console.log('   ❌ 无法读取data目录:', error.message);
    }
  } else {
    console.log('❌ data目录不存在:', dataDir);
  }
}

// 运行检查
checkDbPath();
