import { Search, Plus, FileText, Clock } from 'lucide-react';

export default function Home({ onStart }: { onStart: () => void }) {
  return (
    <div className="max-w-5xl mx-auto pt-32 px-6">
      <h1 className="text-5xl font-bold text-center mb-12 text-slate-800 tracking-tight">AI PPT 生成助手</h1>
      
      <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-3 flex items-center mb-20 max-w-3xl mx-auto transition-shadow hover:shadow-xl hover:shadow-slate-200/50">
        <div className="pl-4 text-slate-400">
          <Search size={24} />
        </div>
        <input 
          type="text" 
          placeholder="输入你的 PPT 需求，例如：生成一份关于 2024 年人工智能发展趋势的报告..." 
          className="flex-1 outline-none text-lg px-4 text-slate-700 placeholder:text-slate-400"
          onKeyDown={(e) => e.key === 'Enter' && onStart()}
        />
        <button 
          onClick={onStart}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus size={20} />
          开始生成
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-slate-700">
          <Clock size={20} className="text-slate-400" />
          最近项目
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div 
              key={i} 
              className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group" 
              onClick={onStart}
            >
              <div className="w-full h-36 bg-slate-50 rounded-xl mb-4 flex items-center justify-center group-hover:bg-blue-50/50 transition-colors">
                <FileText size={36} className="text-slate-300 group-hover:text-blue-300 transition-colors" />
              </div>
              <h3 className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors">未命名项目 {i}</h3>
              <p className="text-sm text-slate-400 mt-1.5">2024-05-20 14:30</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
