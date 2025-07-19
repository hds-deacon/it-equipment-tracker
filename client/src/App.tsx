import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import LoginForm from './components/auth/LoginForm';
import Dashboard from './pages/Dashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      {/* Equipment routes */}
                      <Route path="/equipment" element={<div>Equipment List</div>} />
                      <Route path="/equipment/new" element={<div>Add Equipment</div>} />
                      <Route path="/equipment/:id" element={<div>Equipment Details</div>} />
                      <Route path="/equipment/:id/edit" element={<div>Edit Equipment</div>} />
                      
                      {/* Employee routes */}
                      <Route path="/employees" element={<div>Employee List</div>} />
                      <Route path="/employees/new" element={<div>Add Employee</div>} />
                      <Route path="/employees/:id" element={<div>Employee Details</div>} />
                      <Route path="/employees/:id/edit" element={<div>Edit Employee</div>} />
                      
                      {/* Transaction routes */}
                      <Route path="/transactions" element={<div>Transaction List</div>} />
                      <Route path="/transactions/overdue" element={<div>Overdue Equipment</div>} />
                      <Route path="/transactions/:id" element={<div>Transaction Details</div>} />
                      
                      {/* Bundle routes */}
                      <Route path="/bundles" element={<div>Bundle List</div>} />
                      <Route path="/bundles/new" element={<div>Add Bundle</div>} />
                      <Route path="/bundles/:id" element={<div>Bundle Details</div>} />
                      <Route path="/bundles/:id/edit" element={<div>Edit Bundle</div>} />
                      
                      {/* Scanner routes */}
                      <Route path="/scanner" element={<div>QR Scanner</div>} />
                      <Route path="/scanner/checkout" element={<div>Quick Checkout</div>} />
                      <Route path="/scanner/checkin" element={<div>Quick Checkin</div>} />
                      
                      {/* Report routes */}
                      <Route path="/reports" element={<div>Reports</div>} />
                      <Route path="/reports/equipment" element={<div>Equipment Report</div>} />
                      <Route path="/reports/transactions" element={<div>Transaction Report</div>} />
                      <Route path="/reports/audit" element={<div>Audit Log</div>} />
                      
                      {/* Admin routes */}
                      <Route path="/admin" element={<div>Admin Panel</div>} />
                      <Route path="/admin/users" element={<div>User Management</div>} />
                      <Route path="/admin/settings" element={<div>Settings</div>} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
