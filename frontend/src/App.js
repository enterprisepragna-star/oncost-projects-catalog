import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";

import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import HomeRedirect from "@/pages/HomeRedirect";
import PublicCatalogPage from "@/pages/PublicCatalogPage";
import PublicProductDetailPage from "@/pages/PublicProductDetailPage";
import PublicQuotationPage from "@/pages/PublicQuotationPage";
import ProductsPage from "@/pages/admin/ProductsPage";
import CategoriesPage from "@/pages/admin/CategoriesPage";
import DiscountConfigPage from "@/pages/admin/DiscountConfigPage";
import PricingRulePage from "@/pages/admin/PricingRulePage";
import QuotationsListPage from "@/pages/admin/QuotationsListPage";
import NewQuotationPage from "@/pages/admin/NewQuotationPage";
import QuotationDetailPage from "@/pages/admin/QuotationDetailPage";
import SalesPage from "@/pages/admin/SalesPage";
import PartnersPage from "@/pages/admin/PartnersPage";
import PartnerDetailPage from "@/pages/admin/PartnerDetailPage";
import LeadsPage from "@/pages/admin/LeadsPage";
import LeadDetailPage from "@/pages/admin/LeadDetailPage";
import CommissionRulesPage from "@/pages/admin/CommissionRulesPage";
import CommissionsPage from "@/pages/admin/CommissionsPage";
import IncentivesPage from "@/pages/admin/IncentivesPage";
import PartnerRegisterPage from "@/pages/PartnerRegisterPage";
import ReferralLandingPage from "@/pages/ReferralLandingPage";
import PartnerDashboardPage from "@/pages/PartnerDashboardPage";
import PartnerLeadsPage from "@/pages/PartnerLeadsPage";
import PartnerCommissionsPage from "@/pages/PartnerCommissionsPage";
import PartnerProfilePage from "@/pages/PartnerProfilePage";

const Admin = ({ children }) => (
  <ProtectedRoute roles={["admin", "super_admin"]}>
    <AdminLayout>{children}</AdminLayout>
  </ProtectedRoute>
);
const PartnerOnly = ({ children }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/catalog" element={<PublicCatalogPage />} />
          <Route path="/catalog/:code" element={<PublicProductDetailPage />} />
          <Route path="/product/:code" element={<PublicProductDetailPage />} />
          <Route path="/q/:token" element={<PublicQuotationPage />} />
          <Route path="/partners/register" element={<PartnerRegisterPage />} />
          <Route path="/refer/:code" element={<ReferralLandingPage />} />

          <Route path="/partner" element={<Navigate to="/partner/dashboard" replace />} />
          <Route path="/partner/dashboard" element={<PartnerOnly><PartnerDashboardPage /></PartnerOnly>} />
          <Route path="/partner/leads" element={<PartnerOnly><PartnerLeadsPage /></PartnerOnly>} />
          <Route path="/partner/commissions" element={<PartnerOnly><PartnerCommissionsPage /></PartnerOnly>} />
          <Route path="/partner/profile" element={<PartnerOnly><PartnerProfilePage /></PartnerOnly>} />

          <Route path="/admin" element={<Navigate to="/admin/products" replace />} />
          <Route path="/admin/products" element={<Admin><ProductsPage /></Admin>} />
          <Route path="/admin/categories" element={<Admin><CategoriesPage /></Admin>} />
          <Route path="/admin/pricing-rule" element={<Admin><PricingRulePage /></Admin>} />
          <Route path="/admin/discount" element={<Admin><DiscountConfigPage /></Admin>} />
          <Route path="/admin/quotations" element={<Admin><QuotationsListPage /></Admin>} />
          <Route path="/admin/quotations/new" element={<Admin><NewQuotationPage /></Admin>} />
          <Route path="/admin/quotations/:id" element={<Admin><QuotationDetailPage /></Admin>} />
          <Route path="/admin/sales" element={<Admin><SalesPage /></Admin>} />
          <Route path="/admin/opms/partners" element={<Admin><PartnersPage /></Admin>} />
          <Route path="/admin/opms/partners/:id" element={<Admin><PartnerDetailPage /></Admin>} />
          <Route path="/admin/opms/leads" element={<Admin><LeadsPage /></Admin>} />
          <Route path="/admin/opms/leads/:id" element={<Admin><LeadDetailPage /></Admin>} />
          <Route path="/admin/opms/commission-rules" element={<Admin><CommissionRulesPage /></Admin>} />
          <Route path="/admin/opms/commissions" element={<Admin><CommissionsPage /></Admin>} />
          <Route path="/admin/opms/incentives" element={<Admin><IncentivesPage /></Admin>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="bottom-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}
