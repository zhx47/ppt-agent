import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Search, BookOpen, Send, Paperclip, FileText } from 'lucide-react';

export default function ProjectStart({ onNext, onBack }: { onNext: () => void, onBack: () => void }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingText, setLoadingText] = useState('正在分析需求...');
  const [progress, setProgress] = useState(0);

  const handleNext = () => {
    setIsGenerating(true);
    setProgress(15);
    setLoadingText('正在分析需求...');
    
    setTimeout(() => { setProgress(45); setLoadingText('正在提取核心观点...'); }, 800);
    setTimeout(() => { setProgress(75); setLoadingText('正在构建大纲结构...'); }, 1600);
    setTimeout(() => { setProgress(95); setLoadingText('正在排版优化...'); }, 2400);
    setTimeout(() => {
      setProgress(100);
      setLoadingText('生成完成！');
      setTimeout(() => {
        setIsGenerating(false);
        onNext();
      }, 400);
    }, 3000);
  };

  return (
    <div className="h-screen flex flex-col bg-[#f8f9fa] relative">
      {/* Generating Overlay */}
      {isGenerating && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-50 flex items-center justify-center transition-all duration-300">
          <div className="bg-white p-8 rounded-[2rem] shadow-2xl shadow-blue-900/10 border border-slate-100 flex flex-col items-center max-w-sm w-full transform animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 relative mb-6">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-blue-600">
                <FileText size={28} className="animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3 tracking-tight">AI 正在生成大纲</h3>
            <p className="text-sm text-slate-500 font-medium h-5">{loadingText}</p>
            
            {/* Progress bar */}
            <div className="w-full h-2 bg-slate-100 rounded-full mt-8 overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out relative overflow-hidden" 
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite] w-full" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}></div>
              </div>
            </div>
            <div className="text-[10px] font-bold text-slate-400 mt-3 tracking-wider">{progress}%</div>
          </div>
        </div>
      )}

      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 justify-between shrink-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium">
          <ArrowLeft size={18} />
          返回
        </button>
        <div className="font-semibold text-slate-800">项目初始化</div>
        <button onClick={onNext} className="text-blue-600 font-medium hover:text-blue-700 text-sm transition-colors">
          跳过直接进入编辑
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left Panel - Search Results */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-800 flex items-center justify-between">
            <span>参考资料</span>
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-md">联网搜索结果</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="space-y-2 group">
                <h3 className="text-lg font-medium text-blue-600 cursor-pointer group-hover:underline">良信电器企业介绍 - 官方网站</h3>
                <div className="text-xs text-emerald-600 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  https://www.sh-liangxin.com
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  上海良信电器股份有限公司是国内低压电器行业高端市场的领先公司之一。公司以客户需求驱动研发，为电信、建筑、新能源等行业提供专业的低压电器解决方案...
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Chat */}
        <div className="w-[420px] bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden shrink-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50">
            {/* User Message */}
            <div className="flex justify-end">
              <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm text-sm">
                良信电器企业介绍
              </div>
            </div>

            {/* Agent Message - Progress */}
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 shadow-sm px-5 py-4 rounded-2xl rounded-tl-sm max-w-[90%] space-y-4">
                <div className="flex items-center gap-2 text-blue-600 font-medium text-sm">
                  <CheckCircle2 size={18} />
                  背景调研完成
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Search size={14} />
                      <span className="font-medium">搜索</span>
                      <span className="text-slate-800 truncate w-32">良信电器 企业介绍</span>
                    </div>
                    <span className="text-blue-600 font-medium text-xs">20条结果</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <BookOpen size={14} />
                    <span className="font-medium">读取</span>
                    <span className="text-slate-800 truncate w-40">Title: 关于良信 - LAZZEN...</span>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  背景调研已完成，请确认以下内容需求，如有补充可直接修改。
                </p>
              </div>
            </div>

            {/* Agent Message - Form */}
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-2xl rounded-tl-sm max-w-[95%] w-full space-y-5">
                <div className="flex items-center justify-between text-blue-600 font-medium text-sm border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    内容需求单
                  </div>
                  <span className="text-slate-400 text-xs font-normal">1/5</span>
                </div>
                
                <div>
                  <div className="text-xs text-slate-500 mb-1.5 font-medium">问题 1</div>
                  <div className="font-semibold text-slate-800 mb-4">内容页数</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="border border-slate-200 bg-white rounded-xl py-2.5 text-sm hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm">A 5-10页</button>
                    <button className="bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium shadow-sm shadow-blue-200">B 10-15页</button>
                    <button className="border border-slate-200 bg-white rounded-xl py-2.5 text-sm hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm">C 15-20页</button>
                    <button className="border border-slate-200 bg-white rounded-xl py-2.5 text-sm hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm">D 自由发挥</button>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                  <button className="text-slate-400 hover:text-slate-600 p-2 -ml-2"><ArrowLeft size={18} /></button>
                  <button onClick={handleNext} className="bg-blue-50 text-blue-600 px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors">
                    已提交，进入编辑
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-white border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl flex items-end p-2 border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <button className="p-2.5 text-slate-400 hover:text-slate-600 transition-colors">
                <Paperclip size={20} />
              </button>
              <textarea 
                placeholder="请输入你的补充需求..." 
                className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 min-h-[44px] py-2.5 px-2 text-sm text-slate-700"
                rows={1}
              />
              <button className="p-2.5 text-blue-600 hover:text-blue-700 transition-colors">
                <Send size={20} />
              </button>
            </div>
            <div className="text-center text-[11px] text-slate-400 mt-3 font-medium">
              按 Enter 发送，Shift + Enter 换行
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
