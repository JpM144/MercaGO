import { createContext, useContext } from 'react';

// Contexto global de la app: catálogo, carrito, sesión de usuario, etc.
// Se irá poblando conforme se agreguen funcionalidades.
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const value = {
    appName: 'TechStore',
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
