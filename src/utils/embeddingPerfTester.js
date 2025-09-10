import embeddingService from './embeddingService.js';

/**
 * 运行一个长文本嵌入的端到端测试（走真实后端模型）
 * 用法（在 DevTools Console 中）：
 *   await window.runEmbeddingPerfTest({ repeats: 200, model: 'all-MiniLM-L6-v2' })
 * 参数：
 * - paragraph: 基础段落（默认一段中文示例）
 * - repeats:   重复次数，决定长文本总长度（默认 200 次）
 * - model:     模型名（'all-MiniLM-L6-v2'）
 * - chunkSize: 分块大小（默认 500）
 * - overlap:   分块重叠（默认 50）
 */
export async function runEmbeddingPerfTest({
  paragraph = '这是一个用于性能与正确性测试的示例段落。模型需要处理较长文本，因此我们会重复该段落来模拟长文场景。',
  repeats = 200,
  model = 'all-MiniLM-L6-v2',
  chunkSize = 500,
  overlap = 50,
} = {}) {
  const content = Array.from({ length: repeats }).map(() => paragraph).join('\n');
  console.log(`🔧 生成测试文本: 长度=${content.length} 字符, repeats=${repeats}`);

  const t0 = performance.now();
  try {
    // 直接走文档嵌入路径（内部会调用 Rust 后端批量接口）
    const embeddings = await embeddingService.generateDocumentEmbeddings(content, chunkSize, overlap);
    const t1 = performance.now();

    const dims = embeddings[0]?.embedding?.length || 0;
    console.log('✅ 嵌入完成');
    console.table({
      chars: content.length,
      chunksReturned: embeddings.length,
      dimensions: dims,
      timeMs: Math.round(t1 - t0),
      avgMsPerChunk: embeddings.length ? Math.round((t1 - t0) / embeddings.length) : 0,
      model,
    });

    // 打印前 1-2 个向量的前 8 维，便于确认真实输出
    embeddings.slice(0, 2).forEach((e, i) => {
      const snippet = (e.embedding || []).slice(0, 8);
      console.log(`向量示例[${i}] (前8维):`, snippet);
    });

    // 返回原始结果，方便进一步检查
    return embeddings;
  } catch (err) {
    console.error('❌ 嵌入测试失败:', err);
    throw err;
  }
}

// 在窗口环境下暴露，便于控制台直接调用
if (typeof window !== 'undefined') {
  window.runEmbeddingPerfTest = runEmbeddingPerfTest;
}


