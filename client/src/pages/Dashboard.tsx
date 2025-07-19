import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  Users, 
  ArrowRightLeft, 
  AlertTriangle, 
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { DashboardStats } from '../types';

const Dashboard: React.FC = () => {
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiClient.getDashboardStats(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" text="Loading dashboard..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading dashboard</h3>
              <p className="mt-1 text-sm text-red-700">
                Unable to load dashboard statistics. Please try refreshing the page.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your IT equipment tracking system
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <Link
            to="/equipment/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Package className="h-4 w-4 mr-2" />
            Add Equipment
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Equipment
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats?.statistics.total_equipment || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/equipment" className="font-medium text-primary-700 hover:text-primary-900">
                View all equipment
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ArrowRightLeft className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Checked Out
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats?.statistics.checked_out_equipment || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/transactions?status=active" className="font-medium text-primary-700 hover:text-primary-900">
                View active checkouts
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Available
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats?.statistics.available_equipment || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/equipment?status=available" className="font-medium text-primary-700 hover:text-primary-900">
                View available equipment
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Overdue
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats?.statistics.overdue_equipment || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/transactions/overdue" className="font-medium text-primary-700 hover:text-primary-900">
                View overdue items
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment by Category Chart */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Equipment by Category</h3>
          <div className="space-y-4">
            {stats?.equipmentByCategory?.map((category, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">{category.category}</span>
                    <span className="text-gray-500">
                      {category.count} total, {category.checked_out} checked out
                    </span>
                  </div>
                  <div className="mt-1">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full"
                        style={{
                          width: `${category.count > 0 ? (category.checked_out / category.count) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {stats?.recentActivity?.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {activity.transaction_type === 'checkout' ? (
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.asset_tag} {activity.transaction_type === 'checkout' ? 'checked out to' : 'checked in from'} {activity.employee_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(activity.processed_at).toLocaleDateString()} at {new Date(activity.processed_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
              <p className="text-sm text-gray-500">No recent activity</p>
            )}
          </div>
          <div className="mt-4">
            <Link
              to="/transactions"
              className="text-sm font-medium text-primary-700 hover:text-primary-900"
            >
              View all transactions →
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/scanner"
          className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-6 w-6 text-primary-500" />
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-gray-900">Quick Checkout</h4>
              <p className="text-xs text-gray-500">Scan QR code to checkout</p>
            </div>
          </div>
        </Link>

        <Link
          to="/employees"
          className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-6 w-6 text-primary-500" />
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-gray-900">Manage Employees</h4>
              <p className="text-xs text-gray-500">View and edit employees</p>
            </div>
          </div>
        </Link>

        <Link
          to="/reports"
          className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-6 w-6 text-primary-500" />
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-gray-900">Generate Reports</h4>
              <p className="text-xs text-gray-500">Export data and analytics</p>
            </div>
          </div>
        </Link>

        <Link
          to="/equipment/new"
          className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Package className="h-6 w-6 text-primary-500" />
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-gray-900">Add Equipment</h4>
              <p className="text-xs text-gray-500">Register new equipment</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;