/**
 * 下载和配置真正的EmbeddingGemma-300m模型
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MODEL_NAME = 'google/embeddinggemma-300m';
const MODEL_DIR = './models/embeddinggemma-300m';

async function downloadEmbeddingGemma() {
  console.log('🎯 开始下载真正的EmbeddingGemma-300m模型...\n');

  try {
    // 1. 创建模型目录
    console.log('📁 创建模型目录...');
    if (!fs.existsSync('./models')) {
      fs.mkdirSync('./models');
    }
    if (!fs.existsSync(MODEL_DIR)) {
      fs.mkdirSync(MODEL_DIR, { recursive: true });
    }
    console.log('✅ 模型目录创建成功\n');

    // 2. 检查是否已安装huggingface-hub
    console.log('🔧 检查Python环境...');
    try {
      execSync('python --version', { stdio: 'pipe' });
      console.log('✅ Python环境可用');
    } catch (error) {
      console.log('❌ Python环境不可用，请先安装Python');
      return;
    }

    // 3. 创建下载脚本
    console.log('📝 创建下载脚本...');
    const downloadScript = `
import os
from huggingface_hub import snapshot_download
import shutil

def download_model():
    print("🎯 开始下载EmbeddingGemma-300m模型...")
    
    # 下载模型文件
    model_path = snapshot_download(
        repo_id="${MODEL_NAME}",
        local_dir="${MODEL_DIR}",
        local_dir_use_symlinks=False
    )
    
    print(f"✅ 模型下载完成: {model_path}")
    
    # 检查下载的文件
    files = os.listdir(model_path)
    print(f"📁 下载的文件: {files}")
    
    # 验证关键文件
    required_files = ['config.json', 'model.safetensors', 'tokenizer.json']
    for file in required_files:
        if file in files:
            print(f"✅ {file} 存在")
        else:
            print(f"❌ {file} 缺失")

if __name__ == "__main__":
    download_model()
`;

    fs.writeFileSync('download_model.py', downloadScript);
    console.log('✅ 下载脚本创建成功\n');

    // 4. 安装依赖
    console.log('📦 安装Python依赖...');
    try {
      execSync('pip install huggingface-hub safetensors', { stdio: 'inherit' });
      console.log('✅ 依赖安装成功\n');
    } catch (error) {
      console.log('⚠️ 依赖安装失败，尝试使用conda...');
      try {
        execSync('conda install -c huggingface huggingface_hub safetensors', { stdio: 'inherit' });
        console.log('✅ Conda依赖安装成功\n');
      } catch (condaError) {
        console.log('❌ 依赖安装失败，请手动安装: pip install huggingface-hub safetensors\n');
        return;
      }
    }

    // 5. 运行下载脚本
    console.log('⬇️ 开始下载模型文件...');
    console.log('⚠️ 注意：模型文件约300MB，下载可能需要几分钟...\n');
    
    execSync('python download_model.py', { stdio: 'inherit' });
    
    console.log('\n🎉 模型下载完成！\n');

    // 6. 创建配置文件
    console.log('⚙️ 创建模型配置文件...');
    const config = {
      model_name: MODEL_NAME,
      model_path: MODEL_DIR,
      dimensions: 768,
      max_tokens: 2048,
      supported_tasks: ['search', 'classification', 'clustering', 'similarity', 'document'],
      download_date: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(MODEL_DIR, 'model_config.json'),
      JSON.stringify(config, null, 2)
    );
    console.log('✅ 配置文件创建成功\n');

    // 7. 清理临时文件
    console.log('🧹 清理临时文件...');
    if (fs.existsSync('download_model.py')) {
      fs.unlinkSync('download_model.py');
    }
    console.log('✅ 清理完成\n');

    console.log('🎯 真正的EmbeddingGemma-300m模型已准备就绪！');
    console.log('📁 模型位置:', MODEL_DIR);
    console.log('📋 下一步：');
    console.log('   1. 重启Tauri应用');
    console.log('   2. 系统将自动检测并使用真正的模型');
    console.log('   3. 享受更强大的语义理解能力！');

  } catch (error) {
    console.error('❌ 下载失败:', error.message);
    console.log('\n🔧 手动下载步骤：');
    console.log('   1. 访问: https://huggingface.co/google/embeddinggemma-300m');
    console.log('   2. 下载以下文件到 ./models/embeddinggemma-300m/ 目录：');
    console.log('      - config.json');
    console.log('      - model.safetensors');
    console.log('      - tokenizer.json');
    console.log('   3. 重启应用');
  }
}

// 运行下载
downloadEmbeddingGemma();
