/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Home from './components/Home';
import ProjectStart from './components/ProjectStart';
import Editor from './components/Editor';

export default function App() {
  const [view, setView] = useState<'home' | 'start' | 'editor'>('home');

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-800 font-sans">
      {view === 'home' && <Home onStart={() => setView('start')} />}
      {view === 'start' && <ProjectStart onNext={() => setView('editor')} onBack={() => setView('home')} />}
      {view === 'editor' && <Editor onBack={() => setView('home')} />}
    </div>
  );
}
