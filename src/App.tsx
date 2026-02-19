import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import Diary from "./pages/Diary";
import Profile from "./pages/Profile";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import KnowledgeBase from "./pages/admin/KnowledgeBase";
import SystemInstructions from "./pages/admin/SystemInstructions";
import Documents from "./pages/admin/Documents";
import DocumentChunks from "./pages/admin/DocumentChunks";
import RagTest from "./pages/admin/RagTest";
import FeedbackDataset from "./pages/admin/FeedbackDataset";
import JourneyMap from "./pages/admin/JourneyMap";
import PendingCredentials from "./pages/admin/PendingCredentials";
import SoldadoApplications from "./pages/admin/SoldadoApplications";
import TestimonyCuration from "./pages/admin/TestimonyCuration";
import AIIntelligence from "./pages/admin/AIIntelligence";
import SoldadoTestimony from "./pages/SoldadoTestimony";
import SoldadoDashboard from "./pages/SoldadoDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/install" element={<Install />} />
          <Route path="/soldado" element={<SoldadoDashboard />} />
          <Route path="/testimony/:applicationId" element={<SoldadoTestimony />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/documents" element={<Documents />} />
          <Route path="/admin/documents/:docId/chunks" element={<DocumentChunks />} />
          <Route path="/admin/rag-test" element={<RagTest />} />
          <Route path="/admin/feedback-dataset" element={<FeedbackDataset />} />
          <Route path="/admin/journey-map" element={<JourneyMap />} />
          <Route path="/admin/knowledge" element={<KnowledgeBase />} />
          <Route path="/admin/instructions" element={<SystemInstructions />} />
          <Route path="/admin/ai-intelligence" element={<AIIntelligence />} />
          <Route path="/admin/pending-credentials" element={<PendingCredentials />} />
          <Route path="/admin/soldado-applications" element={<SoldadoApplications />} />
          <Route path="/admin/testimony-curation" element={<TestimonyCuration />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
