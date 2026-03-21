import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, Play, Download, LayoutTemplate, Palette, MessageSquare, Paperclip, Send, CheckCircle2, ArrowLeft, StickyNote, Trash2, Plus, GripHorizontal, Search, FileText } from 'lucide-react';

export default function Editor({ onBack }: { onBack: () => void }) {
  const [stage, setStage] = useState<'search' | 'draft' | 'design'>('design');
  const [activeSlide, setActiveSlide] = useState(10);
  const [isStoryboard, setIsStoryboard] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-[#f8f9fa] text-slate-800">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-10 shadow-sm">
        <div className="w-56 h-full flex items-center justify-center border-r border-slate-200 shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 w-[200px]">
            <button 
              onClick={() => setStage('search')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${stage === 'search' ? 'bg-white shadow-sm text-slate-800 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              搜索
            </button>
            <button 
              onClick={() => setStage('draft')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${stage === 'draft' ? 'bg-white shadow-sm text-slate-800 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              初稿
            </button>
            <button 
              onClick={() => setStage('design')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${stage === 'design' ? 'bg-white shadow-sm text-slate-800 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              设计稿
            </button>
          </div>
        </div>
        
        <div className="flex-1 px-6 font-semibold text-slate-800 flex items-center gap-3">
          {stage === 'search' && 'Dify 平台概览：从 LLMOps 到 Agentic AI'}
          {stage === 'draft' && '全链路 LLMOps：覆盖开发、调试至监控的生命周期'}
          {stage === 'design' && '住宿策略：兼顾舒适度与交通便捷性的商圈推荐'}
          <span className="bg-slate-100 text-slate-500 text-[11px] px-2.5 py-1 rounded-md font-medium border border-slate-200">预览</span>
        </div>

        <div className="flex items-center gap-4 px-6 shrink-0">
          <button 
            onClick={() => setIsStoryboard(!isStoryboard)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl border transition-all shadow-sm active:scale-95 ${isStoryboard ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-slate-700 hover:bg-slate-50 border-slate-200'}`}
          >
            <StickyNote size={18} />
            便利贴
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-xl border border-slate-200 transition-all shadow-sm active:scale-95">
            <ArrowLeft size={18} />
            返回
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-xl border border-slate-200 transition-all shadow-sm active:scale-95">
            <Play size={18} />
            放映
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm shadow-blue-200 active:scale-95">
            <Download size={18} />
            导出
          </button>
        </div>
      </header>

      {isStoryboard ? (
        <StoryboardCanvas onJump={(slide, targetStage) => {
          setActiveSlide(slide);
          setStage(targetStage);
          setIsStoryboard(false);
        }} />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Slides */}
        <div className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm z-10">
          <div className="p-4 flex justify-between items-center border-b border-slate-100 text-sm">
            <span className="font-semibold text-slate-800">幻灯片</span>
            <span className="text-slate-400 font-medium">共 15 页</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {[6, 7, 8, 9, 10, 11].map(num => (
              <div 
                key={num} 
                onClick={() => setActiveSlide(num)}
                className={`relative rounded-xl border-2 cursor-pointer overflow-hidden transition-all ${activeSlide === num ? 'border-blue-500 shadow-md shadow-blue-100' : 'border-slate-100 hover:border-slate-300'}`}
              >
                <div className="absolute top-1.5 left-1.5 bg-slate-800/60 text-white text-[10px] px-1.5 py-0.5 rounded-md backdrop-blur-md font-medium z-10">
                  {num}
                </div>
                {/* Mock Slide Thumbnail */}
                <div className="aspect-video bg-slate-50 flex flex-col p-3 relative">
                  {stage === 'search' ? (
                    <div className="flex-1 flex items-center justify-center text-xs font-medium text-slate-400">该页无搜索内容</div>
                  ) : (
                    <>
                      <div className="h-2 w-2/3 bg-slate-300 rounded-sm mb-3"></div>
                      <div className="flex gap-1.5 flex-1">
                        <div className="flex-1 bg-slate-200 rounded-sm"></div>
                        <div className="flex-1 bg-slate-200 rounded-sm"></div>
                        <div className="flex-1 bg-slate-200 rounded-sm"></div>
                      </div>
                    </>
                  )}
                  {activeSlide === num && <div className="absolute inset-0 bg-blue-500/5"></div>}
                </div>
              </div>
            ))}
          </div>
          <div className="h-12 border-t border-slate-100 flex items-center justify-between px-5 text-slate-500 bg-slate-50/50">
            <button className="hover:text-slate-800 transition-colors p-1"><ChevronUp size={20} /></button>
            <span className="text-sm font-semibold text-slate-600">{activeSlide} / 15</span>
            <button className="hover:text-slate-800 transition-colors p-1"><ChevronDown size={20} /></button>
          </div>
        </div>

        {/* Middle Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-[#f3f4f6]">
          <div className="flex-1 overflow-auto p-10 flex items-center justify-center">
            {stage === 'search' && <SearchCanvas />}
            {stage === 'draft' && <DraftCanvas />}
            {stage === 'design' && <DesignCanvas />}
          </div>
          
          {/* Speaker Notes */}
          <div className="h-36 bg-white border-t border-slate-200 p-5 shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-2 text-slate-500 mb-3">
              <MessageSquare size={18} />
              <span className="text-sm font-semibold">演讲备注</span>
            </div>
            <textarea 
              className="w-full h-full resize-none outline-none text-sm text-slate-700 placeholder:text-slate-400 leading-relaxed"
              placeholder="点击此处添加演讲备注..."
            ></textarea>
          </div>
        </div>

        {/* Right Chat Panel */}
        <div className="w-[420px] bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-sm z-10">
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50">
            {stage === 'search' && <SearchChat />}
            {stage === 'draft' && <DraftChat />}
            {stage === 'design' && <DesignChat />}
          </div>

          {/* Chat Input */}
          <div className="p-5 bg-white border-t border-slate-100">
            <div className="bg-slate-50 rounded-2xl flex items-end p-2.5 border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <button className="p-2.5 text-slate-400 hover:text-slate-600 transition-colors">
                <Paperclip size={20} />
              </button>
              <textarea 
                placeholder="请输入你的编辑需求..." 
                className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 min-h-[44px] py-2.5 px-3 text-sm text-slate-700"
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
      )}
    </div>
  );
}

// --- Storyboard Components & Mock Data ---

type ContentNode = {
  id: string;
  title: string;
  subtitle?: string;
};

type SectionNode = {
  id: string;
  title: string;
  contents: ContentNode[];
};

const initialStoryboardData: SectionNode[] = [
  {
    id: 's1',
    title: '第一部分：公司概况与品牌愿景',
    contents: [
      { id: 'c1', title: '良信电器简介', subtitle: '公司发展历程与核心价值观' }
    ]
  },
  {
    id: 's2',
    title: '第二部分：核心产品与技术驱动',
    contents: [
      { id: 'c2', title: '五大产品矩阵：全链条配电保护体系', subtitle: '良信电器 五大产品系列 核心技术参数' },
      { id: 'c3', title: '研发创新：坚持6%高比例投入驱动技术领先', subtitle: '良信电器 研发费用率 专利授权 研发中心分布' },
      { id: 'c4', title: '智能制造：数字化生产与质量管控', subtitle: '良信电器 海盐智能工厂 自动化产线' }
    ]
  },
  {
    id: 's3',
    title: '第三部分：行业应用与标杆案例',
    contents: [
      { id: 'c5', title: '16+场景覆盖：从发电端到用电端的全周期方案', subtitle: '良信电器 16个行业 智慧用电 场景解决方案' },
      { id: 'c6', title: '新能源与基建：助力双碳目标与轨道交通建设', subtitle: '良信电器 光伏储能 轨道交通 市场应用' },
      { id: 'c7', title: '标杆案例：高端项目背后的可靠力量', subtitle: '良信电器 绿地中心 浦东机场 案例' }
    ]
  }
];

function StoryboardCanvas({ onJump }: { onJump: (slide: number, stage: 'search' | 'draft' | 'design') => void }) {
  const [sections, setSections] = useState<SectionNode[]>(initialStoryboardData);
  const [draggedItem, setDraggedItem] = useState<{ type: 'section' | 'content', sIndex: number, cIndex?: number } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ type: 'section' | 'content', sIndex: number, cIndex?: number } | null>(null);

  const handleDragStart = (e: React.DragEvent, type: 'section' | 'content', sIndex: number, cIndex?: number) => {
    e.stopPropagation();
    setDraggedItem({ type, sIndex, cIndex });
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target instanceof HTMLElement) e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnter = (e: React.DragEvent, type: 'section' | 'content', sIndex: number, cIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItem({ type, sIndex, cIndex });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target instanceof HTMLElement) e.target.style.opacity = '1';
    
    if (draggedItem && dragOverItem) {
      const newSections = [...sections];
      
      if (draggedItem.type === 'section' && dragOverItem.type === 'section') {
        if (draggedItem.sIndex !== dragOverItem.sIndex) {
          const [movedSection] = newSections.splice(draggedItem.sIndex, 1);
          newSections.splice(dragOverItem.sIndex, 0, movedSection);
        }
      } else if (draggedItem.type === 'content') {
        const sourceSection = newSections[draggedItem.sIndex];
        const [movedContent] = sourceSection.contents.splice(draggedItem.cIndex!, 1);
        
        if (dragOverItem.type === 'section') {
          // Append to the target section
          newSections[dragOverItem.sIndex].contents.push(movedContent);
        } else if (dragOverItem.type === 'content') {
          // Insert before the target content
          newSections[dragOverItem.sIndex].contents.splice(dragOverItem.cIndex!, 0, movedContent);
        }
      }
      setSections(newSections);
    }
    
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDeleteSection = (sIndex: number) => {
    const newSections = [...sections];
    newSections.splice(sIndex, 1);
    setSections(newSections);
  };

  const handleDeleteContent = (sIndex: number, cIndex: number) => {
    const newSections = [...sections];
    newSections[sIndex].contents.splice(cIndex, 1);
    setSections(newSections);
  };

  let globalSlideCount = 0;

  return (
    <div 
      className="flex-1 overflow-auto p-12 bg-[#f4f5f7] relative"
      style={{ backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}
    >
      <div className="flex gap-16 items-start w-max min-h-full pb-32">
        
        {/* Root Node */}
        <div className="w-[280px] shrink-0 z-20 self-center transition-all duration-500">
          <div className="bg-[#5ab0ff] rounded-[2rem] p-6 text-white shadow-xl shadow-blue-200/50 relative border border-blue-400/30">
            <div className="text-right text-[10px] font-bold opacity-80 mb-6 tracking-widest uppercase">Contents</div>
            <div className="space-y-5 mb-10 max-h-[60vh] overflow-y-auto pr-2" style={{ scrollbarWidth: 'none' }}>
              {sections.map((s, idx) => (
                <div key={s.id} className="text-sm font-bold leading-snug opacity-90 flex gap-3 items-start">
                  <span className="opacity-60 text-xs mt-0.5 shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                  <span>{s.title}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-5 border-t border-white/20">
              <span className="text-xs font-bold tracking-wide">Contents</span>
              <div className="flex gap-1 opacity-80">
                <ChevronUp size={16} />
                <ChevronDown size={16} />
              </div>
            </div>
            {/* Connector line from root to sections vertical line */}
            <div className="absolute top-1/2 -right-8 w-8 h-px border-t-2 border-dashed border-slate-300"></div>
          </div>
        </div>

        {/* Sections Column */}
        <div className="flex flex-col gap-12 relative z-10">
          {/* Vertical line connecting all sections */}
          <div className="absolute left-[-2rem] top-[120px] bottom-[120px] w-px border-l-2 border-dashed border-slate-300"></div>

          {sections.map((section, sIndex) => {
            globalSlideCount++;
            const sectionSlideNum = globalSlideCount;

            return (
              <div key={section.id} className="flex gap-12 items-center relative">
                {/* Connector from vertical line to this section */}
                <div className="absolute top-1/2 -left-8 w-8 h-px border-t-2 border-dashed border-slate-300"></div>

                {/* Section Card */}
                <div 
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'section', sIndex)}
                  onDragEnter={(e) => handleDragEnter(e, 'section', sIndex)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className={`w-[320px] h-[240px] shrink-0 bg-white rounded-[2rem] p-7 flex flex-col justify-between shadow-sm hover:shadow-md transition-all border-2 cursor-grab active:cursor-grabbing relative group ${dragOverItem?.type === 'section' && dragOverItem.sIndex === sIndex ? 'border-blue-400 ring-4 ring-blue-50' : 'border-slate-100'}`}
                >
                  <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button onClick={() => handleDeleteSection(sIndex)} className="bg-red-50 text-red-500 p-2 rounded-full shadow-md hover:bg-red-100 transition-colors border border-red-100">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex justify-between items-start">
                    <span className="border border-slate-200 px-3 py-1 rounded-md text-xs font-bold text-slate-500 bg-white shadow-sm">章节</span>
                    <span className="text-5xl font-bold text-slate-200 tracking-tighter">{sectionSlideNum.toString().padStart(2, '0')}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 leading-snug">{section.title}</h3>
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Section</span>
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-300"></div> Draft</span>
                  </div>
                </div>

                {/* Content Cards Row */}
                <div className="flex gap-8 items-center relative">
                  {/* Connector from section to contents */}
                  {section.contents.length > 0 && (
                    <div className="absolute top-1/2 -left-12 w-12 h-px border-t-2 border-dashed border-slate-300"></div>
                  )}
                  
                  {section.contents.map((content, cIndex) => {
                    globalSlideCount++;
                    const contentSlideNum = globalSlideCount;

                    return (
                      <div key={content.id} className="flex gap-8 items-center relative">
                        {/* Connector between contents */}
                        {cIndex > 0 && (
                          <div className="absolute top-1/2 -left-8 w-8 h-px border-t-2 border-dashed border-slate-300"></div>
                        )}
                        
                        {/* Content Card */}
                        <div 
                          draggable
                          onDragStart={(e) => handleDragStart(e, 'content', sIndex, cIndex)}
                          onDragEnter={(e) => handleDragEnter(e, 'content', sIndex, cIndex)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => e.preventDefault()}
                          className={`w-[320px] h-[240px] shrink-0 bg-white rounded-[2rem] p-7 flex flex-col shadow-sm hover:shadow-md transition-all border-2 cursor-grab active:cursor-grabbing relative group ${dragOverItem?.type === 'content' && dragOverItem.sIndex === sIndex && dragOverItem.cIndex === cIndex ? 'border-blue-400 ring-4 ring-blue-50' : 'border-slate-100'}`}
                        >
                          <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button onClick={() => handleDeleteContent(sIndex, cIndex)} className="bg-red-50 text-red-500 p-2 rounded-full shadow-md hover:bg-red-100 transition-colors border border-red-100">
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="flex justify-between items-start mb-5">
                            <span className="text-sm font-bold text-slate-400">#{contentSlideNum}</span>
                            <span className="text-xs font-bold text-slate-800">内容页</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-800 mb-2.5 leading-snug">{content.title}</h3>
                            {content.subtitle && <p className="text-xs text-slate-500 leading-relaxed font-medium">{content.subtitle}</p>}
                          </div>
                          <div className="flex justify-between gap-3 mt-4 pt-4 border-t border-slate-50">
                            <button onClick={() => onJump(contentSlideNum, 'search')} className="flex-1 flex flex-col items-center justify-center gap-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-400 py-3 rounded-2xl transition-colors group/btn">
                              <Search size={18} className="group-hover/btn:scale-110 transition-transform" />
                              <span className="text-[10px] font-medium">搜索结果</span>
                            </button>
                            <button onClick={() => onJump(contentSlideNum, 'draft')} className="flex-1 flex flex-col items-center justify-center gap-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-400 py-3 rounded-2xl transition-colors group/btn">
                              <FileText size={18} className="group-hover/btn:scale-110 transition-transform" />
                              <span className="text-[10px] font-medium">初稿</span>
                            </button>
                            <button onClick={() => onJump(contentSlideNum, 'design')} className="flex-1 flex flex-col items-center justify-center gap-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-400 py-3 rounded-2xl transition-colors group/btn">
                              <Palette size={18} className="group-hover/btn:scale-110 transition-transform" />
                              <span className="text-[10px] font-medium">设计稿</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Add Content Button */}
                  <div className="flex gap-8 items-center relative">
                    <div className="absolute top-1/2 -left-8 w-8 h-px border-t-2 border-dashed border-slate-300"></div>
                    <button 
                      onClick={() => {
                        const newSections = [...sections];
                        newSections[sIndex].contents.push({
                          id: Date.now().toString(),
                          title: '新内容页',
                          subtitle: '点击编辑内容'
                        });
                        setSections(newSections);
                      }}
                      className="w-[320px] h-[240px] shrink-0 rounded-[2rem] border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50/50 transition-all bg-white/50"
                    >
                      <div className="p-3 bg-white rounded-full shadow-sm">
                        <Plus size={24} />
                      </div>
                      <span className="font-bold text-sm">添加新内容页</span>
                    </button>
                  </div>

                </div>
              </div>
            );
          })}

          {/* Add Section Button */}
          <div className="flex gap-12 items-center relative">
            <div className="absolute top-1/2 -left-8 w-8 h-px border-t-2 border-dashed border-slate-300"></div>
            <button 
              onClick={() => {
                setSections([...sections, {
                  id: Date.now().toString(),
                  title: '新章节',
                  contents: []
                }]);
              }}
              className="w-[320px] h-[240px] shrink-0 rounded-[2rem] border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50/50 transition-all bg-white/50"
            >
              <div className="p-3 bg-white rounded-full shadow-sm">
                <Plus size={24} />
              </div>
              <span className="font-bold text-sm">添加新章节</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

function SearchCanvas() {
  return (
    <div className="w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-slate-200 p-10 h-full overflow-y-auto">
      <h2 className="text-2xl font-bold mb-8 text-slate-800 flex items-center gap-3">
        Dify 平台定位 Agentic AI 核心演进 
        <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">20 条结果</span>
      </h2>
      <div className="space-y-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="space-y-3 group">
            <div className="flex items-center gap-3 text-blue-600">
              <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[11px] text-blue-600 font-bold border border-blue-100">网</div>
              <h3 className="text-lg font-semibold hover:underline cursor-pointer">基于 AWS CDK 部署 Dify 社区版的高可用方案 亚马逊AWS官方博客</h3>
            </div>
            <div className="text-xs text-emerald-600 font-medium pl-9">https://aws.amazon.com/cn/blogs/china/high-availability-solution-for-deploying-dify-community-edit...</div>
            <p className="text-sm text-slate-600 leading-relaxed pl-9">
              一、背景介绍 从趋势来看,AI Agent 工作流程正引领着人工智能的下一次革命,其潜力远超仅依赖基础模型的传统方法。AI Agentic 编排工具代表了未来人工智能应用的发展方向,通过将用...
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftCanvas() {
  return (
    <div className="w-full max-w-5xl aspect-video bg-white shadow-xl rounded-xl border border-slate-200 p-14 flex flex-col">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">全链路 LLMOps：覆盖开发、调试至监控的生命周期</h1>
      </div>
      
      <div className="grid grid-cols-2 gap-8 flex-1">
        <div className="border border-slate-200 rounded-2xl p-8 flex flex-col shadow-sm">
          <h3 className="font-bold text-xl mb-5 text-slate-800">敏捷开发与深度调试</h3>
          <div className="bg-blue-50 text-blue-700 text-sm font-semibold px-4 py-1.5 rounded-full w-max mb-6 border border-blue-100">效率提升 80%</div>
          <ul className="space-y-4 text-sm text-slate-600 flex-1 list-disc pl-5 leading-relaxed">
            <li>支持单节点独立调试与逐步执行 (Step Run)</li>
            <li>引入“飞行记录仪”机制，自动保存变量快照</li>
            <li>无需重跑全链路，极速定位逻辑断点</li>
          </ul>
          <div className="mt-6 bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-slate-500 flex items-center gap-3 font-medium">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-200"></div>
            Last Run: Success | Latency: 120ms | Tokens: 450
          </div>
        </div>
        
        <div className="border border-slate-200 rounded-2xl p-8 flex flex-col shadow-sm">
          <h3 className="font-bold text-xl mb-5 text-slate-800">全栈可观测性监控</h3>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">原生集成 OpenTelemetry & HTTPX，实时捕获 API 调用</p>
          <div className="flex-1 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl flex items-center justify-center text-slate-400 text-sm font-medium">
            API 响应延迟与 Token 消耗监控图表
          </div>
        </div>

        <div className="border border-slate-200 rounded-2xl p-8 flex flex-col shadow-sm">
          <h3 className="font-bold text-xl mb-5 text-slate-800">数据驱动的闭环优化</h3>
          <div className="flex items-center gap-8 flex-1">
            <div className="w-24 h-24 rounded-full border-[3px] border-dashed border-blue-300 bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg">
              LOOP
            </div>
            <div className="space-y-3 text-sm text-slate-600 font-medium">
              <p>1. 日志捕获：详尽记录节点级 Trace</p>
              <p>2. 手动标注：纠正偏差，实现知识沉淀</p>
              <p>3. 持续改进：驱动 Prompt 与 RAG 迭代</p>
            </div>
          </div>
          <div className="mt-6 bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-slate-500 font-medium">
            Human-in-the-loop: 建立“日志-标注-改进”的生产级闭环
          </div>
        </div>

        <div className="border border-slate-200 rounded-2xl p-8 flex flex-col shadow-sm">
          <h3 className="font-bold text-xl mb-5 text-slate-800">开放的 Ops 生态集成</h3>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">支持一键对接第三方专业 LLMOps 工具</p>
          <div className="flex-1 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl flex items-center justify-center text-slate-400 text-sm font-medium">
            LangSmith / Langfuse / Opik 集成示意图
          </div>
        </div>
      </div>
    </div>
  );
}

function DesignCanvas() {
  return (
    <div className="w-full max-w-5xl aspect-video bg-[#fdfbf7] shadow-xl rounded-xl border border-slate-200 p-14 flex flex-col relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-red-50 rounded-bl-full -z-0 opacity-60"></div>
      
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-2 h-8 bg-red-800 rounded-full"></div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-wide">住宿策略：兼顾舒适度与交通便捷性的商圈推荐</h1>
        </div>
        
        <div className="bg-white border border-red-100 rounded-2xl p-5 mb-8 shadow-sm flex items-center gap-5">
          <div className="text-red-800 font-bold text-lg whitespace-nowrap">住宿选址黄金法则：</div>
          <div className="text-2xl font-bold text-red-700 tracking-wide">“紧邻地铁，北重南轻”</div>
          <div className="text-sm text-slate-600 font-medium ml-4">优先2/10号线环线，步行距离务必控制在500米以内</div>
        </div>

        <div className="grid grid-cols-4 gap-5 mb-8">
          {[
            { title: '核心枢纽区', sub: '代表：北京站 / 王府井 / 前门', desc: ['进京首站，步行达天安门', '交通极速，适合首旅游客', '价格偏高，极致通勤效率'], tag: '极致效率' },
            { title: '文化韵味区', sub: '代表：什刹海 / 南锣鼓巷', desc: ['深度体验胡同与四合院', '京味浓郁，环境稍显嘈杂', '文艺青年与深度游首选'], tag: '氛围满分' },
            { title: '商务潮流区', sub: '代表：国贸 / 三里屯 / 朝阳门', desc: ['现代酒店云集，CBD夜景', '购物便利，夜生活极丰富', '适合追求品质的商旅人群'], tag: '品质舒适' },
            { title: '性价比优选区', sub: '代表：天坛东门 / 北三环', desc: ['避开拥堵，价格仅为5-7折', '品牌连锁密集，交通便利', '适合长住或家庭亲子游客'], tag: '精明之选' },
          ].map((item, i) => (
            <div key={i} className="bg-white border border-red-50 rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-red-800/80"></div>
              <h3 className="font-bold text-red-900 mb-2 text-lg">{item.title}</h3>
              <p className="text-xs text-slate-500 mb-4 font-medium">{item.sub}</p>
              <ul className="text-xs text-slate-600 space-y-2 mb-5 list-disc pl-4 leading-relaxed">
                {item.desc.map((d, j) => <li key={j}>{d}</li>)}
              </ul>
              <span className="text-[11px] font-semibold bg-red-50 text-red-800 px-3 py-1.5 rounded-md border border-red-100">{item.tag}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6 flex-1">
          <div className="col-span-1 bg-white border border-red-50 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-5 text-lg">住宿消费参考与品牌</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-sm">
                <span className="font-bold text-red-800 w-32 shrink-0">经济型<br/><span className="text-xs font-medium opacity-80">(¥200-400)</span></span>
                <span className="text-slate-600 leading-relaxed">7天、如家、速8<br/><span className="text-xs text-slate-400">(推荐天坛东门)</span></span>
              </div>
              <div className="w-full h-px bg-slate-100"></div>
              <div className="flex items-start gap-3 text-sm">
                <span className="font-bold text-red-800 w-32 shrink-0">舒适/设计师<br/><span className="text-xs font-medium opacity-80">(¥400-800)</span></span>
                <span className="text-slate-600 leading-relaxed">桔子、美居、丽枫<br/><span className="text-xs text-slate-400">(推荐国贸)</span></span>
              </div>
              <div className="w-full h-px bg-slate-100"></div>
              <div className="flex items-start gap-3 text-sm">
                <span className="font-bold text-red-800 w-32 shrink-0">高端/奢华<br/><span className="text-xs font-medium opacity-80">(¥1000+)</span></span>
                <span className="text-slate-600 leading-relaxed">瑰丽、万达文华、丽思<br/><span className="text-xs text-slate-400">(核心区)</span></span>
              </div>
            </div>
          </div>
          
          <div className="col-span-1 bg-white border border-red-50 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-5 text-lg">专家避坑 Tips</h3>
            <ul className="space-y-5 text-sm text-slate-600">
              <li className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0"></div>
                <div>
                  <span className="font-bold text-slate-800">避开机场/火车站周边</span><br/>
                  <span className="text-xs leading-relaxed mt-1 block">溢价高且环境复杂，除非深夜抵达</span>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0"></div>
                <div>
                  <span className="font-bold text-slate-800">留意“假近”地铁站</span><br/>
                  <span className="text-xs leading-relaxed mt-1 block">标注“近”可能需步行15分钟以上</span>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0"></div>
                <div>
                  <span className="font-bold text-slate-800">预订节点建议</span><br/>
                  <span className="text-xs leading-relaxed mt-1 block">旺季需提前2-3周，价格波动极大</span>
                </div>
              </li>
            </ul>
          </div>

          <div className="col-span-1 rounded-2xl overflow-hidden shadow-sm border border-slate-100">
            <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Hotel Lobby" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchChat() {
  return (
    <>
      <div className="flex justify-start">
        <div className="bg-white border border-slate-200 shadow-sm px-5 py-4 rounded-2xl rounded-tl-sm max-w-[95%] w-full space-y-4">
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
            <CheckCircle2 size={18} />
            资料搜索完成
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-3 text-sm">
            {[
              'Dify 日志监控 性能评估 调试工具链...',
              'Dify 监控调试 标注回复 日志追踪 Tr...',
              'Dify 私有化部署 Docker Compose...',
              'Dify 企业级 应用案例 智能客服 文档...',
              'Dify 企业级文档自动化处理 知识库...',
              'Dify 工作流 节点类型 DSL 编排功能',
              'Dify Agent 模式 ReAct 工具调用 ...'
            ].map((text, i) => (
              <div key={i} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 size={14} className="text-blue-500" />
                  <span className="text-blue-500 text-xs font-medium bg-blue-50 px-1.5 py-0.5 rounded">R1</span>
                  <span className="text-slate-800 truncate w-44 group-hover:text-blue-600 transition-colors">{text}</span>
                </div>
                <span className="text-blue-600 text-xs font-medium">20条</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function DraftChat() {
  return (
    <>
      <div className="flex justify-start">
        <div className="bg-white border border-slate-200 shadow-sm px-5 py-4 rounded-2xl rounded-tl-sm max-w-[95%] w-full space-y-3">
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
            <CheckCircle2 size={18} />
            正在为每个页面生成内容策划和视觉设计...
          </div>
        </div>
      </div>
      <div className="flex justify-start">
        <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-2xl rounded-tl-sm max-w-[95%] w-full cursor-pointer hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
              <LayoutTemplate size={24} />
            </div>
            <div>
              <div className="font-bold text-slate-800 text-base">PPT初稿已就绪</div>
              <div className="text-xs text-slate-500 mt-0.5">点击打开预览界面</div>
            </div>
          </div>
          <ChevronDown size={20} className="text-slate-400 -rotate-90 group-hover:text-blue-500 transition-colors" />
        </div>
      </div>
    </>
  );
}

function DesignChat() {
  return (
    <>
      <DraftChat />
      <div className="flex justify-start">
        <div className="bg-emerald-50 border border-emerald-100 shadow-sm p-5 rounded-2xl rounded-tl-sm max-w-[95%] w-full">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
              <CheckCircle2 size={18} />
              设计风格已确认
            </div>
            <ChevronUp size={18} className="text-emerald-600" />
          </div>
          <div className="font-bold text-slate-800 mb-3 text-base">朱红宫墙 (Imperial Minimalist)</div>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-md text-slate-600 font-medium shadow-sm">故宫红</span>
            <span className="text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-md text-slate-600 font-medium shadow-sm">宫廷美学</span>
            <span className="text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-md text-slate-600 font-medium shadow-sm">极简主义</span>
            <span className="text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-md text-slate-600 font-medium shadow-sm">文化底蕴</span>
          </div>
          <div className="text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-md inline-block border border-emerald-200/50">固定背景及标题栏</div>
        </div>
      </div>
      <div className="flex justify-start">
        <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-2xl rounded-tl-sm max-w-[95%] w-full cursor-pointer hover:border-purple-300 hover:shadow-md transition-all flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-100 transition-colors">
              <Palette size={24} />
            </div>
            <div>
              <div className="font-bold text-slate-800 text-base">设计稿已就绪</div>
              <div className="text-xs text-slate-500 mt-0.5">点击打开设计预览</div>
            </div>
          </div>
          <ChevronDown size={20} className="text-slate-400 -rotate-90 group-hover:text-purple-500 transition-colors" />
        </div>
      </div>
      <div className="flex justify-start">
        <div className="bg-white border border-slate-200 shadow-sm px-5 py-4 rounded-2xl rounded-tl-sm max-w-[95%] w-full space-y-3">
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
            <CheckCircle2 size={18} />
            PPT设计稿已就绪
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <div className="bg-blue-50 border border-blue-100 text-blue-800 px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] flex items-center gap-2 text-sm font-medium shadow-sm">
          <Send size={16} className="text-blue-500" />
          第 10 页 • 住宿策...
          <span className="bg-blue-200 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-md ml-1 font-bold">final</span>
        </div>
      </div>
    </>
  );
}
