import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import VoiceLibrary from "./pages/VoiceLibrary";
import CallStudio from "./pages/CallStudio";
import CallDashboard from "./pages/CallDashboard";
import Settings from "./pages/Settings";
import AccessManagement from "./pages/AccessManagement";
import AppLayout from "./components/AppLayout";
import { useAuth } from "./_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";

// Guard that redirects non-admin users away from a route
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      navigate("/");
    }
  }, [loading, user, navigate]);

  if (loading) return null;
  if (user?.role !== "admin") return null;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/voices"} component={VoiceLibrary} />
      <Route path={"/studio"} component={CallStudio} />
      <Route path={"/calls"} component={CallDashboard} />
      <Route path={"/settings"}>{() => <AdminRoute component={Settings} />}</Route>
      <Route path={"/access-management"}>{() => <AdminRoute component={AccessManagement} />}</Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <AppLayout>
            <Router />
          </AppLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
