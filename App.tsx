
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, MindMapState } from './types';
import { generateMindMap, expandNode, analyzeMap } from './services/geminiService';
import MindMapCanvas from './components/MindMapCanvas';
import AndroidCodeView from './components/AndroidCodeView';

const STORAGE_KEY = 'gemini_mind_map_data_v4';

const DEFAULT_MIND_MAP: Card = {
  id: 'root-001',
  message: '总公司 (Level 1)',
  children: [
    {
      id: 'node-1',
      message: '研发部 (Level 2)',
      children: [
        { id: 'node-1-1', message: '后端组 (Level 3)', children: [] },
        { id: 'node-1-2', message: '前端组 (Level 3)', children: [] }
      ]
    },
    {
      id: 'node-2',
      message: '市场部 (Level 2)',
      children: [
        { id: 'node-2-1', message: '线上渠道 (Level 3)', children: [] },
        { id: 'node-2-2', message: '线下活动 (Level 3)', children: [] }
      ]
    }
  ]
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'visual' | 'android' | 'json'>('visual');
  const [state, setState] = useState<MindMapState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return {
      root: saved ? JSON.parse(saved) : DEFAULT_MIND_MAP,
      loading: false,
      error: null,
    };
  });
  
  const [input, setInput] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: '您好！我可以帮您分析当前的思维导图结构，或提供扩展建议。' }
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // 新增节点模态框状态
  const [addNodeModal, setAddNodeModal] = useState<{ isOpen: boolean; parentId: string; parentMsg: string; tempMsg: string }>({
    isOpen: false,
    parentId: '',
    parentMsg: '',
    tempMsg: '新节点'
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.root) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.root));
  }, [state.root]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const findAndModifyNode = useCallback((node: Card | null, id: string, modifier: (node: Card) => Card | null): Card | null => {
    if (!node) return null;
    if (node.id === id) return modifier(node);
    
    const newChildren = (node.children || [])
      .map(child => findAndModifyNode(child, id, modifier))
      .filter((c): c is Card => c !== null);

    return { ...node, children: newChildren };
  }, []);

  const performGeneration = async (topic: string) => {
    if (!topic.trim()) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    setActiveTab('visual');
    try {
      const mindMap = await generateMindMap(topic);
      setState({ root: mindMap, loading: false, error: null });
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: "AI 生成失败。" }));
    }
  };

  const handleExpand = useCallback(async (id: string, message: string) => {
    setState(prev => ({
      ...prev,
      root: findAndModifyNode(prev.root, id, (node) => ({ ...node, isExpanding: true }))
    }));

    try {
      if (!state.root) return;
      const fullTreeText = JSON.stringify(state.root);
      const newChildren = await expandNode(message, state.root.message, fullTreeText);
      
      setState(next => ({
        ...next,
        root: findAndModifyNode(next.root, id, (node) => ({
          ...node,
          isExpanding: false,
          children: [...node.children, ...newChildren]
        }))
      }));
    } catch (err) {
      setState(next => ({
        ...next,
        root: findAndModifyNode(next.root, id, (node) => ({ ...node, isExpanding: false })),
        error: "扩展节点失败。"
      }));
    }
  }, [findAndModifyNode, state.root]);

  const openAddModal = (id: string) => {
    // 找到父节点的名称
    let parentMsg = "Parent";
    const findMsg = (node: Card) => {
      if (node.id === id) { parentMsg = node.message; return; }
      node.children.forEach(findMsg);
    };
    if (state.root) findMsg(state.root);
    
    setAddNodeModal({ isOpen: true, parentId: id, parentMsg, tempMsg: '新子部门' });
  };

  const confirmAddManual = () => {
    const { parentId, tempMsg } = addNodeModal;
    if (!tempMsg) return;

    const newNode: Card = {
      id: `m-${Date.now()}`,
      message: tempMsg,
      children: []
    };

    setState(prev => ({
      ...prev,
      root: findAndModifyNode(prev.root, parentId, (node) => ({
        ...node,
        children: [...node.children, newNode]
      }))
    }));
    setAddNodeModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleDelete = useCallback((id: string) => {
    setState(prev => {
      if (!prev.root) return prev;
      if (prev.root.id === id) return { ...prev, root: null };
      return { ...prev, root: findAndModifyNode(prev.root, id, () => null) };
    });
  }, [findAndModifyNode]);

  const handleEdit = useCallback((id: string, msg: string) => {
    setState(prev => ({
      ...prev,
      root: findAndModifyNode(prev.root, id, (node) => ({ ...node, message: msg }))
    }));
  }, [findAndModifyNode]);

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !state.root || isAnalyzing) return;

    const userQuery = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userQuery }]);
    setIsAnalyzing(true);

    try {
      const response = await analyzeMap(state.root, userQuery);
      setChatHistory(prev => [...prev, { role: 'ai', text: response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "分析时出错。" }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#fdfdff] text-slate-900 overflow-hidden font-inter relative">
      <div className="flex flex-col flex-1 h-full min-w-0">
        <header className="h-16 border-b border-slate-100 bg-white flex items-center justify-between px-6 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h1 className="text-lg font-black tracking-tight text-slate-800">MindSpark<span className="text-indigo-600">.</span></h1>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); performGeneration(input); }} className="flex-1 max-w-lg mx-6 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入主题生成导图..."
              className="w-full pl-5 pr-28 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none font-medium text-sm"
            />
            <button type="submit" className="absolute right-1 top-1 bottom-1 px-4 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-black transition-all">GENERATE</button>
          </form>

          <div className="flex items-center gap-2">
             <button onClick={() => setIsPanelOpen(!isPanelOpen)} className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${isPanelOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                AI 助手
             </button>
          </div>
        </header>

        <nav className="bg-white border-b border-slate-100 px-6 py-1 flex gap-2 z-20 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('visual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'visual' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            可视化布局
          </button>
          <button 
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'json' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            JSON Bean 源码
          </button>
          <button 
            onClick={() => setActiveTab('android')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'android' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Android 实现逻辑
          </button>
        </nav>

        <main className="flex-1 relative overflow-hidden bg-slate-50">
          {state.loading && !state.root && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/70 backdrop-blur-md">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl animate-spin shadow-xl flex items-center justify-center">
                 <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"></div>
              </div>
              <p className="mt-4 font-bold text-slate-600 tracking-wider text-[10px] uppercase">正在构建思路...</p>
            </div>
          )}
          
          <div className={`h-full w-full ${activeTab === 'visual' ? 'block' : 'hidden'}`}>
            {state.root && (
              <MindMapCanvas 
                data={state.root} 
                onExpand={handleExpand}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onAddManual={openAddModal}
              />
            )}
          </div>

          <div className={`h-full w-full overflow-auto bg-[#0f172a] p-8 ${activeTab === 'json' ? 'block' : 'hidden'}`}>
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-bold text-xs tracking-widest uppercase">Global MindMap JSON</h3>
                <button 
                   onClick={() => { navigator.clipboard.writeText(JSON.stringify(state.root, null, 2)); alert('已复制到剪贴板'); }}
                   className="text-[10px] bg-slate-800 text-slate-300 px-3 py-1 rounded-md hover:bg-slate-700 transition-colors"
                >
                  COPY SOURCE
                </button>
              </div>
              <pre className="text-indigo-300 font-mono text-xs bg-slate-900/80 p-6 rounded-2xl border border-slate-800 leading-relaxed shadow-2xl">
                <code>{JSON.stringify(state.root, null, 2)}</code>
              </pre>
            </div>
          </div>

          <div className={`h-full w-full ${activeTab === 'android' ? 'block' : 'hidden'}`}>
            <AndroidCodeView />
          </div>
        </main>
      </div>

      {/* 侧边栏 AI 助手 */}
      <aside className={`fixed top-0 right-0 h-full bg-white border-l border-slate-200 shadow-2xl z-40 transition-all duration-300 flex flex-col ${isPanelOpen ? 'w-[360px]' : 'w-0 overflow-hidden'}`}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
           <h2 className="font-black text-slate-700 tracking-tighter uppercase text-xs">AI 深度分析</h2>
           <button onClick={() => setIsPanelOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {chatHistory.map((chat, i) => (
            <div key={i} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-3.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${chat.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                {chat.text}
              </div>
            </div>
          ))}
          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="bg-slate-100 p-3 rounded-2xl shadow-sm border border-slate-200 flex gap-1.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"></div>
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleChat} className="p-5 border-t border-slate-100 bg-white">
           <div className="relative">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="针对当前导图提问..." className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none text-xs font-medium" />
              <button type="submit" className="absolute right-2 top-2 bottom-2 px-3 bg-indigo-600 text-white rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
           </div>
        </form>
      </aside>

      {/* 新增节点模态框 (包含对比数据) */}
      {addNodeModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">添加对比节点</h3>
                <p className="text-xs text-slate-400 font-medium">正在为 <span className="text-indigo-600 font-bold">{addNodeModal.parentMsg}</span> 添加子级数据结构</p>
              </div>
              <button onClick={() => setAddNodeModal(prev => ({ ...prev, isOpen: false }))} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row h-[500px]">
              {/* 左侧：输入与操作 */}
              <div className="w-full md:w-1/3 p-8 border-r border-slate-100 space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">节点名称 (Message)</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={addNodeModal.tempMsg} 
                    onChange={(e) => setAddNodeModal(prev => ({ ...prev, tempMsg: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 transition-all outline-none font-bold text-slate-700"
                    placeholder="请输入名称..."
                  />
                </div>
                
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                   <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-2">添加逻辑说明</h4>
                   <ul className="text-[11px] text-indigo-700 leading-relaxed space-y-2">
                     <li className="flex gap-2"><span>•</span> <span>右侧将实时生成对应的 <b>JSON Bean</b> 源码。</span></li>
                     <li className="flex gap-2"><span>•</span> <span>节点将自动生成唯一的 ID。</span></li>
                     <li className="flex gap-2"><span>•</span> <span>新节点默认初始化的子列表为空。</span></li>
                   </ul>
                </div>

                <div className="pt-4 space-y-3">
                  <button onClick={confirmAddManual} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all">
                    确认添加节点
                  </button>
                  <button onClick={() => setAddNodeModal(prev => ({ ...prev, isOpen: false }))} className="w-full py-3 bg-slate-100 text-slate-500 rounded-2xl font-bold text-xs hover:bg-slate-200 transition-all">
                    取消
                  </button>
                </div>
              </div>

              {/* 右侧：实时数据对比预览 */}
              <div className="flex-1 bg-slate-900 p-8 overflow-y-auto no-scrollbar grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    JSON Fragment Preview
                  </h4>
                  <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700 font-mono text-[11px] text-emerald-100 leading-relaxed">
                    <pre>
{`{
  "id": "m-${Date.now().toString().slice(-4)}",
  "message": "${addNodeModal.tempMsg}",
  "children": []
}`}
                    </pre>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                    Kotlin Bean (Data Class)
                  </h4>
                  <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700 font-mono text-[11px] text-indigo-100 leading-relaxed">
                    <pre>
{`val node = Card(
    message = "${addNodeModal.tempMsg}",
    children = listOf()
)`}
                    </pre>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-3">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Structural Impact (Parent: {addNodeModal.parentMsg})</h4>
                  <div className="bg-slate-900 border-2 border-dashed border-slate-800 p-5 rounded-2xl text-[10px] font-mono text-slate-500">
                    {`// Adding "${addNodeModal.tempMsg}" will append one element to the children array of parent ID: ${addNodeModal.parentId}`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
