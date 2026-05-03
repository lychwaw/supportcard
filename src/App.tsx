import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleProvider } from "@/contexts/RoleContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Public routes — no auth required
const Auth = React.lazy(() => import("./pages/Auth"));
const AuthCallback = React.lazy(() => import("./pages/AuthCallback"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const Pricing = React.lazy(() => import("./pages/Pricing"));

// Protected routes — each emitted as its own chunk, fetched only when visited
const Index = React.lazy(() => import("./pages/Index"));
const Transactions = React.lazy(() => import("./pages/Transactions"));
const Expenses = React.lazy(() => import("./pages/Expenses"));
const BalanceBudget = React.lazy(() => import("./pages/BalanceBudget"));
const Calendar = React.lazy(() => import("./pages/Calendar"));
const Messages = React.lazy(() => import("./pages/Messages"));
const Contacts = React.lazy(() => import("./pages/Contacts"));
const Settings = React.lazy(() => import("./pages/Settings"));
const Subscriptions = React.lazy(() => import("./pages/Subscriptions"));
const Family = React.lazy(() => import("./pages/Family"));
const ComplianceDashboard = React.lazy(() => import("./pages/ComplianceDashboard"));
const VisitationTracker = React.lazy(() => import("./pages/VisitationTracker"));
const DocumentVault = React.lazy(() => import("./pages/DocumentVault"));
const VirtualCards = React.lazy(() => import("./pages/VirtualCards"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

// Boot modals — lazy-loaded and only mounted once a user session exists,
// so unauthenticated page loads never download or execute their code.
const ProfileCompletionModal = React.lazy(() =>
  import("@/components/ProfileCompletionModal").then(m => ({ default: m.ProfileCompletionModal }))
);
const SubscriptionPromptModal = React.lazy(() =>
  import("@/components/SubscriptionPromptModal")
);

const routeFallback = (
  <div className="flex h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

// Must be rendered inside AuthProvider to access auth state.
const AuthGatedModals = () => {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <React.Suspense fallback={null}>
      <ProfileCompletionModal />
      <SubscriptionPromptModal />
    </React.Suspense>
  );
};

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider>
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <SidebarTrigger />
        </div>
        <div className="p-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  </SidebarProvider>
);

const App = () => {
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CurrencyProvider>
            <SubscriptionProvider>
              <RoleProvider>
                <AuthGatedModals />
                <React.Suspense fallback={routeFallback}>
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/auth/reset-password" element={<ResetPassword />} />
                    <Route path="/pricing" element={<Pricing />} />

                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Index />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/transactions"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Transactions />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/balance-budget"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <BalanceBudget />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/expenses"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Expenses />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/calendar"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Calendar />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/messages"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Messages />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/contacts"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Contacts />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Settings />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/subscriptions"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Subscriptions />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/family"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Family />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/compliance"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <ComplianceDashboard />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/visitation"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <VisitationTracker />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/documents"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <DocumentVault />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/virtual-cards"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <VirtualCards />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </React.Suspense>
              </RoleProvider>
            </SubscriptionProvider>
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;
