import { useState, useCallback, Suspense, lazy } from "react";
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

// Critical routes — synchronous bundle (needed on first paint)
import Index from "./pages/Index";
import ProductDetail from "./pages/ProductDetail";
import Auth from "./pages/Auth";
import SellerProfile from "./pages/SellerProfile";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";

// Non-critical routes — lazy loaded
const Profile = lazy(() => import("./pages/Profile"));
const Search = lazy(() => import("./pages/Search"));
const Sell = lazy(() => import("./pages/Sell"));
const Messages = lazy(() => import("./pages/Messages"));
const Chat = lazy(() => import("./pages/Chat"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Terms = lazy(() => import("./pages/Terms"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const MyListings = lazy(() => import("./pages/MyListings"));
const MySales = lazy(() => import("./pages/MySales"));
const MyPurchases = lazy(() => import("./pages/MyPurchases"));
const Reviews = lazy(() => import("./pages/Reviews"));
const ReviewOrder = lazy(() => import("./pages/ReviewOrder"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const EditProfile = lazy(() => import("./pages/settings/EditProfile"));
const EditPhone = lazy(() => import("./pages/settings/EditPhone"));
const EditAddress = lazy(() => import("./pages/settings/EditAddress"));
const EditPix = lazy(() => import("./pages/settings/EditPix"));
const ChangePassword = lazy(() => import("./pages/settings/ChangePassword"));
const DeleteAccount = lazy(() => import("./pages/settings/DeleteAccount"));
const Support = lazy(() => import("./pages/settings/Support"));
const EditShop = lazy(() => import("./pages/settings/EditShop"));
const Following = lazy(() => import("./pages/Following"));
const Install = lazy(() => import("./pages/Install"));
const Plans = lazy(() => import("./pages/Plans"));
const Boosts = lazy(() => import("./pages/Boosts"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Coupons = lazy(() => import("./pages/Coupons"));

// Admin routes — lazy loaded
const ModerationQueue = lazy(() => import("./pages/admin/ModerationQueue"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));

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

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

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

                <Suspense fallback={<PageFallback />}>
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
                </Suspense>
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
