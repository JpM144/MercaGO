import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import Header from './components/Header.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';
import HomePage from './pages/HomePage.jsx';
import ProductDetailPage from './pages/ProductDetailPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import CartPage from './pages/CartPage.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminProducts from './pages/admin/AdminProducts.jsx';
import AdminCategories from './pages/admin/AdminCategories.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import AdminOrderDetail from './pages/admin/AdminOrderDetail.jsx';

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-ink-50 text-ink-900">
              <Header />
              <main className="mx-auto max-w-7xl px-4 py-8">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/products/:slug" element={<ProductDetailPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
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
                          Volver al catálogo
                        </Link>
                      </div>
                    }
                  />
                </Routes>
              </main>
            </div>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </AppProvider>
  );
}
