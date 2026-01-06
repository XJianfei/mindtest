
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, MindMapState } from './types';
import { generateMindMap, expandNode, analyzeMap } from './services/geminiService';
import MindMapCanvas from './components/MindMapCanvas';

const STORAGE_KEY = 'gemini_mind_map_data_v2';

const DEFAULT_MIND_MAP: Card = {
  id: 'root-001',
  message: 'Modern Web Development',
  children: [
    {
      id: 'node-1',
      message: 'Frontend',
      children: [
        { id: 'node-1-1', message: 'React', children: [] },
        { id: 'node-1-2', message: 'Tailwind CSS', children: [] },
        { id: 'node-1-3', message: 'D3.js', children: [] }
      ]
    },
    {
      id: 'node-2',
      message: 'Backend',
      children: [
        { id: 'node-2-1', message: 'Node.js', children: [] },
        { id: 'node-2-2', message: 'PostgreSQL', children: [] },
        { id: 'node-2-3', message: 'Redis', children: [] }
      ]
    },
    {
      id: 'node-3',
      message: 'DevOps',
      children: [
        { id: 'node-3-1', message: 'Docker', children: [] },
        { id: 'node-3-2', message: 'GitHub Actions', children: [] },
        { id: 'node-3-3', message: 'AWS', children: [] }
      ]
    }
  ]
};

const App: React.FC = () => {
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
    { role: 'ai', text: 'Welcome! I have loaded a default mind map for you. You can expand nodes using AI or add your own.' }
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.root) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.root));
  }, [state.root]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const performGeneration = async (topic: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const mindMap = await generateMindMap(topic);
      setState({ root: mindMap, loading: false, error: null });
      setChatHistory(prev => [...prev, { role: 'ai', text: `Generated a new mind map for **${topic}**.` }]);
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: "AI generation failed. Please try again." }));
    }
  };

  const findAndModifyNode = useCallback((root: Card, id: string, modifier: (node: Card) => Card | null): Card | null => {
    if (root.id === id) return modifier(root);
    const newChildren = root.children
      .map(child => findAndModifyNode(child, id, modifier))
      .filter((c): c is Card => c !== null);
    return { ...root, children: newChildren };
  }, []);

  const handleExpand = async (id: string, message: string) => {
    if (!state.root) return;
    
    setState(prev => ({
      ...prev,
      root: findAndModifyNode(prev.root!, id, (node) => ({ ...node, isExpanding: true }))
    }));

    try {
      const fullTreeText = JSON.stringify(state.root);
      const newChildren = await expandNode(message, state.root.message, fullTreeText);
      
      setState(prev => ({
        ...prev,
        root: findAndModifyNode(prev.root!, id, (node) => ({
          ...node,
          isExpanding: false,
          children: [...node.children, ...newChildren]
        }))
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        root: findAndModifyNode(prev.root!, id, (node) => ({ ...node, isExpanding: false })),
        error: "Failed to expand node."
      }));
    }
  };

  const handleAddManual = (id: string) => {
    const newMessage = prompt("Enter sub-topic name:");
    if (!newMessage || !state.root) return;
    
    const newNode: Card = {
      id: Math.random().toString(36).substr(2, 9),
      message: newMessage,
      children: []
    };

    setState(prev => ({
      ...prev,
      root: findAndModifyNode(prev.root!, id, (node) => ({
        ...node,
        children: [...node.children, newNode]
      }))
    }));
  };

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
      setChatHistory(prev => [...prev, { role: 'ai', text: "Sorry, I encountered an error analyzing the map." }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#fdfdff] text-slate-900 overflow-hidden font-inter relative">
      <div className="flex flex-col flex-1 h-full min-w-0">
        <header className="h-20 border-b border-slate-100 bg-white flex items-center justify-between px-8 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800">MindSpark<span className="text-indigo-600">.</span></h1>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); performGeneration(input); }} className="flex-1 max-w-xl mx-8 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search to replace with a new AI map..."
              className="w-full pl-6 pr-36 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none font-medium"
            />
            <button type="submit" className="absolute right-1.5 top-1.5 bottom-1.5 px-6 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-black transition-all">REPLACE</button>
          </form>

          <div className="flex items-center gap-3">
             <button onClick={() => setIsPanelOpen(!isPanelOpen)} className={`px-5 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 ${isPanelOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                ASSISTANT
             </button>
          </div>
        </header>

        <main className="flex-1 relative">
          {state.loading && !state.root && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/70 backdrop-blur-md">
              <div className="w-16 h-16 bg-indigo-600 rounded-3xl animate-bounce shadow-2xl flex items-center justify-center">
                 <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              </div>
              <p className="mt-6 font-black text-slate-800 tracking-tight animate-pulse uppercase text-sm">Synthesizing...</p>
            </div>
          )}
          
          {state.root && (
            <MindMapCanvas 
              data={state.root} 
              onExpand={handleExpand}
              onDelete={(id) => setState(p => ({ ...p, root: findAndModifyNode(p.root!, id, () => null) }))}
              onEdit={(id, msg) => setState(p => ({ ...p, root: findAndModifyNode(p.root!, id, (n) => ({ ...n, message: msg })) }))}
              onAddManual={handleAddManual}
            />
          )}
        </main>
      </div>

      <aside className={`fixed top-0 right-0 h-full bg-white border-l border-slate-100 shadow-2xl z-40 transition-all duration-500 ease-in-out flex flex-col ${isPanelOpen ? 'w-[400px]' : 'w-0 overflow-hidden'}`}>
        <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
           <h2 className="font-black text-slate-800 tracking-tight uppercase text-sm italic">Intelligence Hub</h2>
           <button onClick={() => setIsPanelOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
          {chatHistory.map((chat, i) => (
            <div key={i} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${chat.role === 'user' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-100'}`}>
                {chat.text}
              </div>
            </div>
          ))}
          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-2">
                 <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></div>
                 <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]"></div>
                 <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleChat} className="p-6 border-t border-slate-50 bg-white">
           <div className="relative">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about your map..." 
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none text-sm font-medium"
              />
              <button type="submit" className="absolute right-2 top-2 bottom-2 px-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
           </div>
        </form>
      </aside>

      <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-slate-900/80 backdrop-blur-md rounded-full text-[9px] text-white font-bold uppercase tracking-[0.3em] flex gap-4 z-20">
         <span>&copy; {new Date().getFullYear()} MindSpark Studio</span>
         <span className="text-slate-500">|</span>
         <span className="text-emerald-400">Fixed Load Ready</span>
      </footer>
    </div>
  );
};

export default App;
