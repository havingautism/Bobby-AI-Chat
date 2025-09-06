// 测试消息保存和加载
console.log('=== 测试消息保存和加载 ===');

// 模拟对话数据
const testConversation = {
  id: 'test-conversation-' + Date.now(),
  title: '测试对话',
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: '你好，这是一个测试消息',
      timestamp: new Date().toISOString()
    },
    {
      id: 'msg-2', 
      role: 'assistant',
      content: '你好！我收到了你的测试消息。',
      timestamp: new Date().toISOString()
    }
  ],
  lastUpdated: Date.now(),
  createdAt: Date.now()
};

console.log('原始对话数据:', testConversation);

// 测试保存和加载
async function testMessageSaving() {
  try {
    // 动态导入存储适配器
    const { storageAdapter } = await import('./src/utils/storageAdapter.js');
    
    console.log('🔧 测试1: 保存对话...');
    await storageAdapter.saveConversation(testConversation);
    
    console.log('🔧 测试2: 加载对话历史...');
    const conversations = await storageAdapter.loadChatHistory();
    
    console.log('加载的对话数量:', conversations.length);
    
    // 查找我们保存的对话
    const savedConversation = conversations.find(conv => conv.id === testConversation.id);
    
    if (savedConversation) {
      console.log('✅ 找到保存的对话');
      console.log('对话标题:', savedConversation.title);
      console.log('消息数量:', savedConversation.messages.length);
      console.log('消息列表:', savedConversation.messages);
      
      // 验证消息完整性
      const hasUserMessage = savedConversation.messages.some(msg => msg.role === 'user');
      const hasAssistantMessage = savedConversation.messages.some(msg => msg.role === 'assistant');
      
      console.log('📊 消息验证:');
      console.log('- 包含用户消息:', hasUserMessage);
      console.log('- 包含AI回复:', hasAssistantMessage);
      console.log('- 消息总数:', savedConversation.messages.length);
      
      if (hasUserMessage && hasAssistantMessage && savedConversation.messages.length === 2) {
        console.log('🎉 消息保存测试通过！用户消息和AI回复都正确保存了。');
      } else {
        console.log('❌ 消息保存测试失败！消息不完整。');
      }
    } else {
      console.log('❌ 未找到保存的对话');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行测试
testMessageSaving();