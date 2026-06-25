import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages
import SignInPage from "@/pages/sign-in";
import { PatientList } from "@/pages/patient-list";
import { PatientDetail } from "@/pages/patient-detail";
import NotFound from "@/pages/not-found";
import { AuthGate } from "@/auth/auth-gate";
import { USE_MOCK_DATA } from "@/data/mock";
import { DoctorSessionProvider } from "@/auth/mock-session";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={SignInPage} />
      <Route path="/">
        <AuthGate>
          <PatientList />
        </AuthGate>
      </Route>
      <Route path="/patient/:accessCode/:tab">
        {(params) => (
          <AuthGate>
            <PatientDetail accessCode={params.accessCode ?? ""} tab={params.tab ?? "overview"} />
          </AuthGate>
        )}
      </Route>
      <Route path="/patient/:accessCode">
        {(params) => <Redirect to={`/patient/${params.accessCode ?? ""}/overview`} />}
      </Route>
      {/* Legacy access-code routes are retired; send them home. */}
      <Route path="/dashboard/:tab">
        <Redirect to="/" />
      </Route>
      <Route path="/dashboard">
        <Redirect to="/" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const routed = (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* DEV: the mock onboarding/session flow needs this provider. Production omits it. */}
        {USE_MOCK_DATA ? <DoctorSessionProvider>{routed}</DoctorSessionProvider> : routed}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
