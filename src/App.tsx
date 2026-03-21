import { useEffect, useState } from 'react';
import Home from './components/Home';
import ProjectStart from './components/ProjectStart';
import Editor from './components/Editor';
import type { ProjectSummary } from './lib/ppt-api';

export default function App() {
  const [view, setView] = useState<'home' | 'workspace'>('home');
  const [activeProject, setActiveProject] = useState<ProjectSummary | null>(null);

  useEffect(() => {
    if (!activeProject) {
      return;
    }
    if (view === 'home') {
      setView('workspace');
    }
  }, [activeProject, view]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-800 font-sans">
      {view === 'home' && <Home onStart={setActiveProject} />}
      {view === 'workspace' && activeProject && activeProject.current_stage === 'init' && (
        <ProjectStart
          project={activeProject}
          onBack={() => {
            setActiveProject(null);
            setView('home');
          }}
          onProjectUpdated={setActiveProject}
        />
      )}
      {view === 'workspace' && activeProject && activeProject.current_stage !== 'init' && (
        <Editor
          project={activeProject}
          onBack={() => {
            setActiveProject(null);
            setView('home');
          }}
          onProjectUpdated={setActiveProject}
        />
      )}
    </div>
  );
}
