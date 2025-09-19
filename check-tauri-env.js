// 检查Tauri环境的脚本
// 在浏览器控制台中运行

function checkTauriEnvironment() {
  console.log('🔍 检查Tauri环境...\n');
  
  // 检查window.__TAURI__是否存在
  if (typeof window.__TAURI__ === 'undefined') {
    console.log('❌ window.__TAURI__ 不存在');
    console.log('💡 请确保在Tauri应用中运行此脚本');
    return;
  }
  
  console.log('✅ window.__TAURI__ 存在');
  console.log('📋 可用的Tauri对象:', Object.keys(window.__TAURI__));
  
  // 检查core对象
  if (window.__TAURI__.core) {
    console.log('✅ window.__TAURI__.core 存在');
    console.log('📋 core对象的方法:', Object.keys(window.__TAURI__.core));
  } else {
    console.log('❌ window.__TAURI__.core 不存在');
  }
  
  // 检查invoke方法
  if (window.__TAURI__.invoke) {
    console.log('✅ window.__TAURI__.invoke 存在');
  } else {
    console.log('❌ window.__TAURI__.invoke 不存在');
  }
  
  // 检查其他可能的API
  const possibleApis = ['core', 'invoke', 'tauri', 'app', 'window', 'fs', 'path'];
  possibleApis.forEach(api => {
    if (window.__TAURI__[api]) {
      console.log(`✅ window.__TAURI__.${api} 存在`);
    } else {
      console.log(`❌ window.__TAURI__.${api} 不存在`);
    }
  });
  
  console.log('\n🔧 尝试不同的调用方式:');
  
  // 尝试方式1
  try {
    if (window.__TAURI__.core && window.__TAURI__.core.invoke) {
      console.log('✅ 方式1: window.__TAURI__.core.invoke 可用');
    }
  } catch (e) {
    console.log('❌ 方式1: window.__TAURI__.core.invoke 不可用');
  }
  
  // 尝试方式2
  try {
    if (window.__TAURI__.invoke) {
      console.log('✅ 方式2: window.__TAURI__.invoke 可用');
    }
  } catch (e) {
    console.log('❌ 方式2: window.__TAURI__.invoke 不可用');
  }
  
  // 尝试方式3 - 检查是否有其他调用方式
  try {
    if (window.__TAURI__.tauri && window.__TAURI__.tauri.invoke) {
      console.log('✅ 方式3: window.__TAURI__.tauri.invoke 可用');
    }
  } catch (e) {
    console.log('❌ 方式3: window.__TAURI__.tauri.invoke 不可用');
  }
  
  console.log('\n💡 建议:');
  console.log('1. 确保在Tauri应用中运行');
  console.log('2. 检查Tauri版本和配置');
  console.log('3. 尝试重新启动应用');
}

// 运行检查
checkTauriEnvironment();
