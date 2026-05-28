import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/ui/Header';
import { Home } from './pages/Home';
import { PocEditor } from './pages/PocEditor';
import { LlmConnect } from './pages/LlmConnect';
import { EvalResults } from './pages/EvalResults';
import { Chat } from './pages/Chat';
import { GlobalSettings } from './pages/GlobalSettings';
import { ScaffoldingPage } from './pages/ScaffoldingPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6 max-w-5xl">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/poc/:id" element={<PocEditor />} />
            <Route path="/poc/:id/llm" element={<LlmConnect />} />
            <Route path="/poc/:id/evals" element={<EvalResults />} />
            <Route path="/poc/:id/chat" element={<Chat />} />
            <Route path="/settings" element={<GlobalSettings />} />
            <Route path="/scaffold/:jobId" element={<ScaffoldingPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
