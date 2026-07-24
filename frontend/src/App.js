import React from "react";
import { Routes, Route } from "react-router-dom";
import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import ProductDetail from "@/pages/ProductDetail";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import CheckoutCancel from "@/pages/CheckoutCancel";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import RequireAdmin from "@/components/RequireAdmin";

function StoreLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col grain">
      <TopBar />
      <Navbar />
      <main className="flex-1 relative z-10">{children}</main>
      <Footer />
      <CartDrawer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StoreLayout><Home /></StoreLayout>} />
      <Route path="/shop" element={<StoreLayout><Shop /></StoreLayout>} />
      <Route path="/product/:slug" element={<StoreLayout><ProductDetail /></StoreLayout>} />
      <Route path="/blog" element={<StoreLayout><Blog /></StoreLayout>} />
      <Route path="/blog/:slug" element={<StoreLayout><BlogPost /></StoreLayout>} />
      <Route path="/checkout/success" element={<StoreLayout><CheckoutSuccess /></StoreLayout>} />
      <Route path="/checkout/cancel" element={<StoreLayout><CheckoutCancel /></StoreLayout>} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
    </Routes>
  );
}
