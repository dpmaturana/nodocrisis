import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import NewEvent from "./pages/NewEvent";
import Sectors from "./pages/Sectors";
import MyCapabilities from "./pages/MyCapabilities";
import MyDeployments from "./pages/MyDeployments";
import Coordination from "./pages/admin/Coordination";
import CreateEventAI from "./pages/admin/CreateEventAI";
import SituationReport from "./pages/admin/SituationReport";
import EventDashboard from "./pages/admin/EventDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Auth route - public */}
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected routes */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/new" element={<NewEvent />} />
              <Route path="/events/:eventId" element={<EventDetail />} />
              <Route path="/sectors" element={<Sectors />} />
              <Route path="/my-capabilities" element={<MyCapabilities />} />
              <Route path="/my-deployments" element={<MyDeployments />} />
              
              {/* Admin routes */}
              <Route path="/admin/create-event" element={<CreateEventAI />} />
              <Route path="/admin/situation-report/draft" element={<SituationReport />} />
              <Route path="/admin/situation-report/:reportId" element={<SituationReport />} />
              <Route path="/admin/event-dashboard" element={<EventDashboard />} />
              <Route path="/admin/event-dashboard/:eventId" element={<EventDashboard />} />
              <Route path="/admin/coordination" element={<Coordination />} />
              <Route path="/admin/actors" element={<Dashboard />} />
              <Route path="/admin/settings" element={<Dashboard />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
