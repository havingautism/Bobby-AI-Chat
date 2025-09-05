// 系统环境检查脚本
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function checkCommand(command, errorMessage) {
  try {
    execSync(`${command} --version`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.log(`❌ ${errorMessage}`);
    return false;
  }
}

function checkFile(filePath, errorMessage) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${errorMessage}`);
    return true;
  } else {
    console.log(`❌ ${errorMessage}`);
    return false;
  }
}

function checkSystemRequirements() {
  console.log('🔍 检查系统环境...\n');
  
  let allGood = true;
  
  // 检查Node.js
  console.log('1. 检查Node.js...');
  if (!checkCommand('node', 'Node.js未安装或不在PATH中')) {
    allGood = false;
  } else {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    console.log(`   版本: ${nodeVersion}`);
  }
  
  // 检查npm
  console.log('\n2. 检查npm...');
  if (!checkCommand('npm', 'npm未安装或不在PATH中')) {
    allGood = false;
  } else {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`   版本: ${npmVersion}`);
  }
  
  // 检查SQLite
  console.log('\n3. 检查SQLite...');
  if (!checkCommand('sqlite3', 'SQLite未安装或不在PATH中')) {
    allGood = false;
  } else {
    const sqliteVersion = execSync('sqlite3 --version', { encoding: 'utf8' }).trim();
    console.log(`   版本: ${sqliteVersion}`);
  }
  
  // 检查Rust
  console.log('\n4. 检查Rust...');
  if (!checkCommand('cargo', 'Rust未安装或不在PATH中')) {
    allGood = false;
  } else {
    const rustVersion = execSync('cargo --version', { encoding: 'utf8' }).trim();
    console.log(`   版本: ${rustVersion}`);
  }
  
  // 检查Tauri CLI
  console.log('\n5. 检查Tauri CLI...');
  try {
    const tauriVersion = execSync('cargo tauri --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Tauri CLI已安装`);
    console.log(`   版本: ${tauriVersion}`);
  } catch (error) {
    console.log('❌ Tauri CLI未安装');
    console.log('   请运行: cargo install tauri-cli');
    allGood = false;
  }
  
  // 检查项目文件
  console.log('\n6. 检查项目文件...');
  checkFile('package.json', 'package.json存在');
  checkFile('src-tauri/Cargo.toml', 'Cargo.toml存在');
  checkFile('src-tauri/src/lib.rs', 'Rust主文件存在');
  checkFile('src/utils/sqliteStorage.js', 'SQLite存储模块存在');
  checkFile('src/utils/knowledgeBase.js', '知识库模块存在');
  
  // 检查node_modules
  console.log('\n7. 检查依赖...');
  if (fs.existsSync('node_modules')) {
    console.log('✅ node_modules存在');
  } else {
    console.log('❌ node_modules不存在，请运行: npm install');
    allGood = false;
  }
  
  // 检查sqlite-extensions目录
  console.log('\n8. 检查sqlite-vec扩展...');
  if (fs.existsSync('sqlite-extensions/sqlite-vec.wasm')) {
    console.log('✅ sqlite-vec扩展已下载');
  } else {
    console.log('⚠️  sqlite-vec扩展未下载（可选）');
    console.log('   可以运行安装脚本下载扩展');
  }
  
  // 总结
  console.log('\n' + '='.repeat(50));
  if (allGood) {
    console.log('🎉 系统环境检查通过！');
    console.log('\n下一步:');
    console.log('1. npm run tauri dev  # 启动开发服务器');
    console.log('2. npm run test:sqlite  # 测试SQLite功能');
  } else {
    console.log('⚠️  系统环境检查未完全通过');
    console.log('\n请解决上述问题后重新运行检查');
    console.log('\n安装指南:');
    console.log('- Windows: 运行 install_sqlite.bat');
    console.log('- Linux/macOS: 运行 ./install_sqlite.sh');
    console.log('- 或参考 SQLITE_INSTALL_GUIDE.md');
  }
  console.log('='.repeat(50));
}

// 运行检查
checkSystemRequirements();
