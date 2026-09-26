import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { FavoritesProvider } from './context/FavoritesContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import Header from './components/Header.jsx';
import ShoppingAssistantWidget from './components/ShoppingAssistantWidget.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';
import RequireSuperAdmin from './components/RequireSuperAdmin.jsx';
import HomePage from './pages/HomePage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import ProductRedirectPage from './pages/ProductRedirectPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import StoreApplyPage from './pages/StoreApplyPage.jsx';
import StoreStatusPage from './pages/StoreStatusPage.jsx';
import StoreLayout from './pages/store/StoreLayout.jsx';
import StoreHomePage from './pages/store/StoreHomePage.jsx';
import StoreCategoriesPage from './pages/store/StoreCategoriesPage.jsx';
import StoreCategoryPage from './pages/store/StoreCategoryPage.jsx';
import StoreOffersPage from './pages/store/StoreOffersPage.jsx';
import StoreSearchPage from './pages/store/StoreSearchPage.jsx';
import StoreFavoritesPage from './pages/store/StoreFavoritesPage.jsx';
import StoreHelpPage from './pages/store/StoreHelpPage.jsx';
import StoreProductDetailPage from './pages/store/StoreProductDetailPage.jsx';
import CartPage from './pages/CartPage.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminProducts from './pages/admin/AdminProducts.jsx';
import AdminCategories from './pages/admin/AdminCategories.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import AdminOrderDetail from './pages/admin/AdminOrderDetail.jsx';
import AdminSalesAssistant from './pages/admin/AdminSalesAssistant.jsx';
import SuperAdminLayout from './pages/super-admin/SuperAdminLayout.jsx';
import SuperAdminStoresPage from './pages/super-admin/SuperAdminStoresPage.jsx';

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <FavoritesProvider>
          <CartProvider>
            <BrowserRouter>
              <div className="min-h-screen bg-ink-50 text-ink-900">
                <Header />
                <main className="mx-auto max-w-7xl px-4 py-8">
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/catalogo" element={<CatalogPage />} />
                    <Route path="/products/:slug" element={<ProductRedirectPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/ingresar" element={<LoginPage />} />
                    <Route path="/admin/login" element={<AdminLoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/registrar" element={<StoreApplyPage />} />
                    <Route path="/estado-tienda" element={<StoreStatusPage />} />
                    <Route path="/tienda/:slug" element={<StoreLayout />}>
                      <Route index element={<StoreHomePage />} />
                      <Route path="categorias" element={<StoreCategoriesPage />} />
                      <Route path="categoria/:nombre" element={<StoreCategoryPage />} />
                      <Route path="ofertas" element={<StoreOffersPage />} />
                      <Route path="buscar" element={<StoreSearchPage />} />
                      <Route path="favoritos" element={<StoreFavoritesPage />} />
                      <Route path="ayuda" element={<StoreHelpPage />} />
                      <Route path="producto/:productSlug" element={<StoreProductDetailPage />} />
                    </Route>
                    <Route path="/cart" element={<CartPage />} />
                    <Route
                      path="/admin"
                      element={
                        <RequireAdmin>
                          <AdminLayout />
                        </RequireAdmin>
                      }
                    >
                      <Route index element={<Navigate to="/admin/products" replace />} />
                      <Route path="products" element={<AdminProducts />} />
                      <Route path="categories" element={<AdminCategories />} />
                      <Route path="orders" element={<AdminOrders />} />
                      <Route path="orders/:id" element={<AdminOrderDetail />} />
                      <Route path="sales-assistant" element={<AdminSalesAssistant />} />
                    </Route>
                    <Route
                      path="/super-admin"
                      element={
                        <RequireSuperAdmin>
                          <SuperAdminLayout />
                        </RequireSuperAdmin>
                      }
                    >
                      <Route index element={<Navigate to="/super-admin/stores" replace />} />
                      <Route path="stores" element={<SuperAdminStoresPage />} />
                    </Route>
                    <Route
                      path="*"
                      element={
                        <div className="grid gap-3 py-20 text-center">
                          <h1 className="text-2xl font-bold text-ink-900">Página no encontrada</h1>
                          <p className="text-ink-500">La ruta que buscas no existe.</p>
                          <Link
                            to="/"
                            className="text-sm font-medium text-brand-700 hover:text-brand-800"
                          >
                            Volver al marketplace
                          </Link>
                        </div>
                      }
                    />
                  </Routes>
                </main>
                <ShoppingAssistantWidget />
              </div>
            </BrowserRouter>
          </CartProvider>
        </FavoritesProvider>
      </AuthProvider>
    </AppProvider>
  );
}
