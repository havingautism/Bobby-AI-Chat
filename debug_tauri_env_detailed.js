// 详细调试Tauri环境检测
console.log('=== 详细调试Tauri环境检测 ===');

// 1. 检查所有可能的Tauri标识
console.log('1. 检查所有Tauri标识:');
console.log('window.__TAURI__:', typeof window.__TAURI__, window.__TAURI__);
console.log('window.__TAURI_IPC__:', typeof window.__TAURI_IPC__, window.__TAURI_IPC__);
console.log('window.__TAURI_INTERNALS__:', typeof window.__TAURI_INTERNALS__, window.__TAURI_INTERNALS__);
console.log('window.__TAURI_METADATA__:', typeof window.__TAURI_METADATA__, window.__TAURI_METADATA__);

// 2. 检查navigator.userAgent
console.log('2. 检查navigator.userAgent:');
console.log('userAgent:', navigator.userAgent);
console.log('包含Tauri:', navigator.userAgent.includes('Tauri'));

// 3. 检查所有包含TAURI的全局变量
console.log('3. 检查所有包含TAURI的全局变量:');
const tauriKeys = Object.keys(window).filter(key => key.includes('TAURI'));
console.log('TAURI相关键:', tauriKeys);

// 4. 测试不同的检测方法
console.log('4. 测试不同的检测方法:');

// 方法1: 当前使用的方法
const method1 = Boolean(
  typeof window !== 'undefined' &&
    window !== undefined &&
    window.__TAURI_IPC__ !== undefined
);
console.log('方法1 (当前):', method1);

// 方法2: 检查__TAURI__
const method2 = Boolean(
  typeof window !== 'undefined' &&
    window !== undefined &&
    window.__TAURI__ !== undefined
);
console.log('方法2 (__TAURI__):', method2);

// 方法3: 检查__TAURI_INTERNALS__
const method3 = Boolean(
  typeof window !== 'undefined' &&
    window !== undefined &&
    window.__TAURI_INTERNALS__ !== undefined
);
console.log('方法3 (__TAURI_INTERNALS__):', method3);

// 方法4: 检查__TAURI_METADATA__
const method4 = Boolean(
  typeof window !== 'undefined' &&
    window !== undefined &&
    window.__TAURI_METADATA__ !== undefined
);
console.log('方法4 (__TAURI_METADATA__):', method4);

// 方法5: 检查userAgent
const method5 = Boolean(
  typeof window !== 'undefined' &&
    window !== undefined &&
    navigator.userAgent.includes('Tauri')
);
console.log('方法5 (userAgent):', method5);

// 方法6: 检查任何TAURI键
const method6 = Boolean(
  typeof window !== 'undefined' &&
    window !== undefined &&
    Object.keys(window).some(key => key.includes('TAURI'))
);
console.log('方法6 (任何TAURI键):', method6);

// 5. 推荐的最佳方法
const bestMethod = Boolean(
  typeof window !== 'undefined' &&
    window !== undefined &&
    (window.__TAURI__ !== undefined || 
     window.__TAURI_IPC__ !== undefined ||
     window.__TAURI_INTERNALS__ !== undefined ||
     window.__TAURI_METADATA__ !== undefined ||
     navigator.userAgent.includes('Tauri') ||
     Object.keys(window).some(key => key.includes('TAURI')))
);
console.log('推荐方法 (综合):', bestMethod);

console.log('=== 调试完成 ===');

