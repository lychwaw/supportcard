import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleProvider } from "@/contexts/RoleContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Transactions from "./pages/Transactions";
import Expenses from "./pages/Expenses";
import BalanceBudget from "./pages/BalanceBudget";
import Calendar from "./pages/Calendar";
import Messages from "./pages/Messages";
import Contacts from "./pages/Contacts";
import Settings from "./pages/Settings";
import Subscriptions from "./pages/Subscriptions";
import Family from "./pages/Family";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import ComplianceDashboard from "./pages/ComplianceDashboard";
import VisitationTracker from "./pages/VisitationTracker";
import DocumentVault from "./pages/DocumentVault";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider>
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <SidebarTrigger />
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  </SidebarProvider>
);

const App = () => {
  // Note: OAuth callback handling is done in AuthProvider
  // We don't clean up hash fragments here - let Supabase process them first

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CurrencyProvider>
              <SubscriptionProvider>
                <RoleProvider>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/auth/reset-password" element={<ResetPassword />} />

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
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </RoleProvider>
              </SubscriptionProvider>
            </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
