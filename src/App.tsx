import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Journals from "./pages/Journals";
import MainMenu from "./pages/MainMenu";
import Calculator from "./pages/Calculator";
import Calendar from "./pages/Calendar";
import Auth from "./pages/Auth";
import AccessPending from "./pages/AccessPending";
import AdminPanel from "./pages/AdminPanel";
import ResetPassword from "./pages/ResetPassword";
import Landing from "./pages/Landing";
import Settings from "./pages/Settings";
import TradingPlanSettings from "./pages/TradingPlanSettings";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<MainMenu />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/journals" element={<Journals />} />
            <Route path="/journal/:journalId" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/access-pending" element={<AccessPending />} />
            <Route path="/admin-panel" element={<AdminPanel />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/trading-plan" element={<TradingPlanSettings />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
