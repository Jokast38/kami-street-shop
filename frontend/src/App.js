import React from "react";
import { Routes, Route } from "react-router-dom";
import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import ChatWidget from "@/components/ChatWidget";
import CookieConsent from "@/components/CookieConsent";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import CategoryPage from "@/pages/CategoryPage";
import ProductDetail from "@/pages/ProductDetail";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import CheckoutCancel from "@/pages/CheckoutCancel";
import LegalNotice from "@/pages/LegalNotice";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import CookiePolicy from "@/pages/CookiePolicy";
import RequireAdmin from "@/components/RequireAdmin";

// Admin-only routes are code-split out of the public storefront bundle: visitors
// browsing the shop never need to download the admin dashboard's JS.
const AdminLogin = React.lazy(() => import("@/pages/AdminLogin"));
const AdminDashboard = React.lazy(() => import("@/pages/AdminDashboard"));

function StoreLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col grain">
      <TopBar />
      <Navbar />
      <main className="flex-1 relative z-10">{children}</main>
      <Footer />
      <CartDrawer />
      <ChatWidget />
      <CookieConsent />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StoreLayout><Home /></StoreLayout>} />
      <Route path="/shop" element={<StoreLayout><Shop /></StoreLayout>} />
      <Route path="/product-category/:slug" element={<StoreLayout><CategoryPage /></StoreLayout>} />
      <Route path="/product/:slug" element={<StoreLayout><ProductDetail /></StoreLayout>} />
      <Route path="/blog" element={<StoreLayout><Blog /></StoreLayout>} />
      <Route path="/blog/:slug" element={<StoreLayout><BlogPost /></StoreLayout>} />
      <Route path="/checkout/success" element={<StoreLayout><CheckoutSuccess /></StoreLayout>} />
      <Route path="/checkout/cancel" element={<StoreLayout><CheckoutCancel /></StoreLayout>} />
      <Route path="/mentions-legales" element={<StoreLayout><LegalNotice /></StoreLayout>} />
      <Route path="/politique-confidentialite" element={<StoreLayout><PrivacyPolicy /></StoreLayout>} />
      <Route path="/cookies" element={<StoreLayout><CookiePolicy /></StoreLayout>} />
      <Route
        path="/admin/login"
        element={
          <React.Suspense fallback={null}>
            <AdminLogin />
          </React.Suspense>
        }
      />
      <Route
        path="/admin"
        element={
          <React.Suspense fallback={null}>
            <RequireAdmin><AdminDashboard /></RequireAdmin>
          </React.Suspense>
        }
      />
    </Routes>
  );
}
