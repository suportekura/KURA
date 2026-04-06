import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route } from "react-router-dom";
import { SplashScreen } from "@/components/SplashScreen";
import { AnimatedRoutes } from "@/components/animations";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/hooks/useAuth";
import { GeolocationProvider } from "@/hooks/useGeolocation";
import { CartProvider } from "@/contexts/CartContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { PublicRoute } from "@/components/auth/PublicRoute";
import { LocationPermissionModal, LocationBlockedDialog } from "@/components/location";
import Index from "./pages/Index";
import ProductDetail from "./pages/ProductDetail";
import Profile from "./pages/Profile";
import Search from "./pages/Search";
import Sell from "./pages/Sell";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Favorites from "./pages/Favorites";
import Auth from "./pages/Auth";
import Terms from "./pages/Terms";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import MyListings from "./pages/MyListings";
import MySales from "./pages/MySales";
import MyPurchases from "./pages/MyPurchases";
import Reviews from "./pages/Reviews";
import ReviewOrder from "./pages/ReviewOrder";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import EditProfile from "./pages/settings/EditProfile";
import EditPhone from "./pages/settings/EditPhone";
import EditAddress from "./pages/settings/EditAddress";
import EditPix from "./pages/settings/EditPix";
import ChangePassword from "./pages/settings/ChangePassword";
import DeleteAccount from "./pages/settings/DeleteAccount";
import Support from "./pages/settings/Support";
import EditShop from "./pages/settings/EditShop";
import Following from "./pages/Following";
import SellerProfile from "./pages/SellerProfile";
import ModerationQueue from "./pages/admin/ModerationQueue";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import Install from "./pages/Install";
import Plans from "./pages/Plans";
import Boosts from "./pages/Boosts";
import Dashboard from "./pages/Dashboard";
import Coupons from "./pages/Coupons";
import AuthCallback from "./pages/AuthCallback";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60, // 1 minute default
      gcTime: 1000 * 60 * 5, // 5 minutes garbage collection
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <GeolocationProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
            <BrowserRouter>
              <CartProvider>
                {/* Global Location Dialogs */}
                <LocationPermissionModal />
                <LocationBlockedDialog />
                
                <AnimatedRoutes>
                  {/* Public routes - marketplace is open */}
                  <Route path="/" element={<Index />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/seller/:sellerId" element={<SellerProfile />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/install" element={<Install />} />
                  
                  <Route path="/plans" element={
                    <ProtectedRoute>
                      <Plans />
                    </ProtectedRoute>
                  } />
                  <Route path="/boosts" element={
                    <ProtectedRoute>
                      <Boosts />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile/coupons" element={
                    <ProtectedRoute>
                      <Coupons />
                    </ProtectedRoute>
                  } />
                  
                  {/* Auth routes - wrapped with PublicRoute to prevent loops */}
                  <Route path="/auth" element={
                    <PublicRoute>
                      <Auth />
                    </PublicRoute>
                  } />

                  {/* Google OAuth callback route */}
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  
                  {/* Protected routes - require auth + verified email + completed profile */}
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } />
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/favorites" element={
                    <ProtectedRoute>
                      <Favorites />
                    </ProtectedRoute>
                  } />
                  <Route path="/sell" element={
                    <ProtectedRoute>
                      <Sell />
                    </ProtectedRoute>
                  } />
                  <Route path="/messages" element={
                    <ProtectedRoute>
                      <Messages />
                    </ProtectedRoute>
                  } />
                  <Route path="/chat/:conversationId" element={
                    <ProtectedRoute>
                      <Chat />
                    </ProtectedRoute>
                  } />
                  <Route path="/my-listings" element={
                    <ProtectedRoute>
                      <MyListings />
                    </ProtectedRoute>
                  } />
                  <Route path="/my-sales" element={
                    <ProtectedRoute>
                      <MySales />
                    </ProtectedRoute>
                  } />
                  <Route path="/my-purchases" element={
                    <ProtectedRoute>
                      <MyPurchases />
                    </ProtectedRoute>
                  } />
                  <Route path="/checkout" element={
                    <ProtectedRoute>
                      <Checkout />
                    </ProtectedRoute>
                  } />
                  <Route path="/reviews" element={
                    <ProtectedRoute>
                      <Reviews />
                    </ProtectedRoute>
                  } />
                  <Route path="/review/:orderId" element={
                    <ProtectedRoute>
                      <ReviewOrder />
                    </ProtectedRoute>
                  } />
                  <Route path="/notifications" element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings" element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings/profile" element={
                    <ProtectedRoute>
                      <EditProfile />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings/phone" element={
                    <ProtectedRoute>
                      <EditPhone />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings/address" element={
                    <ProtectedRoute>
                      <EditAddress />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings/pix" element={
                    <ProtectedRoute>
                      <EditPix />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings/password" element={
                    <ProtectedRoute>
                      <ChangePassword />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings/delete-account" element={
                    <ProtectedRoute>
                      <DeleteAccount />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings/support" element={
                    <ProtectedRoute>
                      <Support />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings/shop" element={
                    <ProtectedRoute>
                      <EditShop />
                    </ProtectedRoute>
                  } />
                  <Route path="/following" element={
                    <ProtectedRoute>
                      <Following />
                    </ProtectedRoute>
                  } />
                  
                  {/* Admin routes */}
                  <Route path="/admin" element={
                    <AdminRoute>
                      <AdminLayout />
                    </AdminRoute>
                  }>
                    <Route index element={<AdminDashboard />} />
                    <Route path="moderation" element={<ModerationQueue />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="subscriptions" element={<AdminSubscriptions />} />
                    <Route path="logs" element={<AdminLogs />} />
                  </Route>
                  
                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </AnimatedRoutes>
              </CartProvider>
            </BrowserRouter>
          </TooltipProvider>
        </GeolocationProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
