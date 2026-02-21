import React, { useState, useEffect } from 'react';
import { Package, Users, Truck, Settings,BarChart3, Search, Plus, X, Upload, ChevronRight, Bell, Eye, TrendingUp, TrendingDown,AlertCircle, Clock, MapPin, Calendar, ShoppingBag, Moon, Sun, DollarSign } from 'lucide-react';


// API Configuration - Update with your Flask backend URL
// Supports both development and production modes
// Vite uses `import.meta.env.VITE_*`. We also guard `process` to avoid blank-screen crashes in the browser.
const FALLBACK_API_HOST =
  (typeof window !== 'undefined' && window.location && window.location.hostname)
    ? window.location.hostname
    : 'localhost';
const FALLBACK_API_BASE_URL = `http://${FALLBACK_API_HOST}:5000/api`;
const API_BASE_URL = import.meta?.env?.VITE_API_URL || 'https://affluence-86yj.onrender.com/api';
//const API_BASE_URL = "http://localhost:5000/api"
// Helper function for API calls with better error handling
const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  // Build headers without forcing Content-Type on simple GET requests.
  // This avoids triggering a CORS preflight for reads.
  const headers = {
    ...options.headers
  };

  // Only set JSON Content-Type when there is a body to send
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const defaultOptions = {
    ...options,
    method,
    headers
  };
  
  try {
    const response = await fetch(url, defaultOptions);
    
    // Handle non-JSON responses
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { error: text || 'Unknown error', raw: text };
    }
    
    if (!response.ok) {
      // Return error with status code
      return {
        ok: false,
        status: response.status,
        error: data.error || data.message || `HTTP ${response.status}`,
        data: data
      };
    }
    
    return {
      ok: true,
      status: response.status,
      data: data
    };
  } catch (error) {
    // Network error or CORS issue
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        ok: false,
        status: 0,
        error: 'Cannot connect to backend server. Please ensure Flask backend is running on http://localhost:5000',
        networkError: true
      };
    }
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error occurred',
      networkError: true
    };
  }
};

const InventorySystem = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('inventory');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [notifications, setNotifications] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showLogoutToast, setShowLogoutToast] = useState(false);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [shippingHistory, setShippingHistory] = useState([]);
  const [shippingStatusFilter, setShippingStatusFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [showVerification, setShowVerification] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductOrders, setSelectedProductOrders] = useState([]);
  const [productSearchResults, setProductSearchResults] = useState([]);

  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [productCategories, setProductCategories] = useState({}); // Store category for each product
  const [userRole, setUserRole] = useState(() => {
    // Load role from localStorage or default to 'admin'
    const savedRole = localStorage.getItem('userRole');
    return savedRole || 'admin';
  });
  const [productToUpdate, setProductToUpdate] = useState(null); // For staff to add quantity
  const [productToEdit, setProductToEdit] = useState(null); // For admin to edit product pricing/details
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? saved === 'true' : false;
  });
  const [imagePreview, setImagePreview] = useState(null); // For image preview
  let imageBase64 = null;
  const [customers, setCustomers] = useState([]);
  const [expandedBatchId, setExpandedBatchId] = useState(null);
  const [batchTransactions, setBatchTransactions] = useState([]);
  const [loadingBatchTransactions, setLoadingBatchTransactions] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [selectedCustomerData, setSelectedCustomerData] = useState(null);
  const [orderStep, setOrderStep] = useState('details'); // 'details' or 'payment'
  const [pendingOrder, setPendingOrder] = useState(null);
  const [reportSettings, setReportSettings] = useState({ email: '', intervalDays: 7 });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [paymentProofPreview, setPaymentProofPreview] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState(null); // store new order details before payment
  const [orderHistorySearch, setOrderHistorySearch] = useState('');
  const [orderHistorySort, setOrderHistorySort] = useState('newest'); // newest, oldest
  const [orderHistoryFromDate, setOrderHistoryFromDate] = useState('');
  const [orderHistoryToDate, setOrderHistoryToDate] = useState('');
  const [reportCustomerFromDate, setReportCustomerFromDate] = useState('');
  const [reportCustomerToDate, setReportCustomerToDate] = useState('');
  const [reportCustomerSearch, setReportCustomerSearch] = useState('');
  const [activeReportTab, setActiveReportTab] = useState('customer'); // customer, inventory, sales, profit, priceLog
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [productAmountInputs, setProductAmountInputs] = useState({});
  const [reportProductFilter, setReportProductFilter] = useState('');
  const [reportViewMode, setReportViewMode] = useState('summary'); // summary, detailed
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [selectedCustomerForDrillDown, setSelectedCustomerForDrillDown] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [customerPurchases, setCustomerPurchases] = useState(null);
  const [loadingCustomerData, setLoadingCustomerData] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [salesReportData, setSalesReportData] = useState(null);
  const [loadingSalesReport, setLoadingSalesReport] = useState(false);
  const [priceHistoryData, setPriceHistoryData] = useState({});
  const [toasts, setToasts] = useState([]);
  
  const [priceChangeLog, setPriceChangeLog] = useState([]);
  const [loadingPriceChangeLog, setLoadingPriceChangeLog] = useState(false);
  const [priceLogProductFilter, setPriceLogProductFilter] = useState('');
  const [inventoryReportData, setInventoryReportData] = useState(null);
  const [loadingInventoryReport, setLoadingInventoryReport] = useState(false);
  const [inventoryReportSelectedProductId, setInventoryReportSelectedProductId] = useState(null);
  const [inventoryReportSalesData, setInventoryReportSalesData] = useState(null);

  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState([]);

  // State for data
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shippingQueue, setShippingQueue] = useState([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStock: 0,
    totalSold: 0,
    lowStockCount: 0
  });

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const showConfirm = (message, onConfirm) => {
    setConfirmDialog({ message, onConfirm });
  };


  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    // Show local preview immediately
    setImagePreview(URL.createObjectURL(file));
  
    // Upload to server
    const formData = new FormData();
    formData.append('file', file);
  
    const res = await fetch('http://localhost:5000/api/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    setFormData(prev => ({ ...prev, image: data.url }));
  };

  
  const addNotification = (type, message) => {
    const newNotif = {
      id: Date.now(),
      type, // 'warning', 'success', 'error', 'info'
      message,
      read: false,
      time: new Date().toLocaleTimeString()
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load categories from localStorage on mount
  useEffect(() => {
    const savedCategories = localStorage.getItem('productCategories');
    if (savedCategories) {
      try {
        setProductCategories(JSON.parse(savedCategories));
      } catch (e) {
        console.error('Error loading categories:', e);
      }
    }
  }, []);

  // Save categories to localStorage when they change
  useEffect(() => {
    if (Object.keys(productCategories).length > 0) {
      localStorage.setItem('productCategories', JSON.stringify(productCategories));
    }
  }, [productCategories]);

  // Save user role to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('userRole', userRole);
  }, [userRole]);

  // Save dark mode to localStorage and apply to document
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Check backend connection on mount
  useEffect(() => {
    const checkBackendConnection = async () => {
      try {
        console.log('[InventorySystem] API_BASE_URL =', API_BASE_URL);
        const result = await apiCall('/health');
        if (result.ok) {
          console.log('✓ Backend connected successfully');
        } else {
          console.error('✗ Backend connection failed:', result.error);
          if (result.networkError) {
            showToast('Cannot connect to backend server. Please ensure Flask backend is running on http://localhost:5000', "error");
          }
        }
      } catch (error) {
        console.error('Backend connection check failed:', error);
      }
    };
    
    checkBackendConnection();
  }, []);

  // Fetch inventory on mount
  useEffect(() => {
    fetchInventory();
    fetchOrders();
    fetchShipping();
    fetchCustomers();
    fetchReportSettings();  // add this here, NOT anywhere else
  }, []);  // empty array = runs ONCE only


  // Fetch report settings on mount
  const fetchReportSettings = async () => {
    const result = await apiCall('/settings/report');
    if (result.ok) {
      setReportSettings({
        email: result.data.email || '',
        intervalDays: result.data.intervalDays || 7,
      });
    }
  };


//fetchReportSettings();
  useEffect(() => {
   // setNotifications(shippingQueue.filter(s => s.status === 'pending').length);
  }, [shippingQueue]);

  useEffect(() => {
    if (activeTab === 'reports' && (activeReportTab === 'sales' || activeReportTab === 'profit')) {
      fetchSalesReport();
    }
    if (activeTab === 'reports' && activeReportTab === 'inventory') {
      fetchInventoryReport();
    }
    if (activeTab === 'reports' && activeReportTab === 'priceLog') {
      fetchPriceChangeLog();
    }
  }, [activeTab, activeReportTab, reportProductFilter, reportDateFrom, reportDateTo]);

  const fetchInventoryReport = async () => {
    try {
      setLoadingInventoryReport(true);
      const result = await apiCall('/inventory-report');
      if (result.ok) {
        setInventoryReportData(result.data);
        data.products.forEach(p => {
          if (p.quantity < 50) {
            addNotification('warning', `Low stock: ${p.name} has only ${p.quantity} units left`);
          }
        });
      } else {
        console.error('Failed to fetch inventory report:', result.error);
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running.');
        }
      }
    } catch (error) {
      console.error('Error fetching inventory report:', error);
    } finally {
      setLoadingInventoryReport(false);
    }
  };

  const fetchBatchTransactions = async (batchId, productId) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      setBatchTransactions([]);
      return;
    }
    try {
      setLoadingBatchTransactions(true);
      setExpandedBatchId(batchId);
      const result = await apiCall(`/orders?batchId=${encodeURIComponent(batchId)}&productId=${encodeURIComponent(productId)}`);
      if (result.ok) {
        setBatchTransactions(result.data.orders || []);
      } else {
        console.error('Failed to fetch batch transactions:', result.error);
        setBatchTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching batch transactions:', error);
      setBatchTransactions([]);
    } finally {
      setLoadingBatchTransactions(false);
    }
  };
  const fetchInventorySalesReportForProduct = async (productId) => {
    try {
      setLoadingInventorySalesReport(true);
      setInventoryReportSelectedProductId(productId);
      const params = new URLSearchParams();
      if (productId) params.append('productId', productId);
      if (reportDateFrom) params.append('dateFrom', reportDateFrom);
      if (reportDateTo) params.append('dateTo', reportDateTo);
      const queryString = params.toString();
      const endpoint = `/reports/sales${queryString ? '?' + queryString : ''}`;
      const result = await apiCall(endpoint);
      if (result.ok) {
        setInventoryReportSalesData(result.data);
      } else {
        console.error('Failed to fetch embedded sales report:', result.error);
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running.');
        }
      }
    } catch (error) {
      console.error('Error fetching embedded sales report:', error);
    } finally {
      setLoadingInventorySalesReport(false);
    }
  };



  const handleDeleteOrder = async (orderId) => {
    if (!confirm('Are you sure you want to delete this order? This cannot be undone.')) return;
    try {
      setLoading(true);
      const result = await apiCall(`/orders/${orderId}`, { method: 'DELETE' });
      if (result.ok) {
        await fetchOrders();
        await fetchShipping();
        await fetchInventory();
        if (selectedCustomer) {
          const updated = orders.filter(o => o.customerName === selectedCustomer && o.id !== orderId);
          setCustomerOrders(updated);
        }
        setSelectedOrder(null);
        showToast('Order deleted successfully!');
      } else {
        showToast(result.error || 'Failed to delete order.');
      }
    } catch (error) {
      showToast('Error deleting order.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteProduct = (productId) => {
    showConfirm('This product will be permanently deleted and cannot be undone.', async () => {
      try {
        setLoading(true);
        const result = await apiCall(`/inventory/${productId}`, { method: 'DELETE' });
        if (result.ok) {
          await fetchInventory();
          setSelectedProduct(null);
          showToast('Product deleted successfully!');
        } else {
          showToast(result.error || 'Failed to delete product.', 'error');
        }
      } catch (error) {
        showToast('Error deleting product.', 'error');
      } finally {
        setLoading(false);
      }
    });
  };
  
  const fetchPriceChangeLog = async () => {
    try {
      setLoadingPriceChangeLog(true);
      const query = priceLogProductFilter ? `?productId=${encodeURIComponent(priceLogProductFilter)}` : '';
      const result = await apiCall(`/reports/price-changes${query}`);
      if (result.ok) {
        setPriceChangeLog(result.data.changes || []);
      } else {
        console.error('Failed to fetch price change log:', result.error);
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running.');
        }
      }
    } catch (error) {
      console.error('Error fetching price change log:', error);
    } finally {
      setLoadingPriceChangeLog(false);
    }
  };

  // API Functions
  const fetchInventory = async () => {
    try {
      setLoading(true);
      const result = await apiCall('/inventory');
      if (result.ok) {
        setInventory(result.data.products || []);
        setStats(result.data.stats || stats);
      } else {
        console.error('Error fetching inventory:', result.error);
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running on port 5000.', "error");
        }
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const result = await apiCall('/orders');
      if (result.ok) {
        const ordersData = result.data.orders || [];
        setOrders(ordersData);
        return ordersData;
      } else {
        console.error('Error fetching orders:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      return [];
    }
  };

  const fetchShipping = async () => {
    try {
      const result = await apiCall('/shipping');
      if (result.ok) {
        setShippingQueue(result.data.shipping || []);
      } else {
        console.error('Error fetching shipping:', result.error);
      }
    } catch (error) {
      console.error('Error fetching shipping:', error);
    }
  };

  const fetchShippingHistory = async (orderId) => {
    try {
      const result = await apiCall(`/shipping/${orderId}/history`);
      if (result.ok) {
        setShippingHistory(result.data.history || []);
      } else {
        console.error('Error fetching shipping history:', result.error);
        setShippingHistory([]);
      }
    } catch (error) {
      console.error('Error fetching shipping history:', error);
      setShippingHistory([]);
    }
  };

  const verifyInventory = async () => {
    try {
      setLoading(true);
      const result = await apiCall('/inventory/verify');
      if (result.ok) {
        setVerificationData(result.data);
        setShowVerification(true);
      } else {
        showToast(result.error || 'Failed to verify inventory');
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running.');
        }
      }
    } catch (error) {
      console.error('Error verifying inventory:', error);
      showToast('Error verifying inventory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fixInventory = async () => {
    try {
      if (!confirm('This will update inventory sold quantities to match actual orders. Continue?')) {
        return;
      }
      setLoading(true);
      const result = await apiCall('/inventory/fix', {
        method: 'POST'
      });
      if (result.ok) {
        await fetchInventory();
        setShowVerification(false);
        setVerificationData(null);
        showToast(result.data.message || 'Inventory fixed successfully!');
      } else {
        showToast(result.error || 'Failed to fix inventory');
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running.');
        }
      }
    } catch (error) {
      console.error('Error fixing inventory:', error);
      showToast('Error fixing inventory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSearch = async (query) => {
    setProductSearchQuery(query);
    if (!query.trim()) {
      setProductSearchResults([]);
      setSelectedProductOrders([]);
      return;
    }
    
    try {
      const results = await searchProducts(query);
      setProductSearchResults(results);
    } catch (error) {
      console.error('Error searching products:', error);
      setProductSearchResults([]);
    }
  };

  const fetchProductOrders = async (productId) => {
    try {
      setLoading(true);
      const result = await apiCall(`/orders?productId=${productId}`);
      if (result.ok) {
        // Group orders by customer
        const ordersByCustomer = {};
        (result.data.orders || []).forEach(order => {
          const customerName = order.customerName;
          if (!ordersByCustomer[customerName]) {
            ordersByCustomer[customerName] = [];
          }
          ordersByCustomer[customerName].push(order);
        });
        setSelectedProductOrders(ordersByCustomer);
      } else {
        showToast(result.error || 'Failed to fetch orders');
        setSelectedProductOrders([]);
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running.');
        }
      }
    } catch (error) {
      console.error('Error fetching product orders:', error);
      showToast('Error fetching orders. Please try again.');
      setSelectedProductOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleShippingClick = async (ship) => {
    setSelectedShipping(ship);
    await fetchShippingHistory(ship.id);
  };

  const searchProducts = async (query) => {
    try {
      const result = await apiCall(`/products/search?id=${encodeURIComponent(query)}`);
      if (result.ok) {
        return result.data.products || [];
      } else {
        console.error('Error searching products:', result.error);
        // Fallback to local search if API fails
        return inventory.filter(item => 
          item.id.toLowerCase().includes(query.toLowerCase()) ||
          item.name.toLowerCase().includes(query.toLowerCase())
        );
      }
    } catch (error) {
      console.error('Error searching products:', error);
      // Fallback to local search if network error
      return inventory.filter(item => 
        item.id.toLowerCase().includes(query.toLowerCase()) ||
        item.name.toLowerCase().includes(query.toLowerCase())
      );
    }
  };

  const openModal = (type) => {
    setModalType(type);
    setShowModal(true);
  };

  const handleAddInventory = async (formData) => {
    try {
      setLoading(true);
      const result = await apiCall('/inventory', {
        method: 'POST',
        body: JSON.stringify({
          productId: formData.productId,
          productName: formData.productName,
          batchId: formData.batchId,
          category: formData.category || 'Uncategorized',
          description: formData.description || '',
          supplier: formData.supplier || '',
          dateReceived: formData.dateReceived,
          quantity: parseInt(formData.quantity),
          cost: parseFloat(formData.cost),
          price: parseFloat(formData.price),
          shippingCost: parseFloat(formData.shippingCost || 0),
          image: formData.image
        })
      });
      
      if (result.ok) {
        // Store category for this product
        if (formData.category) {
          setProductCategories(prev => ({
            ...prev,
            [formData.productId]: formData.category
          }));
        }
        await fetchInventory();
        setShowModal(false);
        showToast('Product and batch added successfully!');
      } else {
        const errorMessage = result.error || 'Failed to add inventory. Please try again.';
        showToast(errorMessage, 'error');
        console.error('Error response:', result.data);
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running on port 5000.');
        }
      }
    } catch (error) {
      console.error('Error adding inventory:', error);
      showToast('Error adding inventory. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (productId, updates) => {
    try {
      setLoading(true);
      const result = await apiCall(`/inventory/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });

      if (result.ok) {
        await fetchInventory();
        setProductToEdit(null);
        setShowModal(false);
        showToast(result.data.message || 'Product updated successfully!');
      } else {
        const errorMessage = result.error || 'Failed to update product. Please try again.';
        showToast(errorMessage);
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running.');
        }
      }
    } catch (error) {
      console.error('Error updating product:', error);
      showToast('Error updating product. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuantity = async (productId, quantityToAdd) => {
    try {
      setLoading(true);
      const result = await apiCall(`/inventory/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          quantity: parseInt(quantityToAdd)
        })
      });
      
      if (result.ok) {
        await fetchInventory();
        setProductToUpdate(null);
        setShowModal(false);
        showToast(`Successfully added ${quantityToAdd} units to stock!`);
      } else {
        const errorMessage = result.error || 'Failed to add quantity. Please try again.';
        showToast(errorMessage);
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running.');
        }
      }
    } catch (error) {
      console.error('Error adding quantity:', error);
      showToast('Error adding quantity. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerPurchases = async (customerName) => {
    try {
      setLoadingCustomerData(true);
      setCustomerPurchases(null);
      
      // Validate customer name
      if (!customerName || customerName.trim() === '') {
        showToast('Invalid customer name');
        return;
      }
      
      const result = await apiCall(`/customers/${encodeURIComponent(customerName)}/purchases`);
      
      if (result.ok) {
        setCustomerPurchases(result.data);
        setSelectedCustomerForDrillDown(customerName);
      } else {
        // Handle 404 specifically
        if (result.status === 404) {
          showToast(`Customer not found: ${customerName}`);
        } else {
          showToast(result.error || result.data?.message || 'Failed to fetch customer purchases');
        }
        setSelectedCustomerForDrillDown(null);
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running.');
        }
      }
    } catch (error) {
      console.error('Error fetching customer purchases:', error);
      showToast('Network error. Please check your connection and try again.');
      setSelectedCustomerForDrillDown(null);
    } finally {
      setLoadingCustomerData(false);
    }
  };

  const fetchSalesReport = async () => {
    try {
      setLoadingSalesReport(true);
      const params = new URLSearchParams();
      if (reportProductFilter) params.append('productId', reportProductFilter);
      if (reportDateFrom) params.append('dateFrom', reportDateFrom);
      if (reportDateTo) params.append('dateTo', reportDateTo);
      
      const queryString = params.toString();
      const endpoint = `/reports/sales${queryString ? '?' + queryString : ''}`;
      const result = await apiCall(endpoint);
      
      if (result.ok) {
        setSalesReportData(result.data);
      } else {
        console.error('Failed to fetch sales report:', result.error);
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running.');
        }
      }
    } catch (error) {
      console.error('Error fetching sales report:', error);
    } finally {
      setLoadingSalesReport(false);
    }
  };

  const fetchPriceHistory = async (batchId) => {
    if (priceHistoryData[batchId]) return; // Already fetched
    
    try {
      const result = await apiCall(`/batches/${batchId}/price-history`);
      if (result.ok) {
        setPriceHistoryData(prev => ({
          ...prev,
          [batchId]: result.data.priceHistory || []
        }));
      } else {
        console.error('Error fetching price history:', result.error);
      }
    } catch (error) {
      console.error('Error fetching price history:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const result = await apiCall('/customers');
      if (result.ok) {
        setCustomers(result.data.customers || []);
      } else {
        console.error('Error fetching customers:', result.error);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const searchCustomers = async (query) => {
    try {
      const result = await apiCall(`/customers?search=${encodeURIComponent(query)}`);
      if (result.ok) {
        return result.data.customers || [];
      } else {
        console.error('Error searching customers:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      return [];
    }
  };

  const handleCustomerSearch = async (query) => {
    setCustomerSearchQuery(query);
    if (!query.trim()) {
      setCustomerSearchResults([]);
      setSelectedCustomerData(null);
      return;
    }
    
    try {
      const results = await searchCustomers(query);
      setCustomerSearchResults(results);
      
      // Auto-fill if exact match on name OR username
      const exactMatch = results.find(c => 
        c.name.toLowerCase() === query.toLowerCase() ||
        (c.username && c.username.toLowerCase() === query.toLowerCase())
      );
      if (exactMatch) {
        setSelectedCustomerData(exactMatch);
      } else {
        setSelectedCustomerData(null);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      setCustomerSearchResults([]);
    }
  };

  const handleAddOrder = async (formData) => {
    try {
      setLoading(true);

      const basePayload = {
        customerName: formData.customerName,
        username: formData.username || selectedCustomerData?.username || '',
        email: formData.email || selectedCustomerData?.email || '',
        phone: formData.phone || selectedCustomerData?.phone || '',
        upline: formData.upline || selectedCustomerData?.upline || null,
        address: formData.address,
        invoice: formData.invoice,
        paymentMethod: formData.paymentMethod,
        paymentProof: formData.paymentProof,
        paymentReference: formData.paymentReference,
        paymentConfirmed: formData.paymentConfirmed || false,
        amountPaid: formData.amountPaid || null,
        accountNumber: formData.accountNumber || selectedCustomerData?.accountNumber || ''
      };
      let lastOrderData = null;
      const productIds = formData.productIds && formData.productIds.length
      ? formData.productIds
      : (formData.productId ? [formData.productId] : []);
    
    if (!productIds.length) {
      showToast('Please select at least one product.');
      return;
    }
    
    const quantities = formData.productQuantities || {};
    console.log('Quantities map:', quantities);
    console.log('Product IDs:', productIds);
    for (const pid of productIds) {
        const qtyForPid = quantities[pid] || formData.quantity || 1;
        console.log(`Product ${pid} quantity:`, qtyForPid);
        const result = await apiCall('/orders', {
          method: 'POST',
          body: JSON.stringify({
            ...basePayload,
            productId: pid,
            quantity: quantities[pid] || formData.quantity || 1
          })
        });
        if (!result.ok) {
          const errorMessage = result.error || 'Failed to create order. Please try again.';
          showToast(errorMessage);
          if (result.networkError) {
            showToast('Cannot connect to backend. Please ensure Flask is running.');
          }
          return;
        }
      
        lastOrderData = result.data;
      }

        // Check for out-of-stock products
        const outOfStock = productIds.filter(id => {
          const product = inventory.find(p => p.id === id);
          const requestedQty = formData.productQuantities?.[id] || 1;
          return product && product.quantity < requestedQty;
        });
        if (outOfStock.length > 0) {
          const names = outOfStock.map(id => inventory.find(p => p.id === id)?.name).join(', ');
          showToast(`The following products are out of stock: ${names}`);
          return;
        }


      console.log('productIds:', productIds);
      console.log('quantities:', quantities);
      console.log('basePayload:', basePayload);

      //const quantities = formData.productQuantities || {};
      const productAmounts = formData.productAmounts || {};
      for (const pid of productIds) {
        const qtyForPid = quantities[pid] || formData.quantity || 1;
        const pidAmount = productAmounts[pid] != null && productAmounts[pid] > 0
          ? productAmounts[pid]
          : formData.amountPaid || null;
        const result = await apiCall('/orders', {
          method: 'POST',
          body: JSON.stringify({
            ...basePayload,
            productId: pid,
            quantity: qtyForPid,
            amountPaid: pidAmount
          })
        });
        if (!result.ok) {
          const errorMessage = result.error || 'Failed to create order. Please try again.';
          showToast(errorMessage);
          console.error('Error response:', result.data);
          if (result.networkError) {
            showToast('Cannot connect to backend. Please ensure Flask is running.');
          }
          return;
        }

        lastOrderData = result.data;
      }

      if (lastOrderData) {
        // For flows that need pendingOrder (not used for immediate-confirm path)
        if (!formData.paymentConfirmed && formData.paymentMethod && !formData.paymentReference) {
          setPendingOrder(lastOrderData.order);
          setOrderStep('payment');
        } else {
          const updatedOrders = await fetchOrders();
          await fetchShipping();
          await fetchInventory();
          await fetchCustomers();
          // If viewing a customer, refresh their order history so payment info appears
          if (selectedCustomer) {
            const customerSpecificOrders = updatedOrders.filter(
              (o) => o.customerName === selectedCustomer
            );
            setCustomerOrders(customerSpecificOrders);
          }
          setShowModal(false);
          setOrderStep('details');
          setPendingOrder(null);
          setPendingOrderData(null);
          setCustomerSearchQuery('');
          setSelectedCustomerData(null);
          setPaymentProofPreview(null);
          showToast(productIds.length > 1 ? 'Orders created successfully!' : 'Order created successfully!');
          addNotification('info', `New order created for ${formData.customerName}`);
        }
      }
    } catch (error) {
  console.error('Error adding order:', error);
  console.error('Error details:', error?.message, error?.stack);
  showToast(`Error creating order: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };


  const exportSalesReportPDF = () => {
    if (!salesReportData) return;
  
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  
      const teal = [47, 183, 161];
      const dark = [15, 23, 42];
      const gray = [100, 116, 139];
      const lightGray = [241, 245, 249];
      const green = [22, 163, 74];
      const red = [220, 38, 38];
      const altRow = [248, 250, 252];
  
      const fmt = (num) => `NGN ${Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const PAGE_W = 297;
      const PAGE_H = 210;
      const MARGIN = 14;
      const CONTENT_W = PAGE_W - MARGIN * 2;
  
      const addPageHeader = (pageTitle) => {
        doc.setFillColor(...teal);
        doc.rect(0, 0, PAGE_W, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Sales Report - Affluence Global', MARGIN, 11);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, PAGE_W - MARGIN, 8, { align: 'right' });
        if (pageTitle) {
          doc.setFontSize(7);
          doc.text(pageTitle, PAGE_W - MARGIN, 14, { align: 'right' });
        }
      };
  
      const addFooter = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFillColor(245, 247, 250);
          doc.rect(0, PAGE_H - 8, PAGE_W, 8, 'F');
          doc.setFontSize(6.5);
          doc.setTextColor(...gray);
          doc.text(`Page ${i} of ${pageCount}`, MARGIN, PAGE_H - 3);
          doc.text('Affluence Global - Inventory Management Portal', PAGE_W / 2, PAGE_H - 3, { align: 'center' });
          doc.text(`Exported ${new Date().toLocaleString()}`, PAGE_W - MARGIN, PAGE_H - 3, { align: 'right' });
        }
      };
  
      // ════════════════════════════════════════
      // PAGE 1 — Summary + Product Breakdown
      // ════════════════════════════════════════
      addPageHeader('Page 1: Summary & Product Breakdown');
  
      // Summary cards
      const summaryItems = [
        { label: 'Total Revenue', value: fmt(salesReportData.summary?.totalRevenue), color: teal },
        { label: 'Total COGS (FIFO)', value: fmt(salesReportData.summary?.totalCost), color: gray },
        { label: 'Gross Profit', value: fmt(salesReportData.summary?.totalProfit), color: (salesReportData.summary?.totalProfit || 0) >= 0 ? green : red },
        { label: 'Units Sold', value: `${salesReportData.summary?.unitsSold || 0} units`, color: dark },
        { label: 'Total Orders', value: `${salesReportData.summary?.totalOrders || salesReportData.products?.reduce((s, p) => s + (p.batches?.reduce((bs, b) => bs + (b.sales?.length || 0), 0) || 0), 0) || 0} orders`, color: dark },
      ];
  
      const cardW = (CONTENT_W - 4 * 3) / 5;
      summaryItems.forEach((item, i) => {
        const x = MARGIN + i * (cardW + 3);
        doc.setFillColor(...lightGray);
        doc.roundedRect(x, 22, cardW, 16, 1.5, 1.5, 'F');
        doc.setDrawColor(...teal);
        doc.setLineWidth(0.5);
        doc.line(x, 22, x, 38);
        doc.setTextColor(...gray);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(item.label.toUpperCase(), x + 3, 27);
        doc.setTextColor(...item.color);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.text(item.value, x + 3, 35);
      });
  
      // Product breakdown section
      let y = 44;
      doc.setTextColor(...teal);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Product Breakdown', MARGIN, y);
      doc.setDrawColor(...teal);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, y + 1, MARGIN + 40, y + 1);
      y += 5;
  
      const cols = ['Product', 'Units Sold', 'Revenue', 'COGS (FIFO)', 'Gross Profit', 'Margin %'];
      const colWidths = [72, 24, 50, 50, 50, 23];
      const colX = [MARGIN];
      colWidths.forEach((w, i) => { if (i < colWidths.length - 1) colX.push(colX[i] + colWidths[i]); });
  
      // Table header
      doc.setFillColor(...teal);
      doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      cols.forEach((col, i) => doc.text(col, colX[i] + 2, y + 4.8));
      y += 7;
  
      (salesReportData.products || []).forEach((product, pIdx) => {
        if (y > PAGE_H - 22) {
          doc.addPage();
          addPageHeader('Product Breakdown (cont.)');
          y = 22;
        }
  
        const margin = product.totalRevenue > 0
          ? ((product.totalProfit / product.totalRevenue) * 100).toFixed(1)
          : '0.0';
        const isProfit = (product.totalProfit || 0) >= 0;
  
        doc.setFillColor(...(pIdx % 2 === 0 ? altRow : [255, 255, 255]));
        doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...dark);
        doc.text(product.product.name, colX[0] + 2, y + 4.8);
        doc.setFont('helvetica', 'normal');
        doc.text(`${product.totalSold || 0}`, colX[1] + 2, y + 4.8);
        doc.text(fmt(product.totalRevenue), colX[2] + 2, y + 4.8);
        doc.text(fmt(product.totalCost), colX[3] + 2, y + 4.8);
        doc.setTextColor(...(isProfit ? green : red));
        doc.setFont('helvetica', 'bold');
        doc.text(fmt(product.totalProfit), colX[4] + 2, y + 4.8);
        doc.setTextColor(isProfit ? 22 : 220, isProfit ? 163 : 38, isProfit ? 74 : 38);
        doc.text(`${margin}%`, colX[5] + 2, y + 4.8);
        y += 7;
  
        // Batch breakdown
        if (product.batches && product.batches.length > 0) {
          if (y > PAGE_H - 22) { doc.addPage(); addPageHeader('Batch Breakdown (cont.)'); y = 22; }
  
          doc.setFillColor(220, 242, 237);
          doc.rect(MARGIN, y, CONTENT_W, 5.5, 'F');
          doc.setTextColor(...teal);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.text('  FIFO BATCH BREAKDOWN', MARGIN + 2, y + 3.8);
          y += 5.5;
  
          const bCols = ['Batch ID', 'Date Added', 'Cost/Unit', 'Sell/Unit', 'Qty Sold', 'Revenue', 'Cost', 'Profit'];
          const bWidths = [48, 28, 30, 30, 18, 38, 38, 39];
          const bX = [MARGIN + 4];
          bWidths.forEach((w, i) => { if (i < bWidths.length - 1) bX.push(bX[i] + bWidths[i]); });
  
          doc.setFillColor(195, 232, 222);
          doc.rect(MARGIN, y, CONTENT_W, 5.5, 'F');
          doc.setTextColor(...gray);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          bCols.forEach((col, i) => doc.text(col, bX[i], y + 3.8));
          y += 5.5;
  
          product.batches.forEach((batchData, bIdx) => {
            if (y > PAGE_H - 22) { doc.addPage(); addPageHeader('Batch Breakdown (cont.)'); y = 22; }
            const batch = batchData.batch;
            const bp = (batchData.totalProfit || 0) >= 0;
  
            doc.setFillColor(bIdx % 2 === 0 ? 245 : 252, bIdx % 2 === 0 ? 251 : 255, bIdx % 2 === 0 ? 249 : 253);
            doc.rect(MARGIN, y, CONTENT_W, 5.5, 'F');
            doc.setTextColor(...dark);
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.text(String(batch?.id || '-').substring(0, 18), bX[0], y + 3.8);
            doc.text(String(batch?.dateAdded || '-'), bX[1], y + 3.8);
            doc.text(`NGN ${Number(batch?.costPrice || 0).toFixed(2)}`, bX[2], y + 3.8);
            doc.text(`NGN ${Number(batch?.sellingPrice || 0).toFixed(2)}`, bX[3], y + 3.8);
            doc.text(String(batchData.totalSold || 0), bX[4], y + 3.8);
            doc.text(fmt(batchData.totalRevenue), bX[5], y + 3.8);
            doc.text(fmt(batchData.totalCost), bX[6], y + 3.8);
            doc.setTextColor(...(bp ? green : red));
            doc.setFont('helvetica', 'bold');
            doc.text(fmt(batchData.totalProfit), bX[7], y + 3.8);
            y += 5.5;
          });
          y += 3;
        }
      });
  
      // Grand total bar
      if (y > PAGE_H - 22) { doc.addPage(); addPageHeader('Summary'); y = 22; }
      doc.setFillColor(...teal);
      doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text('GRAND TOTAL', colX[0] + 2, y + 5.5);
      doc.text(`${salesReportData.summary?.unitsSold || 0}`, colX[1] + 2, y + 5.5);
      doc.text(fmt(salesReportData.summary?.totalRevenue), colX[2] + 2, y + 5.5);
      doc.text(fmt(salesReportData.summary?.totalCost), colX[3] + 2, y + 5.5);
      doc.text(fmt(salesReportData.summary?.totalProfit), colX[4] + 2, y + 5.5);
      const gm = salesReportData.summary?.totalRevenue > 0
        ? ((salesReportData.summary?.totalProfit / salesReportData.summary?.totalRevenue) * 100).toFixed(1)
        : '0.0';
      doc.text(`${gm}%`, colX[5] + 2, y + 5.5);
  
      // ════════════════════════════════════════
      // PAGE 2 — Top Customers
      // ════════════════════════════════════════
      doc.addPage();
      addPageHeader('Page 2: Customer Analysis');
      y = 24;
  
      doc.setTextColor(...teal);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Analysis', MARGIN, y);
      doc.setDrawColor(...teal);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, y + 1, MARGIN + 42, y + 1);
      y += 6;
  
      // Build customer data from orders in salesReportData
      const customerMap = {};
      (salesReportData.products || []).forEach(product => {
        (product.batches || []).forEach(batchData => {
          (batchData.sales || []).forEach(sale => {
            const name = sale.customerName || sale.customer_name || 'Unknown';
            if (!customerMap[name]) customerMap[name] = { orders: new Set(), revenue: 0, cost: 0, profit: 0, units: 0 };
            customerMap[name].orders.add(sale.orderId || sale.order_id);
            customerMap[name].revenue += sale.revenue || 0;
            customerMap[name].cost += sale.cost || 0;
            customerMap[name].profit += sale.profit || 0;
            customerMap[name].units += sale.quantitySold || sale.quantity_sold || 0;
          });
        });
      });
  
      const customers = Object.entries(customerMap)
        .map(([name, d]) => ({ name, orders: d.orders.size, ...d }))
        .sort((a, b) => b.revenue - a.revenue);
  
      const cCols = ['Customer Name', 'Orders', 'Units Bought', 'Total Revenue', 'Total Cost', 'Gross Profit', 'Margin %'];
      const cWidths = [65, 20, 25, 45, 45, 45, 24];
      const cX = [MARGIN];
      cWidths.forEach((w, i) => { if (i < cWidths.length - 1) cX.push(cX[i] + cWidths[i]); });
  
      doc.setFillColor(...teal);
      doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      cCols.forEach((col, i) => doc.text(col, cX[i] + 2, y + 4.8));
      y += 7;
  
      customers.forEach((c, idx) => {
        if (y > PAGE_H - 18) { doc.addPage(); addPageHeader('Customer Analysis (cont.)'); y = 22; }
        const cm = c.revenue > 0 ? ((c.profit / c.revenue) * 100).toFixed(1) : '0.0';
        const cp = c.profit >= 0;
  
        doc.setFillColor(...(idx % 2 === 0 ? altRow : [255, 255, 255]));
        doc.rect(MARGIN, y, CONTENT_W, 6.5, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...dark);
        doc.text(c.name, cX[0] + 2, y + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.text(String(c.orders), cX[1] + 2, y + 4.5);
        doc.text(String(c.units), cX[2] + 2, y + 4.5);
        doc.text(fmt(c.revenue), cX[3] + 2, y + 4.5);
        doc.text(fmt(c.cost), cX[4] + 2, y + 4.5);
        doc.setTextColor(...(cp ? green : red));
        doc.setFont('helvetica', 'bold');
        doc.text(fmt(c.profit), cX[5] + 2, y + 4.5);
        doc.text(`${cm}%`, cX[6] + 2, y + 4.5);
        y += 6.5;
      });
  
      // Customer totals
      if (y > PAGE_H - 18) { doc.addPage(); addPageHeader('Customer Summary'); y = 22; }
      const totRev = customers.reduce((s, c) => s + c.revenue, 0);
      const totProfit = customers.reduce((s, c) => s + c.profit, 0);
      const totUnits = customers.reduce((s, c) => s + c.units, 0);
      const totOrders = customers.reduce((s, c) => s + c.orders, 0);
      doc.setFillColor(...teal);
      doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL (${customers.length} customers)`, cX[0] + 2, y + 5);
      doc.text(String(totOrders), cX[1] + 2, y + 5);
      doc.text(String(totUnits), cX[2] + 2, y + 5);
      doc.text(fmt(totRev), cX[3] + 2, y + 5);
      doc.text(fmt(totProfit), cX[5] + 2, y + 5);
  
      // ════════════════════════════════════════
      // PAGE 3 — All Sales Transactions
      // ════════════════════════════════════════
      doc.addPage();
      addPageHeader('Page 3: All Sales Transactions');
      y = 24;
  
      doc.setTextColor(...teal);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('All Sales Transactions', MARGIN, y);
      doc.setDrawColor(...teal);
      doc.line(MARGIN, y + 1, MARGIN + 48, y + 1);
      y += 6;
  
      const tCols = ['Date', 'Order ID', 'Customer', 'Product', 'Batch', 'Qty', 'Unit Price', 'Cost/Unit', 'Revenue', 'Profit'];
      const tWidths = [22, 22, 40, 38, 38, 12, 30, 30, 33, 34];
      const tX = [MARGIN];
      tWidths.forEach((w, i) => { if (i < tWidths.length - 1) tX.push(tX[i] + tWidths[i]); });
  
      doc.setFillColor(...teal);
      doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      tCols.forEach((col, i) => doc.text(col, tX[i] + 1, y + 4.8));
      y += 7;
  
      let txnIdx = 0;
      (salesReportData.products || []).forEach(product => {
        (product.batches || []).forEach(batchData => {
          (batchData.sales || []).forEach(sale => {
            if (y > PAGE_H - 18) {
              doc.addPage();
              addPageHeader('Transactions (cont.)');
              y = 22;
            }
  
            const tp = (sale.profit || 0) >= 0;
            doc.setFillColor(...(txnIdx % 2 === 0 ? altRow : [255, 255, 255]));
            doc.rect(MARGIN, y, CONTENT_W, 5.5, 'F');
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...dark);
  
            const dateStr = sale.dateSold || sale.date_sold
              ? new Date(sale.dateSold || sale.date_sold).toLocaleDateString('en-GB')
              : '-';
  
            doc.text(dateStr, tX[0] + 1, y + 3.8);
            doc.text(String(sale.orderId || sale.order_id || '-'), tX[1] + 1, y + 3.8);
            doc.text(String(sale.customerName || sale.customer_name || '-').substring(0, 18), tX[2] + 1, y + 3.8);
            doc.text(product.product.name.substring(0, 16), tX[3] + 1, y + 3.8);
            doc.text(String(batchData.batch?.id || '-').substring(0, 16), tX[4] + 1, y + 3.8);
            doc.text(String(sale.quantitySold || sale.quantity_sold || 0), tX[5] + 1, y + 3.8);
            doc.text(`NGN ${Number(sale.sellingPriceUsed || sale.selling_price_used || 0).toFixed(2)}`, tX[6] + 1, y + 3.8);
            doc.text(`NGN ${Number(sale.costPriceUsed || sale.cost_price_used || 0).toFixed(2)}`, tX[7] + 1, y + 3.8);
            doc.text(fmt(sale.revenue), tX[8] + 1, y + 3.8);
            doc.setTextColor(...(tp ? green : red));
            doc.setFont('helvetica', 'bold');
            doc.text(fmt(sale.profit), tX[9] + 1, y + 3.8);
            y += 5.5;
            txnIdx++;
          });
        });
      });
  
      // Transactions total
      if (y > PAGE_H - 18) { doc.addPage(); addPageHeader('Transactions Summary'); y = 22; }
      doc.setFillColor(...teal);
      doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL TRANSACTIONS: ${txnIdx}`, tX[0] + 1, y + 5);
      doc.text(fmt(salesReportData.summary?.totalRevenue), tX[8] + 1, y + 5);
      doc.text(fmt(salesReportData.summary?.totalProfit), tX[9] + 1, y + 5);
  
      addFooter();
      doc.save(`sales-report-${new Date().toISOString().split('T')[0]}.pdf`);
    };
  
    document.head.appendChild(script);
  };
  const handleConfirmPayment = async (orderId, paymentReference, paymentProof) => {
    try {
      setLoading(true);
      const result = await apiCall(`/orders/${orderId}/confirm-payment`, {
        method: 'POST',
        body: JSON.stringify({
          paymentReference: paymentReference,
          paymentProof: paymentProof
        })
      });
      
      if (result.ok) {
        const updatedOrders = await fetchOrders();
        await fetchShipping();
        await fetchCustomers();
        // If viewing a customer, refresh their order history so payment proof appears
        if (selectedCustomer) {
          const customerSpecificOrders = updatedOrders.filter(
            (o) => o.customerName === selectedCustomer
          );
          setCustomerOrders(customerSpecificOrders);
        }
        setShowModal(false);
        setOrderStep('details');
        setPendingOrder(null);
        setCustomerSearchQuery('');
        setSelectedCustomerData(null);
        setPaymentProofPreview(null);
        showToast('Payment confirmed successfully!');
      } else {
        const errorMessage = result.error || 'Failed to confirm payment. Please try again.';
        showToast(errorMessage);
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running.');
        }
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      showToast('Error confirming payment. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShipping = async (orderId, updates) => {
    try {
      const result = await apiCall(`/shipping/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      
      if (result.ok) {
        await fetchShipping();
        // Refresh history if viewing details
        if (selectedShipping && selectedShipping.id === orderId) {
          await fetchShippingHistory(orderId);
        }
        // Note: Inventory is already updated when order is created, not when shipped
      } else {
        const errorMessage = result.error || 'Failed to update shipping. Please try again.';
        showToast(errorMessage);
        if (result.networkError) {
          showToast('Cannot connect to backend. Please ensure Flask is running.');
        }
      }
    } catch (error) {
      console.error('Error updating shipping:', error);
      showToast('Error updating shipping. Please check your connection and try again.');
    }
  };

  const calculateStats = () => {
    if (!inventory || inventory.length === 0) {
      return { totalSold: 0, totalRevenue: 0, profit: 0, totalStock: 0, lowStockCount: 0 };
    }
    const totalSold = inventory.reduce((sum, item) => sum + (item.sold || 0), 0);
    const totalRevenue = inventory.reduce((sum, item) => sum + ((item.sold || 0) * (item.price || 0)), 0);
    const totalCost = inventory.reduce((sum, item) => sum + ((item.sold || 0) * (item.cost || 0)), 0);
    const profit = totalRevenue - totalCost;
    const totalStock = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const lowStockCount = inventory.filter(item => (item.quantity || 0) < 50).length;
    return { totalSold, totalRevenue, profit, totalStock, lowStockCount };
  };

  // Customer-level report data for Reports tab
  const customerReportData = (customers || []).map((customer) => {
    const customerOrdersAll = (orders || []).filter((order) => order.customerName === customer.name);

    const filteredByDate = customerOrdersAll.filter((order) => {
      if (!order.dateCreated) return true;
      const orderDate = new Date(order.dateCreated);
      if (reportCustomerFromDate) {
        const from = new Date(reportCustomerFromDate);
        if (orderDate < from) return false;
      }
      if (reportCustomerToDate) {
        const to = new Date(reportCustomerToDate);
        to.setHours(23, 59, 59, 999);
        if (orderDate > to) return false;
      }
      return true;
    });

    if (filteredByDate.length === 0) {
      return {
        name: customer.name,
        username: customer.username,
        totalSpent: 0,
        totalQuantity: 0,
        totalOrders: 0
      };
    }

    const totals = filteredByDate.reduce(
      (acc, order) => {
        const product = inventory.find((p) => p.id === order.productId);
        const baseTotal = product ? (product.price || 0) * (order.quantity || 0) : 0;
        const amountPaid = order.amountPaid != null ? order.amountPaid : baseTotal;
        acc.totalSpent += amountPaid;
        acc.totalQuantity += order.quantity || 0;
        acc.totalOrders += 1;
        return acc;
      },
      { totalSpent: 0, totalQuantity: 0, totalOrders: 0 }
    );

    return {
      name: customer.name,
      username: customer.username,
      totalSpent: totals.totalSpent,
      totalQuantity: totals.totalQuantity,
      totalOrders: totals.totalOrders
    };
  })
  .filter((row) => {
    if (!row) return false;
    if (row.totalQuantity === 0) return false;
    if (reportCustomerSearch.trim()) {
      const q = reportCustomerSearch.toLowerCase();
      const nameMatch = (row.name || '').toLowerCase().includes(q);
      const usernameMatch = (row.username || '').toLowerCase().includes(q);
      if (!nameMatch && !usernameMatch) return false;
    }
    return true;
  })
  .sort((a, b) => b.totalSpent - a.totalSpent);

  // Extract unique categories from inventory
  const getUniqueCategories = () => {
    const categories = new Set();
    inventory.forEach(item => {
      const category = productCategories[item.id] || item.category || 'Uncategorized';
      categories.add(category);
    });
    return Array.from(categories).sort();
  };

  const filteredInventory = (inventory || []).filter(item => {
    // Search filter
    const matchesSearch = 
      (item.id || '').toLowerCase().includes(inventorySearchQuery.toLowerCase()) ||
      (item.name || '').toLowerCase().includes(inventorySearchQuery.toLowerCase());
    
    // Stock level filter
    const matchesFilter = 
      inventoryFilter === 'all' ? true :
      inventoryFilter === 'low' ? item.quantity > 0 && item.quantity < 50 :
      inventoryFilter === 'out' ? item.quantity === 0 :
      inventoryFilter === 'in' ? item.quantity >= 50 :
      true;
    
    // Category filter
    const itemCategory = productCategories[item.id] || item.category || 'Uncategorized';
    const matchesCategory = selectedCategory === 'all' || itemCategory === selectedCategory;
    
    return matchesSearch && matchesFilter && matchesCategory;
  });

  const tabs = [
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'shipping', label: 'Shipping', icon: Truck, badge: notifications },
    { id: 'productOrders', label: 'Product Orders', icon: ShoppingBag },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    ...(userRole === 'admin' ? [{ id: 'settings', label: 'Settings', icon: Settings }] : []),
  ];

  const statsData = calculateStats();

  // Filter + sort orders in the selected customer's Order History
  const filteredCustomerOrders = (customerOrders || [])
    .filter((order) => {
      // Text search
      if (orderHistorySearch.trim()) {
        const q = orderHistorySearch.toLowerCase();
        const product = inventory.find((p) => p.id === order.productId);
        const matchesText =
          (order.id || '').toLowerCase().includes(q) ||
          (order.productId || '').toLowerCase().includes(q) ||
          (order.invoice || '').toLowerCase().includes(q) ||
          (order.paymentReference || '').toLowerCase().includes(q) ||
          (product?.name || '').toLowerCase().includes(q);
        if (!matchesText) return false;
      }

      // Date range filter (dateCreated is YYYY-MM-DD from backend)
      if (order.dateCreated) {
        const orderDate = new Date(order.dateCreated);
        if (orderHistoryFromDate) {
          const from = new Date(orderHistoryFromDate);
          if (orderDate < from) return false;
        }
        if (orderHistoryToDate) {
          const to = new Date(orderHistoryToDate);
          // Include orders on the "to" date
          to.setHours(23, 59, 59, 999);
          if (orderDate > to) return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      const da = a.dateCreated ? new Date(a.dateCreated) : new Date(0);
      const db = b.dateCreated ? new Date(b.dateCreated) : new Date(0);
      return orderHistorySort === 'oldest' ? da - db : db - da;
    });

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-[#0A0A0A]' : 'bg-[#FAFAF8]'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-40 border-b ${darkMode ? 'bg-[#0F172A]/95 border-[#1f2937]' : 'bg-white/70 backdrop-blur-md border-[#E7E5E0]'} shadow-sm`}>
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
            <img
              src="https://cdn.affluenceglobaldream.com/media/site_logo/1701419965-B88E_crop_-78--p--00_7--p--19_2156--p--00_2148--p--81_0--p--00.png"
              alt="Affluence Global Logo"
              className="w-full h-full object-contain"
            />
            </div>
            <div>
              <h1 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-[#1E293B]'}`}>Affluence Global</h1>
              <p className="text-xs text-[#2FB7A1]">Inventory Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
          {isMobile && userRole === 'admin' && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`p-2 rounded-lg transition ${
                activeTab === 'settings'
                  ? 'bg-[#2FB7A1] text-white'
                  : darkMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/50 hover:bg-[#CBD5E1] text-[#1E293B]'
              }`}
              title="Settings"
            >
              <Settings size={20} />
            </button>
          )}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg transition ${darkMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/50 hover:bg-[#CBD5E1] text-[#1E293B]'}`}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
            className={`max-w-[70px] md:max-w-none md:px-3 py-1.5 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#2FB7A1] focus:outline-none border ${darkMode ? 'bg-white/10 border-white/20 text-white' : 'bg-white/50 border-[#CBD5E1] text-[#1E293B]'}`}
          >
              <option value="admin" className="text-[#0F172A] dark:text-white">Admin</option>
              <option value="staff" className="text-[#0F172A] dark:text-white">Staff</option>
            </select>
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className={`relative p-2 rounded-lg transition ${darkMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/50 hover:bg-[#CBD5E1] text-[#1E293B]'}`}>
                <Bell size={20} />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className={`absolute right-0 mt-2 w-80 rounded-xl shadow-xl z-50 ${darkMode ? 'bg-[#1A1A1A] border border-[#2A2A2A]' : 'bg-white border border-[#E3E8EF]'}`}>
                  <div className="flex justify-between items-center p-4 border-b border-[#E3E8EF] dark:border-[#2A2A2A]">
                    <span className={`font-semibold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>Notifications</span>
                    <button onClick={() => setNotifications(prev => prev.map(n => ({...n, read: true})))} className="text-xs text-[#2FB7A1]">
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-center text-gray-400 py-6 text-sm">No notifications</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`p-3 border-b flex gap-3 items-start ${!n.read ? (darkMode ? 'bg-[#2A2A2A]' : 'bg-[#F5F7FA]') : ''}`}>
                          <span className="text-lg">
                            {n.type === 'warning' ? '⚠️' : n.type === 'success' ? '✅' : n.type === 'error' ? '❌' : 'ℹ️'}
                          </span>
                          <div className="flex-1">
                            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#0F172A]'}`}>{n.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar - Desktop */}
        {!isMobile && (
          <aside className={`w-64 p-4 ${darkMode ? 'bg-[#1A1A1A] text-white' : 'bg-[#E2E8F0] text-[#1E293B]'}`}>
            <nav className="space-y-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    activeTab === tab.id
                      ? darkMode
                        ? 'bg-white/10 text-white border-l-4 border-[#D97706] pl-3'
                        : 'bg-[#2FB7A1] text-white shadow-lg'
                      : darkMode
                      ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                      : 'text-[#1E293B] hover:bg-[#CBD5E1]'
                  }`}
                >
                  <tab.icon size={20} />
                  <span className="font-medium flex-1 text-left">{tab.label}</span>
                  {tab.badge > 0 && (
                    <span className="bg-[#DC2626] text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-4">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {loading && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg">
                  <p className="text-lg">Loading...</p>
                </div>
              </div>
            )}
            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
  <div>
    {/* Header */}
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>Inventory Management</h2>
        <p className="text-sm text-[#64748B] mt-1">{inventory.length} products • ₦{calculateStats().totalRevenue.toFixed(0)} revenue</p>
      </div>
      <div className="flex gap-2">
        {userRole === 'admin' && (
          <>
            <button
              onClick={verifyInventory}
              className="px-4 py-2 border border-[#E3E8EF] rounded-lg hover:bg-[#F5F7FA] transition flex items-center gap-2 text-sm font-medium text-[#64748B] dark:text-gray-400"
            >
              <showToastCircle size={16} />
              {!isMobile && 'Verify Stock'}
            </button>
            <button
              onClick={() => openModal('addInventory')}
              className="bg-[#2FB7A1] text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium hover:bg-[#28a085] transition shadow-sm"
            >
              <Plus size={20} />
              Add Product
            </button>
          </>
        )}
      </div>
    </div>

{/* ── Unified Stats Card ── */}
<div className={`rounded-xl border mb-6 overflow-hidden shadow-sm ${
  darkMode ? 'bg-[#111827] border-[#1f2937]' : 'bg-white border-[#E3E8EF]'
}`}>
  {/* Mobile: 2×2 grid  |  md+: single row */}
  <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 divide-x-0 md:divide-x divide-[#E3E8EF] dark:divide-[#1f2937]">

    {/* ── Total Products ── */}
    <div className={`flex items-center gap-3 px-5 py-4 ${
      darkMode ? '' : 'bg-white'
    }`}>
      <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
        <Package size={18} className="text-blue-600 dark:text-blue-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[#94A3B8] dark:text-gray-500 uppercase tracking-wide leading-none mb-1">
          Products
        </p>
        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 leading-none">
          {inventory.length}
        </p>
      </div>
    </div>

    {/* ── In Stock ── */}
    <div className={`flex items-center gap-3 px-5 py-4 border-l border-[#E3E8EF] dark:border-[#1f2937] ${
      darkMode ? '' : 'bg-white'
    }`}>
      <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
        <TrendingUp size={18} className="text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[#94A3B8] dark:text-gray-500 uppercase tracking-wide leading-none mb-1">
          In Stock
        </p>
        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 leading-none">
          {calculateStats().totalStock.toLocaleString()}
        </p>
      </div>
    </div>

    {/* ── Total Sold ── */}
    <div className={`flex items-center gap-3 px-5 py-4 border-t md:border-t-0 border-l md:border-l border-[#E3E8EF] dark:border-[#1f2937] ${
      darkMode ? '' : 'bg-white'
    }`}>
      <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
        <ShoppingBag size={18} className="text-purple-600 dark:text-purple-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[#94A3B8] dark:text-gray-500 uppercase tracking-wide leading-none mb-1">
          Sold
        </p>
        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 leading-none">
          {calculateStats().totalSold.toLocaleString()}
        </p>
      </div>
    </div>

    {/* ── Low Stock ── */}
    <div className={`flex items-center gap-3 px-5 py-4 border-t md:border-t-0 border-[#E3E8EF] dark:border-[#1f2937] md:border-l ${
      darkMode ? '' : 'bg-white'
    }`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        calculateStats().lowStockCount > 0
          ? 'bg-red-100 dark:bg-red-900/30'
          : 'bg-gray-100 dark:bg-gray-800'
      }`}>
        <showToastCircle
          size={18}
          className={calculateStats().lowStockCount > 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-400 dark:text-gray-600'
          }
        />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[#94A3B8] dark:text-gray-500 uppercase tracking-wide leading-none mb-1">
          Low Stock
        </p>
        <div className="flex items-center gap-2">
          <p className={`text-2xl font-bold leading-none ${
            calculateStats().lowStockCount > 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-400 dark:text-gray-600'
          }`}>
            {calculateStats().lowStockCount}
          </p>
          {calculateStats().lowStockCount > 0 && (
            <span className="text-[10px] font-semibold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded-full animate-pulse">
              Low Stock
            </span>
          )}
        </div>
      </div>
    </div>

  </div>

  {/* ── Thin revenue footer bar ── */}
  <div className={`px-5 py-2.5 border-t flex items-center justify-between ${
    darkMode
      ? 'bg-[#0d1117] border-[#1f2937]'
      : 'bg-[#F8FAFC] border-[#E3E8EF]'
  }`}>
    <span className={`text-[11px] font-medium uppercase tracking-wide ${
      darkMode ? 'text-gray-500' : 'text-[#94A3B8]'
    }`}>
      Total Revenue
    </span>
    <span className={`text-sm font-bold ${
      darkMode ? 'text-[#2FB7A1]' : 'text-[#2FB7A1]'
    }`}>
      ₦{calculateStats().totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  </div>
</div>
{/* ── End Unified Stats Card ── */}

    {/* Search and Filter Bar */}
    <div className={`rounded-xl border p-3 md:p-4 mb-4 shadow-sm ${
      darkMode ? 'bg-[#020617] border-[#1f2937]' : 'bg-white dark:bg-[#1A1A1A] border-[#E3E8EF] dark:border-[#2A2A2A]'
    }`}>
      <div className="flex flex-col gap-3">
        {/* Search and Stock Filter Row */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#64748B] dark:text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by Product ID or Name..."
              value={inventorySearchQuery}
              onChange={(e) => setInventorySearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#2FB7A1] focus:border-transparent text-sm ${darkMode ? 'bg-[#111827] border-[#1f2937] text-white placeholder-gray-500' : 'bg-[#F5F7FA] border-[#E3E8EF] text-[#0F172A]'}`}
            />
          </div>
          <select
            value={inventoryFilter}
            onChange={(e) => setInventoryFilter(e.target.value)}
            className="px-4 py-2.5 border border-[#E3E8EF] rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#2FB7A1] bg-white"
          >
            <option value="all">All Stock</option>
            <option value="in">In Stock (50+)</option>
            <option value="low">Low Stock (&lt;50)</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
        
        {/* Category Filter Buttons */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              selectedCategory === 'all'
                ? 'bg-[#2FB7A1] text-white shadow-sm'
                : darkMode
                ? 'bg-[#1f2937] text-gray-400 hover:bg-[#374151] border border-[#374151]'
                : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#E3E8EF] border border-[#E3E8EF]'
            }`}
          >
            All Categories
            <span className="ml-2 text-xs opacity-75">({inventory.length})</span>
          </button>
          {getUniqueCategories().map(category => {
            const categoryCount = inventory.filter(item => {
              const itemCategory = productCategories[item.id] || item.category || 'Uncategorized';
              return itemCategory === category;
            }).length;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  selectedCategory === category
                    ? 'bg-[#2FB7A1] text-white shadow-sm'
                    : darkMode
                    ? 'bg-[#1f2937] text-gray-400 hover:bg-[#374151] border border-[#374151]'
                    : 'bg-[#F5F7FA] text-[#64748B] hover:bg-[#E3E8EF] border border-[#E3E8EF]'
                }`}
              >
                {category}
                <span className="ml-2 text-xs opacity-75">({categoryCount})</span>
              </button>
            );
          })}
        </div>
        
        {/* Results Count */}
        {filteredInventory.length !== inventory.length && (
          <div className="text-sm text-[#64748B] pt-2 border-t border-[#E3E8EF]">
            Showing {filteredInventory.length} of {inventory.length} products
          </div>
        )}
      </div>
    </div>

    {/* Desktop Table View - Streamlined */}
    {!isMobile ? (
      <div className={`rounded-xl border overflow-hidden shadow-sm ${
        darkMode ? 'bg-[#020617] border-[#1f2937]' : 'bg-white dark:bg-[#1A1A1A] border-[#E3E8EF] dark:border-[#2A2A2A]'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b-2 ${darkMode ? 'bg-[#111827] border-[#1f2937]' : 'bg-gradient-to-r from-[#F5F7FA] to-white border-[#E3E8EF]'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-[#1F3A5F]'}`}>Product Details</th>
                <th className={`px-6 py-4 text-center text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-[#1F3A5F]'}`}>Stock Level</th>
                <th className={`px-6 py-4 text-center text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-[#1F3A5F]'}`}>Performance</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-[#1F3A5F] uppercase tracking-wider">Pricing</th>
                <th className={`px-6 py-4 text-center text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-[#1F3A5F]'}`}>Status</th>
                {userRole === 'staff' && (
                  <th className={`px-6 py-4 text-center text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-[#1F3A5F]'}`}>Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E8EF]">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={userRole === 'staff' ? 6 : 5} className="px-6 py-16 text-center">
                    <Package size={48} className="mx-auto text-[#E3E8EF] mb-3" />
                    <p className="text-[#64748B] font-medium">No products found</p>
                    <p className="text-sm text-[#94A3B8] mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                filteredInventory.map(item => (
                  <tr 
                    key={item.id} 
                    className={`transition cursor-pointer group ${darkMode ? 'hover:bg-[#111827]' : 'hover:bg-[#F5F7FA]'}`} 
                    onClick={() => setSelectedProduct(item)}
                  >
                    {/* Product Details */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#2FB7A1] to-[#1F3A5F] rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {item.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className={`font-semibold group-hover:text-[#2FB7A1] transition ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>{item.name}</div>
                          <div className="text-xs text-[#64748B] font-mono mt-1">ID: {item.id}</div>
                          <div className="text-xs text-[#94A3B8] mt-0.5">Received: {item.dateReceived}</div>
                        </div>
                      </div>
                    </td>

                {/* Stock Level */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-[#0F172A] dark:text-white">{item.quantity ?? 0}</span>
                          <span className="text-xs text-[#64748B] dark:text-gray-400">units</span>
                        </div>
                        <div className="w-full bg-[#E3E8EF] rounded-full h-1.5 max-w-[100px]">
                          <div 
                            className={`h-1.5 rounded-full transition-all ${
                          (item.quantity ?? 0) > 50 ? 'bg-green-500' : 
                          (item.quantity ?? 0) > 20 ? 'bg-yellow-500' : 
                              'bg-red-500'
                            }`}
                        style={{
                          width: `${Math.min(
                            ((item.quantity ?? 0) + (item.sold ?? 0)) > 0
                              ? ((item.quantity ?? 0) / ((item.quantity ?? 0) + (item.sold ?? 0))) * 100
                              : 0,
                            100
                          )}%`
                        }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Performance */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#64748B] dark:text-gray-400">Sold:</span>
                      <span className="font-semibold text-[#2563EB]">{item.sold ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#94A3B8]">Total:</span>
                      <span className="text-xs font-medium text-[#64748B] dark:text-gray-400">
                        {(item.quantity ?? 0) + (item.sold ?? 0)}
                      </span>
                        </div>
                      </div>
                    </td>

                    {/* Pricing */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          className={`font-bold text-lg ${userRole === 'admin' ? 'text-[#2FB7A1] hover:underline' : darkMode ? 'text-white cursor-default' : 'text-[#0F172A] cursor-default'}`}
                          onClick={(e) => {
                            if (userRole !== 'admin') return;
                            e.stopPropagation();
                            setProductToEdit(item);
                            openModal('editProduct');
                          }}
                        >
                          ₦{(item.price ?? 0).toFixed ? item.price.toFixed(2) : Number(item.price ?? 0).toFixed(2)}
                        </button>
                        <div className="text-xs text-[#64748B] dark:text-gray-400">
                          Cost: ₦{(item.cost ?? 0).toFixed ? item.cost.toFixed(2) : Number(item.cost ?? 0).toFixed(2)}
                        </div>
                        <div className="text-xs font-medium text-green-600">
                          {(() => {
                            const price = Number(item.price ?? 0);
                            const cost = Number(item.cost ?? 0);
                            const margin = price - cost;
                            return `Margin: ₦${margin.toFixed(2)}`;
                          })()}
                        </div>
                        {item.label && (
                          <div className="text-[10px] text-[#94A3B8] mt-1">
                            Label: <span className="font-medium text-[#0F172A] dark:text-white">{item.label}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        {item.quantity === 0 ? (
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                            OUT OF STOCK
                          </span>
                        ) : item.quantity < 20 ? (
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                            CRITICAL
                          </span>
                        ) : item.quantity < 50 ? (
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">
                            LOW STOCK
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                            IN STOCK
                          </span>
                        )}
                      </div>
                    </td>
                    {userRole === 'staff' && (
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProductToUpdate(item);
                            openModal('addQuantity');
                          }}
                          className="bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                        >
                          Add Quantity
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
) : (
  // Mobile Card View — compact & scannable
  <div className="space-y-2">
    {filteredInventory.length === 0 ? (
      <div className={`rounded-xl border p-10 text-center ${
        darkMode ? 'bg-[#111827] border-[#1f2937]' : 'bg-white border-[#E3E8EF]'
      }`}>
        <Package size={40} className={`mx-auto mb-3 ${darkMode ? 'text-gray-700' : 'text-[#CBD5E1]'}`} />
        <p className={`font-medium text-sm ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>No products found</p>
        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-600' : 'text-[#94A3B8]'}`}>Try adjusting your search or filters</p>
      </div>
    ) : (
      filteredInventory.map(item => {
        const stockTotal = (item.quantity ?? 0) + (item.sold ?? 0);
        const stockPct   = stockTotal > 0 ? ((item.quantity ?? 0) / stockTotal) * 100 : 0;
        const isOut      = item.quantity === 0;
        const isCritical = !isOut && item.quantity < 20;
        const isLow      = !isOut && !isCritical && item.quantity < 50;
        const isOk       = item.quantity >= 50;

        const statusLabel = isOut      ? 'OUT'  : isCritical ? 'CRIT' : isLow ? 'LOW' : 'OK';
        const statusColor = isOut || isCritical
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : isLow
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';

        const barColor = isOut || isCritical ? 'bg-red-500' : isLow ? 'bg-amber-400' : 'bg-emerald-500';

        const margin = Number(item.price ?? 0) - Number(item.cost ?? 0);

        return (
          <div
            key={item.id}
            onClick={() => setSelectedProduct(item)}
            className={`rounded-xl border overflow-hidden active:scale-[0.99] transition-transform cursor-pointer ${
              darkMode
                ? 'bg-[#111827] border-[#1f2937]'
                : 'bg-white border-[#E3E8EF]'
            }`}
          >
            {/* ── Row 1: avatar + name + status badge ── */}
            <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2FB7A1] to-[#1F3A5F] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {item.name.substring(0, 2).toUpperCase()}
              </div>

              {/* Name + ID */}
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm leading-tight truncate ${
                  darkMode ? 'text-white' : 'text-[#0F172A]'
                }`}>
                  {item.name}
                </p>
                <p className={`text-[11px] font-mono mt-0.5 ${
                  darkMode ? 'text-gray-500' : 'text-[#94A3B8]'
                }`}>
                  {item.id}
                </p>
              </div>

              {/* Status badge */}
              <span className={`text-[10px] font-bold px-2 py-1 rounded-md flex-shrink-0 ${statusColor} ${
                isCritical ? 'animate-pulse' : ''
              }`}>
                {statusLabel}
              </span>
            </div>

            {/* ── Stock progress bar ── */}
            <div className="px-4 pb-2">
              <div className={`w-full h-1.5 rounded-full ${darkMode ? 'bg-gray-800' : 'bg-[#F1F5F9]'}`}>
                <div
                  className={`h-1.5 rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(stockPct, 100)}%` }}
                />
              </div>
            </div>

            {/* ── Row 2: three inline stats ── */}
            <div className={`flex items-center divide-x px-0 pb-3 ${
              darkMode ? 'divide-[#1f2937]' : 'divide-[#F1F5F9]'
            }`}>
              {/* Stock */}
              <div className="flex-1 text-center px-3">
                <p className={`text-[10px] uppercase tracking-wide font-medium mb-0.5 ${
                  darkMode ? 'text-gray-500' : 'text-[#94A3B8]'
                }`}>Stock</p>
                <p className={`text-base font-bold leading-none ${
                  darkMode ? 'text-white' : 'text-[#0F172A]'
                }`}>
                  {item.quantity ?? 0}
                </p>
              </div>

              {/* Sold */}
              <div className="flex-1 text-center px-3">
                <p className={`text-[10px] uppercase tracking-wide font-medium mb-0.5 ${
                  darkMode ? 'text-gray-500' : 'text-[#94A3B8]'
                }`}>Sold</p>
                <p className="text-base font-bold leading-none text-[#2FB7A1]">
                  {item.sold ?? 0}
                </p>
              </div>

              {/* Price */}
              <div className="flex-1 text-center px-3">
                <p className={`text-[10px] uppercase tracking-wide font-medium mb-0.5 ${
                  darkMode ? 'text-gray-500' : 'text-[#94A3B8]'
                }`}>Price</p>
                <p className={`text-base font-bold leading-none ${
                  darkMode ? 'text-white' : 'text-[#0F172A]'
                }`}>
                  ₦{Number(item.price ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* ── Footer: date + margin ── */}
            <div className={`flex items-center justify-between px-4 py-2 border-t ${
              darkMode
                ? 'bg-[#0d1117] border-[#1f2937]'
                : 'bg-[#F8FAFC] border-[#F1F5F9]'
            }`}>
              <span className={`text-[11px] ${darkMode ? 'text-gray-600' : 'text-[#94A3B8]'}`}>
                {item.dateReceived}
              </span>
              <span className={`text-[11px] font-semibold ${
                margin >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500 dark:text-red-400'
              }`}>
                Margin ₦{margin.toFixed(0)}
              </span>
            </div>

            {/* ── Staff: Add Quantity button ── */}
            {userRole === 'staff' && (
              <div className={`px-4 pb-3 pt-2 border-t ${
                darkMode ? 'border-[#1f2937]' : 'border-[#F1F5F9]'
              }`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setProductToUpdate(item);
                    openModal('addQuantity');
                  }}
                  className="w-full bg-[#2563EB] hover:bg-blue-700 active:bg-blue-800 text-white py-2 rounded-lg text-sm font-medium transition"
                >
                  + Add Quantity
                </button>
              </div>
            )}
          </div>
        );
      })
    )}
  </div>
)}
  </div>
)}
            {/* Customers Tab */}
            {activeTab === 'customers' && (
  <div>
    {!selectedCustomer ? (
      // ── Customer List View ──────────────────────────────────────
      <>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
              Customers
            </h2>
            <p className={`text-sm mt-0.5 ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
              {(() => {
                const uniqueCustomers = new Set(orders.map(o => o.customerName));
                return `${uniqueCustomers.size} customers · ${orders.length} total orders`;
              })()}
            </p>
          </div>
          <button
            onClick={() => openModal('addOrder')}
            className="inline-flex items-center gap-2 bg-[#2FB7A1] text-white px-4 py-2.5 rounded-xl font-medium hover:bg-[#28a085] transition shadow-sm text-sm"
          >
            <Plus size={18} />
            New Order
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}
            size={17}
          />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition focus:ring-2 focus:ring-[#2FB7A1] focus:border-transparent ${
              darkMode
                ? 'bg-[#111827] border-[#1f2937] text-white placeholder-gray-500'
                : 'bg-white border-[#E3E8EF] text-[#0F172A] placeholder-[#94A3B8]'
            }`}
          />
        </div>

        {/* Customer Grid */}
        {(() => {
          let customersList = [];

          if (customers && customers.length > 0) {
            customersList = customers.map(customer => ({
              ...customer,
              orders: orders.filter(o => o.customerName === customer.name),
              lastOrderDate: customer.lastOrderDate ? new Date(customer.lastOrderDate) : null,
            }));
          } else {
            const customersMap = {};
            orders.forEach(order => {
              if (!customersMap[order.customerName]) {
                customersMap[order.customerName] = {
                  name: order.customerName,
                  orders: [],
                  totalSpent: 0,
                  totalOrders: 0,
                  lastOrderDate: null,
                };
              }
              customersMap[order.customerName].orders.push(order);
              customersMap[order.customerName].totalOrders += 1;
              const product = inventory.find(p => p.id === order.productId);
              if (product) customersMap[order.customerName].totalSpent += product.price * order.quantity;
              const orderDate = new Date(order.dateCreated);
              if (!customersMap[order.customerName].lastOrderDate || orderDate > customersMap[order.customerName].lastOrderDate) {
                customersMap[order.customerName].lastOrderDate = orderDate;
              }
            });
            customersList = Object.values(customersMap);
          }

          const filtered = customersList
            .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => {
              const da = a.lastOrderDate ? new Date(a.lastOrderDate) : new Date(0);
              const db = b.lastOrderDate ? new Date(b.lastOrderDate) : new Date(0);
              return db - da;
            });

          if (filtered.length === 0) {
            return (
              <div className={`rounded-2xl border p-12 text-center ${darkMode ? 'bg-[#111827] border-[#1f2937]' : 'bg-white border-[#E3E8EF]'}`}>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${darkMode ? 'bg-[#1f2937]' : 'bg-[#F1F5F9]'}`}>
                  <Users size={26} className={darkMode ? 'text-gray-500' : 'text-[#94A3B8]'} />
                </div>
                <p className={`font-semibold ${darkMode ? 'text-gray-300' : 'text-[#0F172A]'}`}>
                  {searchQuery ? 'No customers found' : 'No customers yet'}
                </p>
                <p className={`text-sm mt-1 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
                  {searchQuery ? 'Try a different search term' : 'Create your first order to add a customer'}
                </p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((customer) => {
                const lastDate = customer.lastOrderDate
                  ? (customer.lastOrderDate instanceof Date ? customer.lastOrderDate : new Date(customer.lastOrderDate))
                  : null;
                const initials = customer.name.substring(0, 2).toUpperCase();
                const orderCount = customer.totalOrders || customer.orders?.length || 0;
                const spent = customer.totalSpent || 0;

                // Pick avatar gradient based on name hash
                const gradients = [
                  'from-[#2FB7A1] to-[#1F3A5F]',
                  'from-[#6366F1] to-[#2FB7A1]',
                  'from-[#F59E0B] to-[#EF4444]',
                  'from-[#8B5CF6] to-[#3B82F6]',
                  'from-[#10B981] to-[#0EA5E9]',
                ];
                const gradientIndex = customer.name.charCodeAt(0) % gradients.length;
                const gradient = gradients[gradientIndex];

                return (
                  <div
                    key={customer.name}
                    onClick={() => {
                      setSelectedCustomer(customer.name);
                      setCustomerOrders(customer.orders);
                    }}
                    className={`group relative rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden ${
                      darkMode
                        ? 'bg-[#111827] border-[#1f2937] hover:border-[#2FB7A1]/50 hover:shadow-lg hover:shadow-[#2FB7A1]/5'
                        : 'bg-white border-[#E3E8EF] hover:border-[#2FB7A1]/40 hover:shadow-lg hover:shadow-black/5'
                    }`}
                  >
                    {/* Top accent bar */}
                    <div className={`h-1 w-full bg-gradient-to-r ${gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />

                    <div className="p-4">
                      {/* Avatar + Name row */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm`}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold truncate leading-tight ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                            {customer.name}
                          </p>
                          {customer.username && (
                            <p className={`text-xs truncate mt-0.5 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
                              @{customer.username}
                            </p>
                          )}
                        </div>
                        <ChevronRight
                          size={16}
                          className={`flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${darkMode ? 'text-gray-600' : 'text-[#CBD5E1]'}`}
                        />
                      </div>

                      {/* Stats row */}
                      <div className={`flex items-center divide-x rounded-xl overflow-hidden ${
                        darkMode ? 'bg-[#0d1117] divide-[#1f2937]' : 'bg-[#F8FAFC] divide-[#E3E8EF]'
                      }`}>
                        <div className="flex-1 px-3 py-2.5 text-center">
                          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
                            Orders
                          </p>
                          <p className={`text-base font-bold leading-none ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                            {orderCount}
                          </p>
                        </div>
                        <div className="flex-1 px-3 py-2.5 text-center">
                          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
                            Spent
                          </p>
                          <p className="text-base font-bold leading-none text-[#2FB7A1]">
                            ₦{spent >= 1000 ? `${(spent / 1000).toFixed(1)}k` : spent.toFixed(0)}
                          </p>
                        </div>
                        <div className="flex-1 px-3 py-2.5 text-center">
                          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
                            Last Order
                          </p>
                          <p className={`text-[11px] font-semibold leading-none ${darkMode ? 'text-gray-300' : 'text-[#64748B]'}`}>
                            {lastDate
                              ? lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Contact pills */}
                      {(customer.phone || customer.email) && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {customer.phone && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${
                              darkMode ? 'bg-[#1f2937] text-gray-400' : 'bg-[#F1F5F9] text-[#64748B]'
                            }`}>
                              📞 {customer.phone}
                            </span>
                          )}
                          {customer.email && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full truncate max-w-[160px] ${
                              darkMode ? 'bg-[#1f2937] text-gray-400' : 'bg-[#F1F5F9] text-[#64748B]'
                            }`}>
                              ✉ {customer.email}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </>
    ) : (
      // ── Customer Detail View ────────────────────────────────────
      <div>
        {/* Back */}
        <button
          onClick={() => { setSelectedCustomer(null); setCustomerOrders([]); }}
          className={`mb-5 inline-flex items-center gap-1.5 text-sm font-medium transition ${
            darkMode ? 'text-gray-400 hover:text-white' : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <ChevronRight size={16} className="rotate-180" />
          Back to Customers
        </button>

        {/* Profile Card */}
        {(() => {
          const customerInfo = customers.find(c => c.name === selectedCustomer);
          const totalSpentForCustomer = customerOrders.reduce((total, order) => {
            const product = inventory.find(p => p.id === order.productId);
            const base = product ? (product.price || 0) * (order.quantity || 0) : 0;
            return total + (order.amountPaid != null ? order.amountPaid : base);
          }, 0);

          const initials = selectedCustomer.substring(0, 2).toUpperCase();

          return (
            <div className={`rounded-2xl border mb-5 overflow-hidden ${
              darkMode ? 'bg-[#111827] border-[#1f2937]' : 'bg-white border-[#E3E8EF]'
            }`}>
              {/* Gradient header band */}
              <div className="h-16 bg-gradient-to-r from-[#2FB7A1] to-[#1F3A5F] relative">
                <div className="absolute -bottom-7 left-5">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#2FB7A1] to-[#1F3A5F] border-2 border-white dark:border-[#111827] flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {initials}
                  </div>
                </div>
              </div>

              <div className="pt-10 px-5 pb-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                      {selectedCustomer}
                    </h2>
                    {customerInfo?.username && (
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
                        @{customerInfo.username}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => openModal('addOrder')}
                    className="inline-flex items-center gap-2 bg-[#2FB7A1] text-white px-3.5 py-2 rounded-xl text-sm font-medium hover:bg-[#28a085] transition shadow-sm"
                  >
                    <Plus size={15} />
                    New Order
                  </button>
                </div>

                {/* Stats strip */}
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 p-3 rounded-xl ${
                  darkMode ? 'bg-[#0d1117]' : 'bg-[#F8FAFC]'
                }`}>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>Total Orders</p>
                    <p className={`text-lg font-bold mt-0.5 ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>{customerOrders.length}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>Total Spent</p>
                    <p className="text-lg font-bold mt-0.5 text-[#2FB7A1]">₦{totalSpentForCustomer.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                  </div>
                  {customerInfo?.phone && (
                    <div>
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>Phone</p>
                      <p className={`text-sm font-semibold mt-0.5 ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>{customerInfo.phone}</p>
                    </div>
                  )}
                  {customerInfo?.accountNumber && (
                    <div>
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>Account No.</p>
                      <p className={`text-sm font-semibold mt-0.5 ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>{customerInfo.accountNumber}</p>
                    </div>
                  )}
                </div>

                {/* Extra info pills */}
                {(customerInfo?.email || customerInfo?.upline) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {customerInfo?.email && (
                      <span className={`text-xs px-3 py-1.5 rounded-full border ${
                        darkMode ? 'bg-[#1f2937] border-[#374151] text-gray-300' : 'bg-[#F1F5F9] border-[#E3E8EF] text-[#64748B]'
                      }`}>
                        ✉ {customerInfo.email}
                      </span>
                    )}
                    {customerInfo?.upline && (
                      <span className={`text-xs px-3 py-1.5 rounded-full border ${
                        darkMode ? 'bg-[#1f2937] border-[#374151] text-gray-300' : 'bg-[#F1F5F9] border-[#E3E8EF] text-[#64748B]'
                      }`}>
                        👤 Upline: {customerInfo.upline}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Order History */}
        <div>
          {/* History header + filters */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center justify-between">
              <h3 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                Order History
                <span className={`ml-2 text-xs font-normal ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
                  ({filteredCustomerOrders.length})
                </span>
              </h3>
              <select
                value={orderHistorySort}
                onChange={(e) => setOrderHistorySort(e.target.value)}
                className={`text-xs px-3 py-1.5 rounded-lg border focus:ring-2 focus:ring-[#2FB7A1] ${
                  darkMode ? 'bg-[#111827] border-[#1f2937] text-white' : 'bg-white border-[#E3E8EF] text-[#0F172A]'
                }`}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>

            {/* Search + date filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`} />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={orderHistorySearch}
                  onChange={(e) => setOrderHistorySearch(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 rounded-lg text-xs border focus:ring-2 focus:ring-[#2FB7A1] ${
                    darkMode ? 'bg-[#111827] border-[#1f2937] text-white placeholder-gray-500' : 'bg-white border-[#E3E8EF] text-[#0F172A]'
                  }`}
                />
              </div>
              <input
                type="date"
                value={orderHistoryFromDate}
                onChange={(e) => setOrderHistoryFromDate(e.target.value)}
                className={`text-xs px-3 py-2 rounded-lg border focus:ring-2 focus:ring-[#2FB7A1] ${
                  darkMode ? 'bg-[#111827] border-[#1f2937] text-white' : 'bg-white border-[#E3E8EF] text-[#0F172A]'
                }`}
              />
              <input
                type="date"
                value={orderHistoryToDate}
                onChange={(e) => setOrderHistoryToDate(e.target.value)}
                className={`text-xs px-3 py-2 rounded-lg border focus:ring-2 focus:ring-[#2FB7A1] ${
                  darkMode ? 'bg-[#111827] border-[#1f2937] text-white' : 'bg-white border-[#E3E8EF] text-[#0F172A]'
                }`}
              />
            </div>
          </div>

          {/* Orders list */}
          {filteredCustomerOrders.length === 0 ? (
            <div className={`rounded-2xl border p-10 text-center ${darkMode ? 'bg-[#111827] border-[#1f2937]' : 'bg-white border-[#E3E8EF]'}`}>
              <Package size={36} className={`mx-auto mb-3 ${darkMode ? 'text-gray-700' : 'text-[#CBD5E1]'}`} />
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>No orders match this filter</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCustomerOrders.map((order) => {
                const product = inventory.find(p => p.id === order.productId);
                const shipping = order.shipping || {};
                const baseTotal = product ? (product.price || 0) * (order.quantity || 0) : 0;
                const amountPaid = order.amountPaid != null ? order.amountPaid : baseTotal;

                const statusCfg = {
                  shipped:  { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
                  transit:  { label: 'In Transit', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
                  pending:  { label: 'Pending', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
                };
                const st = statusCfg[shipping.status] || statusCfg.pending;

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`rounded-2xl border cursor-pointer transition-all hover:shadow-md overflow-hidden ${
                      darkMode ? 'bg-[#111827] border-[#1f2937] hover:border-[#2FB7A1]/30' : 'bg-white border-[#E3E8EF] hover:border-[#2FB7A1]/30'
                    }`}
                  >
                    {/* Order header bar */}
                    <div className={`flex items-center justify-between px-4 py-3 border-b ${
                      darkMode ? 'bg-[#0d1117] border-[#1f2937]' : 'bg-[#F8FAFC] border-[#E3E8EF]'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className={`font-mono text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
                          #{order.id}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>
                          {st.label}
                        </span>
                        {order.paymentConfirmed && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            Paid
                          </span>
                        )}
                      </div>
                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
                        {order.dateCreated}
                      </span>
                    </div>

                    {/* Order body */}
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product?.image ? (
                          <img src={product.image} alt={product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-[#E3E8EF] dark:border-[#1f2937]" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2FB7A1] to-[#1F3A5F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {product ? product.name.substring(0, 2).toUpperCase() : 'N/A'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm truncate ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                            {product ? product.name : order.productId}
                          </p>
                          <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
                            Qty: {order.quantity} {product ? `· ₦${product.price}/unit` : ''}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`font-bold text-base ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                            ₦{amountPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </p>
                          {order.paymentReference && (
                            <p className={`text-[10px] font-mono mt-0.5 ${darkMode ? 'text-gray-600' : 'text-[#CBD5E1]'}`}>
                              {order.paymentReference}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Extra info row */}
                      {(order.address || shipping.trackingNumber) && (
                        <div className={`flex flex-wrap gap-3 mt-2.5 pt-2.5 border-t text-xs ${
                          darkMode ? 'border-[#1f2937] text-gray-500' : 'border-[#F1F5F9] text-[#94A3B8]'
                        }`}>
                          {order.address && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <MapPin size={11} className="flex-shrink-0" />
                              {order.address}
                            </span>
                          )}
                          {shipping.trackingNumber && (
                            <span className="flex items-center gap-1 font-mono">
                              <Truck size={11} className="flex-shrink-0" />
                              {shipping.trackingNumber}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Confirm payment button */}
                      {!order.paymentConfirmed && (
                        <div className="mt-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingOrder(order);
                              setOrderStep('payment');
                              openModal('addOrder');
                            }}
                            className="w-full py-2 rounded-xl text-xs font-semibold bg-[#2FB7A1]/10 text-[#2FB7A1] border border-[#2FB7A1]/20 hover:bg-[#2FB7A1]/20 transition"
                          >
                            Confirm Payment
                          </button>
                        </div>
                      )}

                      {/* Payment proof */}
                      {order.paymentProof && (
                        <div className="mt-3">
                          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
                            Payment Proof
                          </p>
                          <img
                            src={order.paymentProof}
                            alt="Payment Proof"
                            className="max-h-40 rounded-xl border border-[#E3E8EF] dark:border-[#1f2937] object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    )}
  </div>

)}

{/* Shipping Tab */}
{activeTab === 'shipping' && (
  <div>
    {!selectedShipping ? (
      <>
        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-[#1A1A1A]'}`}>
              Shipping
            </h2>
            <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-500' : 'text-[#6B7280]'}`}>
              {shippingQueue.length} orders · {notifications} pending
            </p>
          </div>
          <button className={`text-xs px-3 py-1.5 rounded-md font-medium border transition ${
            darkMode
              ? 'border-[#2A2A2A] text-gray-400 hover:bg-[#1A1A1A]'
              : 'border-[#D1D5DB] text-[#374151] bg-white hover:bg-[#F9FAFB] shadow-sm'
          }`}>
            Export
          </button>
        </div>

        {/* ── Status Filter — segmented control ── */}
        <div className={`flex mb-5 rounded-lg border overflow-hidden text-xs font-medium ${
          darkMode ? 'border-[#2A2A2A] bg-[#1A1A1A]' : 'border-[#E5E7EB] bg-[#F9FAFB]'
        }`}>
          {[
            { label: 'All',        count: shippingQueue.length },
            { label: 'Pending',    count: shippingQueue.filter(s => s.status === 'pending').length },
            { label: 'In Transit', count: shippingQueue.filter(s => s.status === 'transit').length },
            { label: 'Delivered',  count: shippingQueue.filter(s => s.status === 'shipped').length },
          ].map((tab, i, arr) => (
            <button
              key={tab.label}
              onClick={() => setShippingStatusFilter(tab.label)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 transition whitespace-nowrap
                ${i < arr.length - 1 ? (darkMode ? 'border-r border-[#2A2A2A]' : 'border-r border-[#E5E7EB]') : ''}
                ${shippingStatusFilter === tab.label
                  ? 'bg-[#2FB7A1] text-white'
                  : darkMode ? 'text-gray-400 hover:text-white hover:bg-[#2A2A2A]' : 'text-[#6B7280] hover:text-[#111827] hover:bg-white'
                }
              `}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  darkMode ? 'bg-[#2A2A2A] text-gray-300' : 'bg-[#E5E7EB] text-[#374151]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Empty State ── */}
        {(!shippingQueue || shippingQueue.length === 0) ? (
          <div className={`rounded-lg border p-12 text-center ${
            darkMode ? 'bg-[#111827] border-[#1f2937]' : 'bg-white border-[#E5E7EB]'
          }`}>
            <Truck className={`mx-auto mb-3 ${darkMode ? 'text-gray-700' : 'text-[#D1D5DB]'}`} size={40} />
            <p className={`font-medium text-sm ${darkMode ? 'text-gray-300' : 'text-[#374151]'}`}>
              No orders to fulfill
            </p>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-600' : 'text-[#9CA3AF]'}`}>
              Orders will appear here once created
            </p>
          </div>
        ) : (
          // ── Shipping List with Thread Separators ──
          <div className="relative">
            {/* Vertical thread line running through all cards */}
            <div className={`absolute left-[18px] top-0 bottom-0 w-px ${
              darkMode ? 'bg-[#2A2A2A]' : 'bg-[#E5E7EB]'
            }`} />

            <div className="space-y-0">
            {shippingQueue.filter(ship => {
              if (shippingStatusFilter === 'All') return true;
              if (shippingStatusFilter === 'Pending') return ship.status === 'pending';
              if (shippingStatusFilter === 'In Transit') return ship.status === 'transit';
              if (shippingStatusFilter === 'Delivered') return ship.status === 'shipped';
              return true;
            }).map((ship, index) => {
                const isLocked = ship.status === 'shipped';
                const product  = inventory.find(p => p.id === ship.productId);
                const isLast   = index === shippingQueue.length - 1;

                const statusCfg = {
                  pending: {
                    dot:   'bg-amber-400 ring-amber-100',
                    bar:   'bg-amber-400',
                    badge: darkMode ? 'bg-amber-900/40 text-amber-300 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-200',
                    btnPrimary: darkMode ? 'border-amber-700 text-amber-300 hover:bg-amber-900/20' : 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100',
                    label: 'Pending',
                    pulse: true,
                  },
                  transit: {
                    dot:   'bg-blue-400 ring-blue-100',
                    bar:   'bg-blue-500',
                    badge: darkMode ? 'bg-blue-900/40 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-200',
                    btnPrimary: darkMode ? 'border-blue-700 text-blue-300 hover:bg-blue-900/20' : 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100',
                    label: 'In Transit',
                    pulse: false,
                  },
                  shipped: {
                    dot:   'bg-emerald-400 ring-emerald-100',
                    bar:   'bg-emerald-400',
                    badge: darkMode ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    btnPrimary: '',
                    label: 'Delivered',
                    pulse: false,
                  },
                };
                const st = statusCfg[ship.status] || statusCfg.pending;

                return (
                  <div key={ship.id} className="relative pl-10 pb-4">
                    {/* ── Thread dot ── */}
                    <div className={`absolute left-[11px] top-4 w-4 h-4 rounded-full ${st.dot} ring-4 ${
                      darkMode ? 'ring-[#0d1117]' : 'ring-white'
                    } z-10 flex items-center justify-center ${st.pulse ? 'animate-pulse' : ''}`}>
                    </div>

                    {/* ── Card ── */}
                    <div className={`rounded-lg border overflow-hidden shadow-sm transition-shadow hover:shadow-md ${
                      darkMode ? 'bg-[#111827] border-[#2A2A2A]' : 'bg-white border-[#E5E7EB]'
                    }`}>

                      {/* Status accent bar — top edge */}
                      <div className={`h-[3px] w-full ${st.bar}`} />

                      {/* ── Card Header (tappable) ── */}
                      <div
                        onClick={() => handleShippingClick(ship)}
                        className={`flex items-start gap-3 px-4 pt-3 pb-3 cursor-pointer transition-colors ${
                          darkMode ? 'hover:bg-[#1A1A1A]' : 'hover:bg-[#F9FAFB]'
                        }`}
                      >
                        {/* Avatar */}
                        {product?.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-[#E5E7EB] dark:border-[#2A2A2A] mt-0.5"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#2FB7A1] to-[#1F3A5F] flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5">
                            {(product?.name || 'OR').substring(0, 2).toUpperCase()}
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`font-semibold text-sm leading-tight truncate ${
                                darkMode ? 'text-white' : 'text-[#111827]'
                              }`}>
                                {ship.customerName}
                              </p>
                              <p className={`text-[11px] font-mono mt-0.5 ${
                                darkMode ? 'text-gray-500' : 'text-[#9CA3AF]'
                              }`}>
                                #{ship.id}
                              </p>
                            </div>
                            <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border ${st.badge}`}>
                              {st.label}
                            </span>
                          </div>

                          {/* Product + qty + meta pills */}
                          <div className={`flex flex-wrap items-center gap-1.5 mt-2 text-[11px] ${
                            darkMode ? 'text-gray-400' : 'text-[#6B7280]'
                          }`}>
                            <span className="truncate max-w-[150px]">
                              {product?.name || ship.productId}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded font-semibold ${
                              darkMode ? 'bg-[#1f2937] text-gray-300' : 'bg-[#F3F4F6] text-[#374151]'
                            }`}>
                              ×{ship.quantity}
                            </span>
                            {ship.shippingCost && (
                              <span className={`px-1.5 py-0.5 rounded font-semibold ${
                                darkMode ? 'bg-[#1f2937] text-gray-300' : 'bg-[#F3F4F6] text-[#374151]'
                              }`}>
                                ₦{parseFloat(ship.shippingCost).toFixed(0)}
                              </span>
                            )}
                            {ship.shippingCompany && (
                              <span className="truncate max-w-[80px]">{ship.shippingCompany}</span>
                            )}
                          </div>

                          {/* Tracking + address */}
                          {ship.trackingNumber && (
                            <p className={`font-mono text-[11px] mt-1 truncate ${
                              darkMode ? 'text-gray-500' : 'text-[#9CA3AF]'
                            }`}>
                              {ship.trackingNumber}
                            </p>
                          )}
                          {ship.address && (
                            <p className={`flex items-center gap-1 text-[11px] mt-0.5 truncate ${
                              darkMode ? 'text-gray-500' : 'text-[#9CA3AF]'
                            }`}>
                              <MapPin size={10} className="flex-shrink-0" />
                              {ship.address}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* ── Action Area (unlocked) ── */}
                      {!isLocked && (
                        <div
                          className={`border-t px-4 py-4 ${
                            darkMode
                              ? 'border-[#1f2937] bg-[#0d1117]/60'
                              : 'border-[#F3F4F6] bg-[#F9FAFB]'
                          }`}
                          onClick={e => e.stopPropagation()}
                        >
                          {/* ── Input section label ── */}
                          <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${
                            darkMode ? 'text-gray-600' : 'text-[#9CA3AF]'
                          }`}>
                            Fulfillment Details
                          </p>

                          {/* ── Inputs: tracking full-width, then 2-col for cost+date, carrier full-width ── */}
                          <div className="space-y-2.5">

                            {/* Tracking — full width, most important */}
                            <div>
                              <label className={`block text-[11px] font-medium mb-1 ${
                                darkMode ? 'text-gray-400' : 'text-[#374151]'
                              }`}>
                                Tracking Number
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. NG123456789"
                                value={ship.trackingNumber || ''}
                                onChange={e => handleUpdateShipping(ship.id, { trackingNumber: e.target.value })}
                                className={`w-full px-3 py-2 rounded-md text-sm border outline-none transition focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1] ${
                                  darkMode
                                    ? 'bg-[#111827] border-[#2A2A2A] text-white placeholder-gray-600'
                                    : 'bg-white border-[#D1D5DB] text-[#111827] placeholder-[#9CA3AF] shadow-sm'
                                }`}
                              />
                            </div>

                            {/* Cost + Date side by side */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className={`block text-[11px] font-medium mb-1 ${
                                  darkMode ? 'text-gray-400' : 'text-[#374151]'
                                }`}>
                                  Shipping Cost
                                </label>
                                <div className="relative">
                                  <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none ${
                                    darkMode ? 'text-gray-500' : 'text-[#9CA3AF]'
                                  }`}>₦</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={ship.shippingCost || ''}
                                    onChange={e => handleUpdateShipping(ship.id, { shippingCost: e.target.value })}
                                    className={`w-full pl-6 pr-3 py-2 rounded-md text-sm border outline-none transition focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1] ${
                                      darkMode
                                        ? 'bg-[#111827] border-[#2A2A2A] text-white placeholder-gray-600'
                                        : 'bg-white border-[#D1D5DB] text-[#111827] shadow-sm'
                                    }`}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className={`block text-[11px] font-medium mb-1 ${
                                  darkMode ? 'text-gray-400' : 'text-[#374151]'
                                }`}>
                                  Ship Date
                                </label>
                                <input
                                  type="date"
                                  value={ship.shippingDate || ''}
                                  onChange={e => handleUpdateShipping(ship.id, { shippingDate: e.target.value })}
                                  className={`w-full px-3 py-2 rounded-md text-sm border outline-none transition focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1] ${
                                    darkMode
                                      ? 'bg-[#111827] border-[#2A2A2A] text-white'
                                      : 'bg-white border-[#D1D5DB] text-[#111827] shadow-sm'
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Carrier — full width, optional */}
                            <div>
                              <label className={`block text-[11px] font-medium mb-1 ${
                                darkMode ? 'text-gray-400' : 'text-[#374151]'
                              }`}>
                                Carrier
                                <span className={`ml-1 text-[10px] font-normal ${
                                  darkMode ? 'text-gray-600' : 'text-[#9CA3AF]'
                                }`}>(optional)</span>
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. DHL, FedEx, GIG Logistics"
                                value={ship.shippingCompany || ''}
                                onChange={e => handleUpdateShipping(ship.id, { shippingCompany: e.target.value })}
                                className={`w-full px-3 py-2 rounded-md text-sm border outline-none transition focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1] ${
                                  darkMode
                                    ? 'bg-[#111827] border-[#2A2A2A] text-white placeholder-gray-600'
                                    : 'bg-white border-[#D1D5DB] text-[#111827] placeholder-[#9CA3AF] shadow-sm'
                                }`}
                              />
                            </div>

                            {/* Product label — only if product exists */}
                            {product && (
                              <div>
                                <label className={`block text-[11px] font-medium mb-1 ${
                                  darkMode ? 'text-gray-400' : 'text-[#374151]'
                                }`}>
                                  Product Label
                                  <span className={`ml-1 text-[10px] font-normal ${
                                    darkMode ? 'text-gray-600' : 'text-[#9CA3AF]'
                                  }`}>(optional)</span>
                                </label>
                                <input
                                  type="text"
                                  defaultValue={product.label || ''}
                                  placeholder="e.g. 2kg bag, carton of 12"
                                  onBlur={e => {
                                    const val = e.target.value;
                                    if (val !== (product.label || '')) {
                                      handleUpdateProduct(product.id, { label: val });
                                    }
                                  }}
                                  className={`w-full px-3 py-2 rounded-md text-sm border outline-none transition focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1] ${
                                    darkMode
                                      ? 'bg-[#111827] border-[#2A2A2A] text-white placeholder-gray-600'
                                      : 'bg-white border-[#D1D5DB] text-[#111827] placeholder-[#9CA3AF] shadow-sm'
                                  }`}
                                />
                              </div>
                            )}
                          </div>

                          {/* ── Divider before buttons ── */}
                          <div className={`my-3 border-t ${darkMode ? 'border-[#1f2937]' : 'border-[#E5E7EB]'}`} />

                          {/* ── Action Buttons ── */}
                          <div className="flex gap-2">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleUpdateShipping(ship.id, { status: 'transit' });
                              }}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold border transition ${
                                darkMode
                                  ? 'border-blue-700 text-blue-300 hover:bg-blue-900/20'
                                  : 'border-[#BFDBFE] text-blue-700 bg-blue-50 hover:bg-blue-100'
                              }`}
                            >
                              <Truck size={13} />
                              Mark In Transit
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                if (confirm('Mark as delivered? This will lock the order.')) {
                                  handleUpdateShipping(ship.id, { status: 'shipped' });
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold text-white bg-[#2FB7A1] hover:bg-[#28a085] active:bg-[#239e7a] transition shadow-sm"
                            >
                              <Package size={13} />
                              Mark Delivered
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Completed footer ── */}
                      {isLocked && (
                        <div
                          onClick={() => handleShippingClick(ship)}
                          className={`border-t px-4 py-2.5 flex items-center justify-between cursor-pointer transition ${
                            darkMode
                              ? 'border-[#1f2937] hover:bg-[#1A1A1A]'
                              : 'border-[#F3F4F6] hover:bg-[#F9FAFB]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                              Order fulfilled
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-[#9CA3AF]'}`}>
                              View timeline
                            </span>
                            <ChevronRight size={13} className={darkMode ? 'text-gray-500' : 'text-[#9CA3AF]'} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Thread gap label between cards ── */}
                    {!isLast && (
                      <div className="flex items-center gap-2 mt-2 mb-0 pl-0">
                        <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          darkMode
                            ? 'text-gray-600 border-[#2A2A2A] bg-[#0d1117]'
                            : 'text-[#9CA3AF] border-[#E5E7EB] bg-[#F9FAFB]'
                        }`}>
                          ↓
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    ) : (
      // ── Detail / Timeline View ───────────────────────────────────────────
      <div>
        <button
          onClick={() => { setSelectedShipping(null); setShippingHistory([]); }}
          className={`mb-5 flex items-center gap-1.5 text-sm font-medium transition ${
            darkMode ? 'text-gray-400 hover:text-white' : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          <ChevronRight size={16} className="rotate-180" />
          Back to orders
        </button>

        {/* Summary card */}
        <div className={`rounded-lg border mb-4 overflow-hidden shadow-sm ${
          darkMode ? 'bg-[#111827] border-[#2A2A2A]' : 'bg-white border-[#E5E7EB]'
        }`}>
          <div className={`h-[3px] w-full ${
            selectedShipping.status === 'shipped' ? 'bg-emerald-400' :
            selectedShipping.status === 'transit' ? 'bg-blue-400' : 'bg-amber-400'
          }`} />
          <div className="px-4 py-4">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <p className={`font-semibold text-base ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                  {selectedShipping.customerName}
                </p>
                <p className={`text-[11px] font-mono mt-0.5 ${darkMode ? 'text-gray-500' : 'text-[#9CA3AF]'}`}>
                  #{selectedShipping.id}
                </p>
              </div>
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded border uppercase ${
                selectedShipping.status === 'shipped'
                  ? darkMode ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : selectedShipping.status === 'transit'
                  ? darkMode ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-200'
                  : darkMode ? 'bg-amber-900/30 text-amber-300 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {selectedShipping.status}
              </span>
            </div>

            <div className={`grid grid-cols-2 gap-3 p-3 rounded-lg text-xs ${
              darkMode ? 'bg-[#0d1117]' : 'bg-[#F9FAFB]'
            }`}>
              {[
                { label: 'Product',  value: selectedShipping.productId },
                { label: 'Quantity', value: `${selectedShipping.quantity} units` },
                selectedShipping.trackingNumber  && { label: 'Tracking',  value: selectedShipping.trackingNumber },
                selectedShipping.shippingCost    && { label: 'Cost',      value: `₦${parseFloat(selectedShipping.shippingCost).toFixed(2)}` },
                selectedShipping.shippingCompany && { label: 'Carrier',   value: selectedShipping.shippingCompany },
                selectedShipping.shippingDate    && { label: 'Ship Date', value: selectedShipping.shippingDate },
              ].filter(Boolean).map((item, i) => (
                <div key={i}>
                  <p className={`text-[10px] uppercase tracking-wide font-semibold mb-0.5 ${
                    darkMode ? 'text-gray-500' : 'text-[#9CA3AF]'
                  }`}>{item.label}</p>
                  <p className={`font-medium font-mono truncate ${darkMode ? 'text-gray-200' : 'text-[#111827]'}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {selectedShipping.address && (
              <div className={`flex items-start gap-2 mt-3 p-3 rounded-lg text-xs ${
                darkMode ? 'bg-[#0d1117] text-gray-300' : 'bg-[#F9FAFB] text-[#374151]'
              }`}>
                <MapPin size={12} className={`mt-0.5 flex-shrink-0 ${darkMode ? 'text-gray-500' : 'text-[#9CA3AF]'}`} />
                {selectedShipping.address}
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className={`rounded-lg border overflow-hidden shadow-sm ${
          darkMode ? 'bg-[#111827] border-[#2A2A2A]' : 'bg-white border-[#E5E7EB]'
        }`}>
          <div className={`flex items-center gap-2 px-4 py-3 border-b ${
            darkMode ? 'border-[#2A2A2A]' : 'border-[#F3F4F6]'
          }`}>
            <Clock size={14} className={darkMode ? 'text-gray-400' : 'text-[#9CA3AF]'} />
            <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
              Order timeline
            </h3>
          </div>
          <div className="px-4 py-4">
            {shippingHistory.length === 0 ? (
              <div className="py-8 text-center">
                <Clock className={`mx-auto mb-2 ${darkMode ? 'text-gray-700' : 'text-[#E5E7EB]'}`} size={32} />
                <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-[#9CA3AF]'}`}>No events yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {shippingHistory.map((entry, index) => {
                  const date = entry.timestamp ? new Date(entry.timestamp) : null;
                  const dotColor =
                    entry.status === 'shipped' ? 'bg-emerald-400' :
                    entry.status === 'transit' ? 'bg-blue-400' : 'bg-amber-400';
                  const labelColor =
                    entry.status === 'shipped'
                      ? darkMode ? 'text-emerald-300' : 'text-emerald-700'
                      : entry.status === 'transit'
                      ? darkMode ? 'text-blue-300' : 'text-blue-700'
                      : darkMode ? 'text-amber-300' : 'text-amber-700';

                  return (
                    <div key={entry.id || index} className="relative pl-5">
                      {index < shippingHistory.length - 1 && (
                        <div className={`absolute left-[7px] top-4 bottom-0 w-px ${
                          darkMode ? 'bg-[#2A2A2A]' : 'bg-[#E5E7EB]'
                        }`} />
                      )}
                      <div className={`absolute left-0 top-1 w-3.5 h-3.5 rounded-full ${dotColor} border-2 ${
                        darkMode ? 'border-[#111827]' : 'border-white'
                      } shadow`} />
                      <div className={`rounded-md border px-3 py-2.5 ${
                        darkMode ? 'bg-[#0d1117] border-[#1f2937]' : 'bg-[#F9FAFB] border-[#F3F4F6]'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold capitalize ${labelColor}`}>
                            {entry.status === 'shipped' ? 'Delivered' : entry.status === 'transit' ? 'In Transit' : 'Pending'}
                          </span>
                          {date && (
                            <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-[#9CA3AF]'}`}>
                              {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {' · '}
                              {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div className={`space-y-0.5 text-[11px] ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                          {entry.trackingNumber && <p className="font-mono">{entry.trackingNumber}</p>}
                          {entry.shippingCost && (
                            <p>Cost: <span className="font-semibold">₦{parseFloat(entry.shippingCost).toFixed(2)}</span></p>
                          )}
                          {entry.notes && (
                            <p className={`pt-1 mt-1 border-t ${darkMode ? 'border-[#1f2937]' : 'border-[#E5E7EB]'}`}>
                              {entry.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
)}

{activeTab === 'settings' && userRole === 'admin' && (
  <div>
    <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
      Admin Settings
    </h2>

    {/* Automated Email Reports Card */}
    <div className={`rounded-xl border p-6 mb-6 shadow-sm ${
      darkMode ? 'bg-[#111827] border-[#1f2937]' : 'bg-white border-[#E3E8EF]'
    }`}>
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#E3E8EF] dark:border-[#1f2937]">
        <div className="w-9 h-9 rounded-lg bg-[#2FB7A1]/10 flex items-center justify-center">
          <Bell size={18} className="text-[#2FB7A1]" />
        </div>
        <div>
          <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
            Automated Email Reports
          </h3>
          <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
            Configure automatic PDF report delivery
          </p>
        </div>
      </div>

      <form onSubmit={async (e) => {
        e.preventDefault();
        setLoadingSettings(true);
        setSettingsSaved(false);
        const result = await apiCall('/settings/report', {
          method: 'POST',
          body: JSON.stringify(reportSettings),
        });
        setLoadingSettings(false);
        if (result.ok) {
          setSettingsSaved(true);
          setTimeout(() => setSettingsSaved(false), 3000);
        } else {
          showToast(result.error || 'Failed to save settings.');
        }
      }}>
        <div className="space-y-5">

          {/* Email Input */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${
              darkMode ? 'text-gray-300' : 'text-[#374151]'
            }`}>
              Report Recipient Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={reportSettings.email}
              onChange={(e) => setReportSettings(prev => ({ ...prev, email: e.target.value }))}
              placeholder="admin@yourdomain.com"
              required
              className={`w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-[#2FB7A1] focus:border-transparent transition ${
                darkMode
                  ? 'bg-[#0d1117] border-[#1f2937] text-white placeholder-gray-500'
                  : 'bg-white border-[#E3E8EF] text-[#0F172A] placeholder-[#94A3B8]'
              }`}
            />
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
              PDF reports will be sent to this address automatically
            </p>
          </div>

          {/* Interval Input */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${
              darkMode ? 'text-gray-300' : 'text-[#374151]'
            }`}>
              Send Interval (Days) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="90"
                value={reportSettings.intervalDays}
                onChange={(e) => setReportSettings(prev => ({
                  ...prev,
                  intervalDays: parseInt(e.target.value) || 7
                }))}
                required
                className={`w-32 px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-[#2FB7A1] focus:border-transparent transition text-center font-semibold ${
                  darkMode
                    ? 'bg-[#0d1117] border-[#1f2937] text-white'
                    : 'bg-white border-[#E3E8EF] text-[#0F172A]'
                }`}
              />
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
                days between each report
              </span>
            </div>

            {/* Quick preset buttons */}
            <div className="flex flex-wrap gap-2 mt-2">
              {[1, 3, 7, 14, 30].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setReportSettings(prev => ({ ...prev, intervalDays: d }))}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                    reportSettings.intervalDays === d
                      ? 'bg-[#2FB7A1] text-white border-[#2FB7A1]'
                      : darkMode
                      ? 'border-[#1f2937] text-gray-400 hover:border-[#2FB7A1] hover:text-[#2FB7A1]'
                      : 'border-[#E3E8EF] text-[#64748B] hover:border-[#2FB7A1] hover:text-[#2FB7A1]'
                  }`}
                >
                  {d === 1 ? 'Daily' : d === 7 ? 'Weekly' : d === 14 ? 'Biweekly' : d === 30 ? 'Monthly' : `${d} days`}
                </button>
              ))}
            </div>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
              Reports restart their countdown when the server restarts
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loadingSettings}
              className="px-6 py-2.5 bg-[#2FB7A1] text-white rounded-lg text-sm font-semibold hover:bg-[#28a085] disabled:opacity-50 transition shadow-sm"
            >
              {loadingSettings ? 'Saving...' : 'Save Settings'}
            </button>

            <button
              type="button"
              onClick={async () => {
                const result = await apiCall('/reports/send-email', { method: 'POST' });
                showToast(result.ok ? '✓ Reports sent successfully!' : result.error || 'Failed to send.');
                addNotification('success', 'Email report sent successfully');
              }}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold border transition ${
                darkMode
                  ? 'border-[#1f2937] text-gray-300 hover:bg-[#1f2937]'
                  : 'border-[#E3E8EF] text-[#374151] hover:bg-[#F8FAFC]'
              }`}
            >
              ✉ Send Now
            </button>

            {settingsSaved && (
              <span className="text-sm font-medium text-[#2FB7A1] flex items-center gap-1">
                ✓ Settings saved
              </span>
            )}
          </div>
        </div>
      </form>
    </div>

    {/* Current Settings Summary */}
    <div className={`rounded-xl border p-4 text-sm ${
      darkMode ? 'bg-[#0d1117] border-[#1f2937] text-gray-400' : 'bg-[#F8FAFC] border-[#E3E8EF] text-[#64748B]'
    }`}>
      <p className="font-medium mb-1">Current Configuration</p>
      <p>📧 Reports sending to: <span className={`font-semibold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>{reportSettings.email || 'Not set'}</span></p>
      <p>⏱ Interval: <span className={`font-semibold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>Every {reportSettings.intervalDays} day{reportSettings.intervalDays !== 1 ? 's' : ''}</span></p>
    </div>
  {/* Logout Section */}
{onLogout && (
  <div className={`rounded-xl border p-6 shadow-sm ${
    darkMode ? 'bg-[#111827] border-[#1f2937]' : 'bg-white border-[#E3E8EF]'
  }`}>
    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#E3E8EF] dark:border-[#1f2937]">
      <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
        <svg width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
      </div>
      <div>
        <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
          Session
        </h3>
        <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
          Signed in as <span className="font-semibold capitalize">{userRole}</span>
        </p>
      </div>
    </div>
    <button
      onClick={() => setShowLogoutToast(true)}
      className="px-5 py-2.5 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
    >
      Sign Out
    </button>
  </div>
)}

{/* Logout Toast */}
{showLogoutToast && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
    <div className={`flex items-center gap-4 px-5 py-3.5 rounded-xl shadow-2xl border ${
      darkMode
        ? 'bg-[#111827] border-[#1f2937] text-white'
        : 'bg-white border-[#E3E8EF] text-[#0F172A]'
    }`}>
      {/* Icon */}
      <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center shrink-0">
        <svg width="16" height="16" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
      </div>
      {/* Message */}
      <div className="mr-2">
        <p className="text-sm font-semibold">Sign out?</p>
        <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
          You'll need to log back in to access the portal.
        </p>
      </div>
      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setShowLogoutToast(false)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
            darkMode
              ? 'bg-[#1f2937] hover:bg-[#374151] text-gray-300'
              : 'bg-gray-100 hover:bg-gray-200 text-[#0F172A]'
          }`}
        >
          Cancel
        </button>
        <button
          onClick={() => { setShowLogoutToast(false); onLogout(); }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  </div>
)}
  </div>
)}

            {/* Shipping Tab - END REPLACEMENT HERE */}

            {/* Product Orders Tab */}
            {activeTab === 'productOrders' && (
              <div>
                <h2 className="text-2xl font-semibold text-[#0F172A] mb-6">Product Orders</h2>
                
                {/* Product Search */}
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#64748B] dark:text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Search by Product ID or Name..."
                      value={productSearchQuery}
                      onChange={(e) => handleProductSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-[#E3E8EF] rounded-lg focus:ring-2 focus:ring-[#2FB7A1] focus:border-transparent"
                    />
                  </div>
                  
                  {/* Search Results */}
                  {productSearchQuery && productSearchResults.length > 0 && (
                    <div className="mt-2 bg-white border border-[#E3E8EF] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {productSearchResults.map(product => (
                        <div
                          key={product.id}
                          onClick={() => {
                            fetchProductOrders(product.id);
                            setProductSearchQuery(product.name);
                            setProductSearchResults([]);
                          }}
                          className="p-3 hover:bg-[#F5F7FA] cursor-pointer border-b border-[#E3E8EF] last:border-b-0"
                        >
                          <p className="font-medium text-[#0F172A] dark:text-white">{product.name}</p>
                          <p className="text-sm text-[#64748B] dark:text-gray-400">ID: {product.id}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {productSearchQuery && productSearchResults.length === 0 && (
                    <div className="mt-2 text-sm text-[#64748B] p-3 bg-[#F5F7FA] rounded-lg">
                      No products found
                    </div>
                  )}
                </div>

                {/* Orders by Customer */}
                {Object.keys(selectedProductOrders).length > 0 ? (
                  <div className="space-y-6">
                    {Object.entries(selectedProductOrders).map(([customerName, orders]) => {
                      const totalQuantity = orders.reduce((sum, order) => sum + (order.quantity || 0), 0);
                      return (
                        <div key={customerName} className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-5">
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#E3E8EF]">
                            <div>
                              <h3 className="text-xl font-semibold text-[#0F172A] dark:text-white">{customerName}</h3>
                              <p className="text-sm text-[#64748B] mt-1">
                                {orders.length} order{orders.length !== 1 ? 's' : ''} • Total Quantity: {totalQuantity}
                              </p>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            {orders.map(order => {
                              const shipping = order.shipping || {};
                              const transitDate = shipping.transitDate ? new Date(shipping.transitDate) : null;
                              const shippedDate = shipping.shippedDate ? new Date(shipping.shippedDate) : null;
                              
                              return (
                                <div
                                  key={order.id}
                                  className="bg-[#F5F7FA] rounded-lg p-4 border border-[#E3E8EF] cursor-pointer hover:bg-[#E5E7EB]"
                                  onClick={() => setSelectedOrder(order)}
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                    <div>
                                      <p className="text-xs text-[#64748B] mb-1">Order ID</p>
                                      <p className="font-medium text-[#0F172A] dark:text-white">{order.id}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-[#64748B] mb-1">Quantity</p>
                                      <p className="font-medium text-[#0F172A] dark:text-white">{order.quantity} units</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-[#64748B] mb-1">Order Date</p>
                                      <p className="font-medium text-[#0F172A] dark:text-white">{order.dateCreated || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-[#64748B] mb-1">Status</p>
                                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                        shipping.status === 'shipped' ? 'bg-purple-50 text-[#9333EA]' :
                                        shipping.status === 'transit' ? 'bg-blue-50 text-[#2563EB]' :
                                        'bg-yellow-50 text-[#F59E0B]'
                                      }`}>
                                        {shipping.status ? shipping.status.charAt(0).toUpperCase() + shipping.status.slice(1) : 'Pending'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {transitDate && (
                                    <div className="mb-2">
                                      <p className="text-xs text-[#64748B] mb-1 flex items-center gap-1">
                                        <Truck size={12} />
                                        In Transit Date
                                      </p>
                                      <p className="font-medium text-[#2563EB]">
                                        {transitDate.toLocaleDateString('en-US', { 
                                          year: 'numeric', 
                                          month: 'short', 
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {shippedDate && (
                                    <div className="mb-2">
                                      <p className="text-xs text-[#64748B] mb-1 flex items-center gap-1">
                                        <Package size={12} />
                                        Shipped Date
                                      </p>
                                      <p className="font-medium text-[#9333EA]">
                                        {shippedDate.toLocaleDateString('en-US', { 
                                          year: 'numeric', 
                                          month: 'short', 
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </p>
                                    </div>
                                  )}
                                  
                                  <div className="mt-3 pt-3 border-t border-[#E3E8EF]">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                      {order.address && (
                                        <div>
                                          <p className="text-xs text-[#64748B] mb-1 flex items-center gap-1">
                                            <MapPin size={12} />
                                            Address
                                          </p>
                                          <p className="text-[#0F172A] dark:text-white">{order.address}</p>
                                        </div>
                                      )}
                                      {shipping.trackingNumber && (
                                        <div>
                                          <p className="text-xs text-[#64748B] mb-1">Tracking Number</p>
                                          <p className="text-[#0F172A] font-mono text-xs">{shipping.trackingNumber}</p>
                                        </div>
                                      )}
                                      {order.invoice && (
                                        <div>
                                          <p className="text-xs text-[#64748B] mb-1">Invoice</p>
                                          <p className="text-[#0F172A] dark:text-white">{order.invoice}</p>
                                        </div>
                                      )}
                                      {order.paymentMethod && (
                                        <div>
                                          <p className="text-xs text-[#64748B] mb-1">Payment Method</p>
                                          <p className="text-[#0F172A] capitalize">{order.paymentMethod}</p>
                                        </div>
                                      )}
                                      {shipping.shippingCost && (
                                        <div>
                                          <p className="text-xs text-[#64748B] mb-1">Shipping Cost</p>
                                          <p className="text-[#0F172A] dark:text-white">₦{parseFloat(shipping.shippingCost).toFixed(2)}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : productSearchQuery ? (
                  <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-8 text-center">
                    <p className="text-[#64748B] dark:text-gray-400">No orders found for this product.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-8 text-center">
                    <p className="text-[#64748B] dark:text-gray-400">Search for a product to view all orders.</p>
                  </div>
                )}
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <div>
                <h2 className="text-2xl font-semibold text-[#0F172A] dark:text-white mb-6">Reports</h2>
                
                {/* Report Sub-Tabs Navigation */}
                <div className="mb-6 border-b border-[#E3E8EF] dark:border-[#2A2A2A]">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'customer', label: 'Customer Report' },
                      { id: 'inventory', label: 'Inventory Report' },
                      { id: 'sales', label: 'Sales Report' },
                      { id: 'profit', label: 'Profit & Loss' },
                      { id: 'priceLog', label: 'Price Change Log' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveReportTab(tab.id)}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                          activeReportTab === tab.id
                            ? 'border-[#2FB7A1] text-[#2FB7A1] dark:text-[#2FB7A1]'
                            : 'border-transparent text-[#64748B] hover:text-[#0F172A] dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Report */}
                {activeReportTab === 'customer' && (
                  <div>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                        <p className="text-sm text-[#64748B] dark:text-gray-400 mb-2">Total Customers</p>
                        <p className="text-2xl font-semibold text-[#0F172A] dark:text-white">{customerReportData.length}</p>
                      </div>
                      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                        <p className="text-sm text-[#64748B] dark:text-gray-400 mb-2">Total Revenue</p>
                        <p className="text-2xl font-semibold text-[#0F172A] dark:text-white">
                          ₦{customerReportData.reduce((sum, c) => sum + c.totalSpent, 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                        <p className="text-sm text-[#64748B] dark:text-gray-400 mb-2">Total Quantity Purchased</p>
                        <p className="text-2xl font-semibold text-[#0F172A] dark:text-white">
                          {customerReportData.reduce((sum, c) => sum + c.totalQuantity, 0)}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                        <p className="text-sm text-[#64748B] dark:text-gray-400 mb-2">Average Order Value</p>
                        <p className="text-2xl font-semibold text-[#0F172A] dark:text-white">
                          ₦{customerReportData.length > 0 ? (customerReportData.reduce((sum, c) => sum + c.totalSpent, 0) / customerReportData.reduce((sum, c) => sum + c.totalOrders, 1)).toFixed(2) : '0.00'}
                        </p>
                      </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-4 mb-6">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date From</label>
                          <input
                            type="date"
                            value={reportCustomerFromDate}
                            onChange={(e) => setReportCustomerFromDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] focus:ring-2 focus:ring-[#2FB7A1] bg-white dark:bg-[#1A1A1A] text-[#0F172A] dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date To</label>
                          <input
                            type="date"
                            value={reportCustomerToDate}
                            onChange={(e) => setReportCustomerToDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] focus:ring-2 focus:ring-[#2FB7A1] bg-white dark:bg-[#1A1A1A] text-[#0F172A] dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Min Qty</label>
                          <input
                            type="number"
                            placeholder="Min"
                            className="w-full px-3 py-2 rounded-lg text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] focus:ring-2 focus:ring-[#2FB7A1] bg-white dark:bg-[#1A1A1A] text-[#0F172A] dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Max Qty</label>
                          <input
                            type="number"
                            placeholder="Max"
                            className="w-full px-3 py-2 rounded-lg text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] focus:ring-2 focus:ring-[#2FB7A1] bg-white dark:bg-[#1A1A1A] text-[#0F172A] dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Min Spent</label>
                          <input
                            type="number"
                            placeholder="Min"
                            className="w-full px-3 py-2 rounded-lg text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] focus:ring-2 focus:ring-[#2FB7A1] bg-white dark:bg-[#1A1A1A] text-[#0F172A] dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Max Spent</label>
                          <input
                            type="number"
                            placeholder="Max"
                            className="w-full px-3 py-2 rounded-lg text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] focus:ring-2 focus:ring-[#2FB7A1] bg-white dark:bg-[#1A1A1A] text-[#0F172A] dark:text-white"
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={16} />
                          <input
                            type="text"
                            placeholder="Search by customer name or username..."
                            value={reportCustomerSearch}
                            onChange={(e) => setReportCustomerSearch(e.target.value)}
                            className={`w-full pl-9 pr-4 py-2 rounded-lg text-sm border focus:ring-2 focus:ring-[#2FB7A1] focus:border-transparent ${
                              darkMode
                                ? 'bg-[#111827] border-[#374151] text-white placeholder-gray-500'
                                : 'bg-white border-[#E5E7EB] text-[#0F172A] placeholder-[#9CA3AF]'
                            }`}
                          />
                        </div>
                        <button
                          onClick={() => {
                            setReportCustomerFromDate('');
                            setReportCustomerToDate('');
                            setReportCustomerSearch('');
                          }}
                          className={`px-4 py-2 border rounded-lg text-sm transition ${
                            darkMode
                              ? 'border-[#2A2A2A] text-gray-400 hover:bg-[#2A2A2A]'
                              : 'border-[#E3E8EF] text-[#64748B] hover:bg-gray-50'
                          }`}
                        >
                          Clear Filters
                        </button>
                      </div>
                    
                    </div>

                    {/* Customer Drill-Down View */}
                    {selectedCustomerForDrillDown && (
                      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6 mb-6">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-xl font-semibold text-[#0F172A] dark:text-white">
                              {customerPurchases?.customer?.name || selectedCustomerForDrillDown}
                            </h3>
                            {customerPurchases?.customer && (
                              <div className="mt-2 text-sm text-[#64748B] dark:text-gray-400">
                                {customerPurchases.customer.email && <span>{customerPurchases.customer.email}</span>}
                                {customerPurchases.customer.phone && <span className="ml-4">{customerPurchases.customer.phone}</span>}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setSelectedCustomerForDrillDown(null);
                              setCustomerPurchases(null);
                            }}
                            className="px-4 py-2 text-sm border border-[#E3E8EF] dark:border-[#2A2A2A] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition text-[#0F172A] dark:text-white"
                          >
                            Close
                          </button>
                        </div>

                        {loadingCustomerData ? (
                          <div className="text-center py-8 text-[#64748B] dark:text-gray-400">Loading customer data...</div>
                        ) : customerPurchases ? (
                          <>

                            {/* Customer Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                              <div className="bg-[#F9FAFB] dark:bg-[#2A2A2A] rounded-lg p-4 border border-[#E3E8EF] dark:border-[#2A2A2A]">
                                <p className="text-xs text-[#64748B] dark:text-gray-400 mb-1">Total Revenue</p>
                                <p className="text-xl font-semibold text-[#0F172A] dark:text-white">
                                  ₦{customerPurchases.summary?.totalRevenue?.toFixed(2) || '0.00'}
                                </p>
                              </div>
                              <div className="bg-[#F9FAFB] dark:bg-[#2A2A2A] rounded-lg p-4 border border-[#E3E8EF] dark:border-[#2A2A2A]">
                                <p className="text-xs text-[#64748B] dark:text-gray-400 mb-1">Total Cost (FIFO)</p>
                                <p className="text-xl font-semibold text-[#0F172A] dark:text-white">
                                  ₦{customerPurchases.summary?.totalCost?.toFixed(2) || customerPurchases.summary?.totalCostFifo?.toFixed(2) || '0.00'}
                                </p>
                              </div>
                              <div className="bg-[#F9FAFB] dark:bg-[#2A2A2A] rounded-lg p-4 border border-[#E3E8EF] dark:border-[#2A2A2A]">
                                <p className="text-xs text-[#64748B] dark:text-gray-400 mb-1">Total Profit</p>
                                <p className={`text-xl font-semibold ${(customerPurchases.summary?.totalProfit || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                  ₦{customerPurchases.summary?.totalProfit?.toFixed(2) || '0.00'}
                                </p>
                              </div>
                              <div className="bg-[#F9FAFB] dark:bg-[#2A2A2A] rounded-lg p-4 border border-[#E3E8EF] dark:border-[#2A2A2A]">
                                <p className="text-xs text-[#64748B] dark:text-gray-400 mb-1">First Purchase</p>
                                <p className="text-sm font-medium text-[#0F172A] dark:text-white">
                                  {customerPurchases.customer?.firstOrderDate || '—'}
                                </p>
                              </div>
                              <div className="bg-[#F9FAFB] dark:bg-[#2A2A2A] rounded-lg p-4 border border-[#E3E8EF] dark:border-[#2A2A2A]">
                                <p className="text-xs text-[#64748B] dark:text-gray-400 mb-1">Last Purchase</p>
                                <p className="text-sm font-medium text-[#0F172A] dark:text-white">
                                  {customerPurchases.customer?.lastOrderDate || '—'}
                                </p>
                              </div>
                            </div>

                            {/* Purchase Breakdown Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#F9FAFB] dark:bg-[#2A2A2A]">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Date</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Product</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Batch ID</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Quantity</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Cost Price (FIFO)</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Selling Price</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Revenue</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Profit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {customerPurchases.purchases && customerPurchases.purchases.length > 0 ? (
                                    customerPurchases.purchases.map((purchase, idx) => (
                                      <tr key={purchase.id || idx} className="border-b border-[#F1F5F9] dark:border-[#2A2A2A] hover:bg-[#F9FAFB] dark:hover:bg-[#2A2A2A]">
                                        <td className="px-4 py-3 text-[#0F172A] dark:text-white">{purchase.dateSold || purchase.date || '—'}</td>
                                        <td className="px-4 py-3 text-[#0F172A] dark:text-white font-medium">{purchase.productName || purchase.product?.name || '—'}</td>
                                        <td className="px-4 py-3 text-[#64748B] dark:text-gray-400 font-mono text-xs">{purchase.batchId || purchase.batch?.id || '—'}</td>
                                        <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">{purchase.quantitySold || purchase.quantity || 0}</td>
                                        <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">₦{(purchase.costPriceUsed || purchase.costPriceFifo || purchase.costPrice || 0).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">₦{(purchase.sellingPriceUsed || purchase.sellingPrice || 0).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">₦{(purchase.revenue || 0).toFixed(2)}</td>
                                        <td className={`px-4 py-3 text-right font-semibold ${(purchase.profit || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                          ₦{(purchase.profit || 0).toFixed(2)}
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan="8" className="px-4 py-8 text-center text-[#64748B] dark:text-gray-400">
                                        No purchases found for this customer
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                                {customerPurchases.purchases && customerPurchases.purchases.length > 0 && (
                                  <tfoot>
                                    <tr className="bg-[#F9FAFB] dark:bg-[#2A2A2A] font-bold border-t-2 border-[#E5E7EB] dark:border-[#2A2A2A]">
                                      <td colSpan="6" className="px-4 py-3 text-[#0F172A] dark:text-white">Grand Total</td>
                                      <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">
                                        ₦{customerPurchases.summary?.totalRevenue?.toFixed(2) || '0.00'}
                                      </td>
                                      <td className={`px-4 py-3 text-right ${(customerPurchases.summary?.totalProfit || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                        ₦{customerPurchases.summary?.totalProfit?.toFixed(2) || '0.00'}
                                      </td>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-[#64748B] dark:text-gray-400 mb-4">Customer not found</p>
                            <button
                              onClick={() => {
                                setSelectedCustomerForDrillDown(null);
                                setCustomerPurchases(null);
                              }}
                              className="px-4 py-2 bg-[#2FB7A1] text-white rounded-lg hover:bg-[#28a085] transition"
                            >
                              Go Back
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Customer Table */}
                    {!selectedCustomerForDrillDown && (
                      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#F9FAFB] dark:bg-[#2A2A2A]">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Customer</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Transactions</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Qty Bought</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Total Spent</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Avg Order</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Last Purchase</th>
                              </tr>
                            </thead>
                            <tbody>
                              {customerReportData.length === 0 ? (
                                <tr>
                                  <td colSpan="6" className="px-4 py-8 text-center text-[#64748B] dark:text-gray-400">
                                    No customer data available
                                  </td>
                                </tr>
                              ) : (
                                customerReportData.map((row) => (
                                  <tr 
                                    key={row.name} 
                                    className="border-b border-[#F1F5F9] dark:border-[#2A2A2A] hover:bg-[#F9FAFB] dark:hover:bg-[#2A2A2A] cursor-pointer"
                                    onClick={() => fetchCustomerPurchases(row.name)}
                                  >
                                    <td className="px-4 py-3 text-[#0F172A] dark:text-white font-medium font-bold">{row.name}</td>
                                    <td className="px-4 py-3 text-center text-[#0F172A] dark:text-white">{row.totalOrders}</td>
                                    <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">{row.totalQuantity}</td>
                                    <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white font-semibold">₦{row.totalSpent.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">
                                      ₦{row.totalOrders > 0 ? (row.totalSpent / row.totalOrders).toFixed(2) : '0.00'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-[#64748B] dark:text-gray-400">
                                      {row.lastOrderDate || '—'}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Inventory Report */}
                {activeReportTab === 'inventory' && (
                  <div>
                    {/* Summary Cards */}
                    {inventoryReportData && (
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                        <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                          <p className="text-sm text-[#64748B] dark:text-gray-400 mb-2">Total Products</p>
                          <p className="text-2xl font-semibold text-[#0F172A] dark:text-white">
                            {inventoryReportData.summary?.totalProducts || 0}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                          <p className="text-sm text-[#64748B] dark:text-gray-400 mb-2">Total Batches</p>
                          <p className="text-2xl font-semibold text-[#0F172A] dark:text-white">
                            {inventoryReportData.summary?.totalBatches || 0}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                          <p className="text-sm text-[#64748B] dark:text-gray-400 mb-2">Total Units in Stock</p>
                          <p className="text-2xl font-semibold text-[#0F172A] dark:text-white">
                            {inventoryReportData.summary?.totalUnitsInStock || 0}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                          <p className="text-sm text-[#64748B] dark:text-gray-400 mb-2">Total Inventory Value</p>
                          <p className="text-2xl font-semibold text-[#0F172A] dark:text-white">
                            ₦{inventoryReportData.summary?.totalInventoryValue?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                          <p className="text-sm text-[#64748B] dark:text-gray-400 mb-2">Low Stock Items</p>
                          <p className={`text-2xl font-semibold ${(inventoryReportData.summary?.lowStockCount || 0) > 0 ? 'text-[#DC2626]' : 'text-[#0F172A] dark:text-white'}`}>
                            {inventoryReportData.summary?.lowStockCount || 0}
                          </p>
                          {inventoryReportData.summary?.lowStockThreshold && (
                            <p className="text-xs text-[#64748B] dark:text-gray-400 mt-1">
                              Threshold: &lt; {inventoryReportData.summary.lowStockThreshold}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Inventory Table */}
                    {loadingInventoryReport ? (
                      <div className="text-center py-8 text-[#64748B] dark:text-gray-400">Loading inventory report...</div>
                    ) : inventoryReportData && inventoryReportData.batches ? (
                      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-lg text-[#0F172A] dark:text-white">Batch-Level Inventory</h3>
                          <button
                            onClick={() => {
                              const csv = [
                                ['Product Name', 'Batch ID', 'Date Added', 'Cost Price', 'Selling Price', 'Qty Added', 'Qty Sold', 'Qty Remaining', 'Inventory Value', 'Supplier'].join(','),
                                ...inventoryReportData.batches.map(b => [
                                  b.productName,
                                  b.batchId,
                                  b.dateAdded || '',
                                  b.costPrice,
                                  b.sellingPrice,
                                  b.quantityAdded,
                                  b.quantitySold,
                                  b.quantityRemaining,
                                  b.inventoryValue,
                                  b.supplier || ''
                                ].join(','))
                              ].join('\n');
                              const blob = new Blob([csv], { type: 'text/csv' });
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
                              a.click();
                            }}
                            className="px-4 py-2 text-sm bg-[#2FB7A1] text-white rounded-lg hover:bg-[#28a085] transition"
                          >
                            Export CSV
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#F9FAFB] dark:bg-[#2A2A2A]">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Product Name</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Batch ID</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Date Added</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Cost Price</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Selling Price</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Qty Added</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Qty Sold</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Qty Remaining</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Inventory Value</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Supplier</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inventoryReportData.batches.length > 0 ? (
                                inventoryReportData.batches.map((batch, idx) => (
                                  <tr 
                                    key={batch.batchId || idx} 
                                    className={`border-b border-[#F1F5F9] dark:border-[#2A2A2A] hover:bg-[#F9FAFB] dark:hover:bg-[#2A2A2A] ${batch.isLowStock ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                                  >
                                    <td className="px-4 py-3 text-[#0F172A] dark:text-white font-medium">{batch.productName}</td>
                                    <td className="px-4 py-3 text-[#64748B] dark:text-gray-400 font-mono text-xs">{batch.batchId}</td>
                                    <td className="px-4 py-3 text-[#64748B] dark:text-gray-400">{batch.dateAdded || '—'}</td>
                                    <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">₦{batch.costPrice?.toFixed(2) || '0.00'}</td>
                                    <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">₦{batch.sellingPrice?.toFixed(2) || '0.00'}</td>
                                    <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">{batch.quantityAdded || 0}</td>
                                    <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">{batch.quantitySold || 0}</td>
                                    <td className={`px-4 py-3 text-right font-semibold ${batch.isLowStock ? 'text-[#DC2626]' : 'text-[#0F172A] dark:text-white'}`}>
                                      {batch.quantityRemaining || 0}
                                      {batch.isLowStock && <span className="ml-2 text-xs">⚠️</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white font-semibold">₦{batch.inventoryValue?.toFixed(2) || '0.00'}</td>
                                    <td className="px-4 py-3 text-[#64748B] dark:text-gray-400">{batch.supplier || '—'}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan="10" className="px-4 py-8 text-center text-[#64748B] dark:text-gray-400">
                                    No inventory data available
                                  </td>
                                </tr>
                              )}
                            </tbody>
                            {inventoryReportData.batches.length > 0 && (
                              <tfoot>
                                <tr className="bg-[#F9FAFB] dark:bg-[#2A2A2A] font-bold border-t-2 border-[#E5E7EB] dark:border-[#2A2A2A]">
                                  <td colSpan="8" className="px-4 py-3 text-[#0F172A] dark:text-white">Grand Total</td>
                                  <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">
                                    ₦{inventoryReportData.summary?.totalInventoryValue?.toFixed(2) || '0.00'}
                                  </td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                        <p className="text-center text-[#64748B] dark:text-gray-400">No inventory data available</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Sales Report */}
                {activeReportTab === 'sales' && (
  <div>
    {/* Summary Cards - 2x3 grid on mobile, 5-col on desktop */}
    {salesReportData && (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total Revenue', value: `₦${salesReportData.summary?.totalRevenue?.toFixed(2) || '0.00'}`, color: 'text-[#0F172A] dark:text-white' },
          { label: 'Total COGS (FIFO)', value: `₦${salesReportData.summary?.totalCost?.toFixed(2) || '0.00'}`, color: 'text-[#0F172A] dark:text-white' },
          { label: 'Gross Profit', value: `₦${salesReportData.summary?.totalProfit?.toFixed(2) || '0.00'}`, color: (salesReportData.summary?.totalProfit || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]' },
          { label: 'Net Profit', value: `₦${salesReportData.summary?.totalProfit?.toFixed(2) || '0.00'}`, color: (salesReportData.summary?.totalProfit || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]' },
          { label: 'Units Sold', value: salesReportData.summary?.unitsSold || 0, color: 'text-[#0F172A] dark:text-white', fullWidth: true },
        ].map((card, i) => (
          <div key={i} className={`bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-4 ${card.fullWidth ? 'col-span-2 md:col-span-1' : ''}`}>
            <p className="text-xs text-[#64748B] dark:text-gray-400 mb-1 leading-tight">{card.label}</p>
            <p className={`text-lg md:text-2xl font-semibold ${card.color} leading-tight`}>{card.value}</p>
          </div>
        ))}
      </div>
    )}

    {/* Filters */}
    <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-4 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
          <input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] focus:ring-2 focus:ring-[#2FB7A1] bg-white dark:bg-[#1A1A1A] text-[#0F172A] dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
          <input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] focus:ring-2 focus:ring-[#2FB7A1] bg-white dark:bg-[#1A1A1A] text-[#0F172A] dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Product</label>
          <select value={reportProductFilter} onChange={(e) => setReportProductFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] focus:ring-2 focus:ring-[#2FB7A1] bg-white dark:bg-[#1A1A1A] text-[#0F172A] dark:text-white">
            <option value="">All Products</option>
            {inventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">View</label>
          <select value={reportViewMode} onChange={(e) => setReportViewMode(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] focus:ring-2 focus:ring-[#2FB7A1] bg-white dark:bg-[#1A1A1A] text-[#0F172A] dark:text-white">
            <option value="summary">Summary</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={exportSalesReportPDF} disabled={!salesReportData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2FB7A1] text-white rounded-lg text-sm font-medium hover:bg-[#28a085] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          Export PDF
        </button>
      </div>

    </div>

    {/* Product Table / Cards */}
    {loadingSalesReport ? (
      <div className="text-center py-8 text-[#64748B] dark:text-gray-400">Loading sales report...</div>
    ) : salesReportData && salesReportData.products ? (
      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] overflow-hidden mb-6">

        {/* ── Desktop Table ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#F9FAFB] dark:bg-[#2A2A2A]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Product</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Units Sold</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Revenue</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">COGS (FIFO)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Gross Profit</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Margin %</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {salesReportData.products.map((product) => {
                const margin = product.totalRevenue > 0 ? ((product.totalProfit / product.totalRevenue) * 100) : 0;
                return (
                  <React.Fragment key={product.product.id}>
                    <tr className="border-b border-[#F1F5F9] dark:border-[#2A2A2A] hover:bg-[#F9FAFB] dark:hover:bg-[#2A2A2A]">
                      <td className="px-4 py-3 text-[#0F172A] dark:text-white font-medium cursor-pointer" onClick={() => {
                        setExpandedProductId(expandedProductId === product.product.id ? null : product.product.id);
                        if (expandedProductId !== product.product.id) product.batches?.forEach(b => b.batch?.id && fetchPriceHistory(b.batch.id));
                      }}>{product.product.name}</td>
                      <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">{product.totalSold || 0}</td>
                      <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">₦{product.totalRevenue?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">₦{product.totalCost?.toFixed(2) || '0.00'}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${(product.totalProfit || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>₦{product.totalProfit?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">{margin.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => { setExpandedProductId(expandedProductId === product.product.id ? null : product.product.id); if (expandedProductId !== product.product.id) product.batches?.forEach(b => b.batch?.id && fetchPriceHistory(b.batch.id)); }} className="text-[#2FB7A1] hover:underline text-xs">
                          {expandedProductId === product.product.id ? 'Hide' : 'View'} Details
                        </button>
                      </td>
                    </tr>
                    {expandedProductId === product.product.id && (
                      <tr>
                        <td colSpan="7" className="px-4 py-6 bg-[#F9FAFB] dark:bg-[#2A2A2A]">
                          {/* Batch breakdown - same as before */}
                          <div className="space-y-6">
                            <div>
                              <h4 className="font-semibold text-[#0F172A] dark:text-white mb-4">FIFO Batch Breakdown</h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                                      <th className="text-left px-3 py-2 text-xs font-semibold text-[#64748B] dark:text-gray-400">Batch ID</th>
                                      <th className="text-left px-3 py-2 text-xs font-semibold text-[#64748B] dark:text-gray-400">Date Added</th>
                                      <th className="text-right px-3 py-2 text-xs font-semibold text-[#64748B] dark:text-gray-400">Cost Price</th>
                                      <th className="text-right px-3 py-2 text-xs font-semibold text-[#64748B] dark:text-gray-400">Selling Price</th>
                                      <th className="text-right px-3 py-2 text-xs font-semibold text-[#64748B] dark:text-gray-400">Qty Sold</th>
                                      <th className="text-right px-3 py-2 text-xs font-semibold text-[#64748B] dark:text-gray-400">Revenue</th>
                                      <th className="text-right px-3 py-2 text-xs font-semibold text-[#64748B] dark:text-gray-400">Cost</th>
                                      <th className="text-right px-3 py-2 text-xs font-semibold text-[#64748B] dark:text-gray-400">Profit</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {product.batches && product.batches.length > 0 ? (
                                      product.batches.map((batchData, idx) => {
                                        const batch = batchData.batch;
                                        const isExpanded = expandedBatchId === batch?.id;
                                        return (
                                          <React.Fragment key={idx}>
                                            <tr onClick={() => fetchBatchTransactions(batch?.id, product.product.id)}
                                              className={`border-b border-[#F1F5F9] dark:border-[#2A2A2A] cursor-pointer transition ${isExpanded ? darkMode ? 'bg-[#2FB7A1]/10' : 'bg-[#2FB7A1]/5' : darkMode ? 'hover:bg-[#1f2937]' : 'hover:bg-[#F8FAFC]'}`}>
                                              <td className="px-3 py-2 text-[#0F172A] dark:text-white font-medium">
                                                <div className="flex items-center gap-2">
                                                  <ChevronRight size={13} className={`text-[#2FB7A1] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                                                  {batch?.id || '—'}
                                                </div>
                                              </td>
                                              <td className="px-3 py-2 text-[#64748B] dark:text-gray-400">{batch?.dateAdded || '—'}</td>
                                              <td className="px-3 py-2 text-right text-[#0F172A] dark:text-white">₦{batch?.costPrice?.toFixed(2) || '0.00'}</td>
                                              <td className="px-3 py-2 text-right text-[#0F172A] dark:text-white">₦{batch?.sellingPrice?.toFixed(2) || '0.00'}</td>
                                              <td className="px-3 py-2 text-right text-[#0F172A] dark:text-white">{batchData.totalSold || 0}</td>
                                              <td className="px-3 py-2 text-right text-[#0F172A] dark:text-white">₦{batchData.totalRevenue?.toFixed(2) || '0.00'}</td>
                                              <td className="px-3 py-2 text-right text-[#0F172A] dark:text-white">₦{batchData.totalCost?.toFixed(2) || '0.00'}</td>
                                              <td className={`px-3 py-2 text-right font-semibold ${(batchData.totalProfit || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                                ₦{batchData.totalProfit?.toFixed(2) || '0.00'}
                                                <span className="block text-[10px] font-normal text-[#94A3B8]">excl. pending shipping</span>
                                              </td>
                                            </tr>
                                            {isExpanded && (
                                              <tr>
                                                <td colSpan="8" className={`px-4 py-4 ${darkMode ? 'bg-[#0d1117]' : 'bg-[#F8FAFC]'}`}>
                                                  {loadingBatchTransactions ? (
                                                    <p className="text-center text-sm text-[#64748B] py-4">Loading transactions...</p>
                                                  ) : batchTransactions.length === 0 ? (
                                                    <p className="text-center text-sm text-[#64748B] py-4">No transactions found for this batch.</p>
                                                  ) : (
                                                    <div>
                                                      <p className={`text-xs font-bold uppercase tracking-wide mb-3 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
                                                        {batchTransactions.length} Transaction{batchTransactions.length !== 1 ? 's' : ''} — Batch {batch?.id}
                                                      </p>
                                                      <table className="w-full text-xs">
                                                        <thead>
                                                          <tr className={`border-b ${darkMode ? 'border-[#1f2937]' : 'border-[#E3E8EF]'}`}>
                                                            <th className="text-left px-2 py-2 text-[#64748B] dark:text-gray-400 font-semibold">Order ID</th>
                                                            <th className="text-left px-2 py-2 text-[#64748B] dark:text-gray-400 font-semibold">Customer</th>
                                                            <th className="text-left px-2 py-2 text-[#64748B] dark:text-gray-400 font-semibold">Date</th>
                                                            <th className="text-right px-2 py-2 text-[#64748B] dark:text-gray-400 font-semibold">Qty</th>
                                                            <th className="text-right px-2 py-2 text-[#64748B] dark:text-gray-400 font-semibold">Amount Paid</th>
                                                            <th className="text-left px-2 py-2 text-[#64748B] dark:text-gray-400 font-semibold">Payment</th>
                                                            <th className="text-center px-2 py-2 text-[#64748B] dark:text-gray-400 font-semibold">Status</th>
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {batchTransactions.map((txn, tIdx) => {
                                                            const prod = inventory.find(p => p.id === txn.productId);
                                                            const baseTotal = prod ? (prod.price || 0) * (txn.quantity || 0) : 0;
                                                            const paid = txn.amountPaid != null ? txn.amountPaid : baseTotal;
                                                            const ship = txn.shipping || {};
                                                            return (
                                                              <tr key={txn.id || tIdx} onClick={() => setSelectedOrder(txn)}
                                                                className={`border-b cursor-pointer transition ${darkMode ? 'border-[#1f2937] hover:bg-[#111827]' : 'border-[#F1F5F9] hover:bg-white'}`}>
                                                                <td className="px-2 py-2 font-mono text-[#0F172A] dark:text-white">{txn.id}</td>
                                                                <td className="px-2 py-2 text-[#0F172A] dark:text-white font-medium">{txn.customerName}</td>
                                                                <td className="px-2 py-2 text-[#64748B] dark:text-gray-400">{txn.dateCreated || '—'}</td>
                                                                <td className="px-2 py-2 text-right text-[#0F172A] dark:text-white">{txn.quantity}</td>
                                                                <td className="px-2 py-2 text-right font-semibold text-[#0F172A] dark:text-white">₦{paid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                                <td className="px-2 py-2 text-[#64748B] dark:text-gray-400 capitalize">{txn.paymentMethod || '—'}</td>
                                                                <td className="px-2 py-2 text-center">
                                                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ship.status === 'shipped' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : ship.status === 'transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                                                    {ship.status ? ship.status.charAt(0).toUpperCase() + ship.status.slice(1) : 'Pending'}
                                                                  </span>
                                                                </td>
                                                              </tr>
                                                            );
                                                          })}
                                                        </tbody>
                                                        <tfoot>
                                                          <tr className={`font-bold border-t-2 ${darkMode ? 'border-[#1f2937]' : 'border-[#E3E8EF]'}`}>
                                                            <td colSpan="4" className="px-2 py-2 text-[#0F172A] dark:text-white">Total</td>
                                                            <td className="px-2 py-2 text-right text-[#0F172A] dark:text-white">
                                                              ₦{batchTransactions.reduce((sum, txn) => {
                                                                const prod = inventory.find(p => p.id === txn.productId);
                                                                const base = prod ? (prod.price || 0) * (txn.quantity || 0) : 0;
                                                                return sum + (txn.amountPaid != null ? txn.amountPaid : base);
                                                              }, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                            </td>
                                                            <td colSpan="2"></td>
                                                          </tr>
                                                        </tfoot>
                                                      </table>
                                                    </div>
                                                  )}
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        );
                                      })
                                    ) : (
                                      <tr><td colSpan="8" className="px-3 py-4 text-center text-[#64748B] dark:text-gray-400">No batch data available</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* P&L Overview */}
                            <div className="bg-[#F9FAFB] dark:bg-[#2A2A2A] rounded-lg p-4 border border-[#E3E8EF] dark:border-[#2A2A2A]">
                              <h4 className="font-semibold text-[#0F172A] dark:text-white mb-4">Profit & Loss Overview</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                  { label: 'Total Revenue', value: `₦${product.totalRevenue?.toFixed(2) || '0.00'}`, color: '' },
                                  { label: 'Total COGS (FIFO)', value: `₦${product.totalCost?.toFixed(2) || '0.00'}`, color: '' },
                                  { label: 'Gross Profit', value: `₦${product.totalProfit?.toFixed(2) || '0.00'}`, color: (product.totalProfit || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]' },
                                  { label: 'Margin', value: `${margin.toFixed(1)}%`, color: margin >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]' },
                                ].map((item, i) => (
                                  <div key={i}>
                                    <p className="text-xs text-[#64748B] dark:text-gray-400 mb-1">{item.label}</p>
                                    <p className={`text-lg font-semibold ${item.color || 'text-[#0F172A] dark:text-white'}`}>{item.value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#F9FAFB] dark:bg-[#2A2A2A] font-bold">
                <td className="px-4 py-3 text-[#0F172A] dark:text-white">Grand Total</td>
                <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">{salesReportData.summary?.unitsSold || 0}</td>
                <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">₦{salesReportData.summary?.totalRevenue?.toFixed(2) || '0.00'}</td>
                <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">₦{salesReportData.summary?.totalCost?.toFixed(2) || '0.00'}</td>
                <td className={`px-4 py-3 text-right ${(salesReportData.summary?.totalProfit || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>₦{salesReportData.summary?.totalProfit?.toFixed(2) || '0.00'}</td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Mobile Cards ── */}
        <div className="md:hidden divide-y divide-[#F1F5F9] dark:divide-[#2A2A2A]">
          {salesReportData.products.map((product) => {
            const margin = product.totalRevenue > 0 ? ((product.totalProfit / product.totalRevenue) * 100) : 0;
            const isExpanded = expandedProductId === product.product.id;
            return (
              <div key={product.product.id}>
                {/* Product Card Header */}
                <div
                  onClick={() => {
                    setExpandedProductId(isExpanded ? null : product.product.id);
                    if (!isExpanded) product.batches?.forEach(b => b.batch?.id && fetchPriceHistory(b.batch.id));
                  }}
                  className={`p-4 cursor-pointer transition ${isExpanded ? darkMode ? 'bg-[#2FB7A1]/5' : 'bg-[#2FB7A1]/3' : darkMode ? 'hover:bg-[#111827]' : 'hover:bg-[#F8FAFC]'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>{product.product.name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${margin >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {margin.toFixed(1)}%
                      </span>
                      <ChevronRight size={16} className={`transition-transform text-[#2FB7A1] ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Units Sold', value: product.totalSold || 0, color: '' },
                      { label: 'Revenue', value: `₦${product.totalRevenue?.toFixed(2) || '0.00'}`, color: '' },
                      { label: 'COGS', value: `₦${product.totalCost?.toFixed(2) || '0.00'}`, color: '' },
                      { label: 'Profit', value: `₦${product.totalProfit?.toFixed(2) || '0.00'}`, color: (product.totalProfit || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]' },
                    ].map((stat, i) => (
                      <div key={i} className={`rounded-lg p-2.5 ${darkMode ? 'bg-[#111827]' : 'bg-[#F8FAFC]'}`}>
                        <p className={`text-[10px] font-medium uppercase tracking-wide mb-0.5 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>{stat.label}</p>
                        <p className={`text-sm font-bold ${stat.color || (darkMode ? 'text-white' : 'text-[#0F172A]')}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expanded: Batch Cards on Mobile */}
                {isExpanded && (
                  <div className={`px-4 pb-4 ${darkMode ? 'bg-[#0d1117]' : 'bg-[#F8FAFC]'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest pt-4 pb-2 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>Batch Breakdown</p>
                    <div className="space-y-2">
                      {product.batches && product.batches.length > 0 ? product.batches.map((batchData, idx) => {
                        const batch = batchData.batch;
                        const isBatchExpanded = expandedBatchId === batch?.id;
                        return (
                          <div key={idx} className={`rounded-xl border overflow-hidden ${darkMode ? 'border-[#1f2937]' : 'border-[#E3E8EF]'}`}>
                            <div
                              onClick={() => fetchBatchTransactions(batch?.id, product.product.id)}
                              className={`flex items-center justify-between p-3 cursor-pointer ${darkMode ? 'bg-[#111827]' : 'bg-white'}`}
                            >
                              <div className="min-w-0">
                                <p className={`text-xs font-mono font-semibold truncate ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>{batch?.id || '—'}</p>
                                <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>{batch?.dateAdded || '—'} · {batchData.totalSold || 0} sold</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-xs font-bold ${(batchData.totalProfit || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                  ₦{batchData.totalProfit?.toFixed(0) || '0'}
                                </span>
                                <ChevronRight size={13} className={`transition-transform text-[#2FB7A1] ${isBatchExpanded ? 'rotate-90' : ''}`} />
                              </div>
                            </div>

                            {/* Batch stats row */}
                            <div className={`grid grid-cols-3 divide-x border-t ${darkMode ? 'divide-[#1f2937] border-[#1f2937] bg-[#0d1117]' : 'divide-[#F1F5F9] border-[#F1F5F9] bg-[#F8FAFC]'}`}>
                              {[
                                { label: 'Revenue', value: `₦${batchData.totalRevenue?.toFixed(0) || '0'}` },
                                { label: 'Cost', value: `₦${batchData.totalCost?.toFixed(0) || '0'}` },
                                { label: 'Profit', value: `₦${batchData.totalProfit?.toFixed(0) || '0'}`, profit: (batchData.totalProfit || 0) >= 0 },
                              ].map((s, i) => (
                                <div key={i} className="text-center py-2">
                                  <p className={`text-[9px] font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-600' : 'text-[#94A3B8]'}`}>{s.label}</p>
                                  <p className={`text-xs font-bold ${s.profit !== undefined ? (s.profit ? 'text-[#16A34A]' : 'text-[#DC2626]') : darkMode ? 'text-gray-300' : 'text-[#0F172A]'}`}>{s.value}</p>
                                </div>
                              ))}
                            </div>

                            {/* Transactions */}
                            {isBatchExpanded && (
                              <div className={`border-t ${darkMode ? 'border-[#1f2937] bg-[#020617]' : 'border-[#E3E8EF] bg-[#F8FAFC]'}`}>
                                {loadingBatchTransactions ? (
                                  <p className="text-center text-xs text-[#64748B] py-4">Loading...</p>
                                ) : batchTransactions.length === 0 ? (
                                  <p className="text-center text-xs text-[#64748B] py-4">No transactions</p>
                                ) : (
                                  <div className="p-3 space-y-2">
                                    {batchTransactions.map((txn, tIdx) => {
                                      const prod = inventory.find(p => p.id === txn.productId);
                                      const base = prod ? (prod.price || 0) * (txn.quantity || 0) : 0;
                                      const paid = txn.amountPaid != null ? txn.amountPaid : base;
                                      const ship = txn.shipping || {};
                                      return (
                                        <div key={txn.id || tIdx} onClick={() => setSelectedOrder(txn)}
                                          className={`rounded-lg p-3 cursor-pointer border ${darkMode ? 'bg-[#111827] border-[#1f2937]' : 'bg-white border-[#E3E8EF]'}`}>
                                          <div className="flex justify-between items-start">
                                            <div className="min-w-0">
                                              <p className={`text-xs font-semibold truncate ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>{txn.customerName}</p>
                                              <p className={`text-[10px] font-mono ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>{txn.id} · {txn.dateCreated || '—'}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ship.status === 'shipped' ? 'bg-emerald-100 text-emerald-700' : ship.status === 'transit' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {ship.status ? ship.status.charAt(0).toUpperCase() + ship.status.slice(1) : 'Pending'}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex justify-between mt-1.5">
                                            <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>Qty: {txn.quantity} · {txn.paymentMethod || '—'}</span>
                                            <span className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>₦{paid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {/* Transactions total */}
                                    <div className={`flex justify-between pt-2 border-t ${darkMode ? 'border-[#1f2937]' : 'border-[#E3E8EF]'}`}>
                                      <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>Total ({batchTransactions.length})</span>
                                      <span className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                                        ₦{batchTransactions.reduce((sum, txn) => {
                                          const prod = inventory.find(p => p.id === txn.productId);
                                          const base = prod ? (prod.price || 0) * (txn.quantity || 0) : 0;
                                          return sum + (txn.amountPaid != null ? txn.amountPaid : base);
                                        }, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }) : (
                        <p className={`text-xs text-center py-4 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>No batch data</p>
                      )}
                    </div>

                    {/* P&L mini summary */}
                    <div className={`mt-3 rounded-xl border p-3 ${darkMode ? 'bg-[#111827] border-[#1f2937]' : 'bg-white border-[#E3E8EF]'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>P&L Summary</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Revenue', value: `₦${product.totalRevenue?.toFixed(2) || '0.00'}`, color: '' },
                          { label: 'COGS', value: `₦${product.totalCost?.toFixed(2) || '0.00'}`, color: '' },
                          { label: 'Profit', value: `₦${product.totalProfit?.toFixed(2) || '0.00'}`, color: (product.totalProfit || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]' },
                          { label: 'Margin', value: `${margin.toFixed(1)}%`, color: margin >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]' },
                        ].map((s, i) => (
                          <div key={i}>
                            <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>{s.label}</p>
                            <p className={`text-sm font-semibold ${s.color || (darkMode ? 'text-white' : 'text-[#0F172A]')}`}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Mobile Grand Total */}
          <div className={`p-4 ${darkMode ? 'bg-[#111827]' : 'bg-[#F9FAFB]'}`}>
            <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>Grand Total</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Units Sold', value: salesReportData.summary?.unitsSold || 0, color: '' },
                { label: 'Revenue', value: `₦${salesReportData.summary?.totalRevenue?.toFixed(2) || '0.00'}`, color: '' },
                { label: 'COGS', value: `₦${salesReportData.summary?.totalCost?.toFixed(2) || '0.00'}`, color: '' },
                { label: 'Profit', value: `₦${salesReportData.summary?.totalProfit?.toFixed(2) || '0.00'}`, color: (salesReportData.summary?.totalProfit || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]' },
              ].map((s, i) => (
                <div key={i} className={`rounded-lg p-2.5 ${darkMode ? 'bg-[#1A1A1A]' : 'bg-white border border-[#E3E8EF]'}`}>
                  <p className={`text-[10px] font-medium uppercase tracking-wide mb-0.5 ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>{s.label}</p>
                  <p className={`text-sm font-bold ${s.color || (darkMode ? 'text-white' : 'text-[#0F172A]')}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
        <p className="text-center text-[#64748B] dark:text-gray-400">No sales data available. Sales report will populate as orders are created.</p>
      </div>
    )}
  </div>
)}

                {/* Profit & Loss Report */}
                {activeReportTab === 'profit' && (
                  <div>
                    {/* Summary Cards - now uses FIFO data from salesReportData */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                        <p className="text-sm text-[#64748B] dark:text-gray-400 mb-2">Total Revenue</p>
                        <p className="text-2xl font-semibold text-[#0F172A] dark:text-white">
                          ₦{(salesReportData?.summary?.totalRevenue ?? statsData.totalRevenue).toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                        <p className="text-sm text-[#64748B] dark:text-gray-400 mb-2">Total COGS (FIFO)</p>
                        <p className="text-2xl font-semibold text-[#0F172A] dark:text-white">
                          ₦{(salesReportData?.summary?.totalCost ?? inventory.reduce((sum, item) => sum + (item.sold * item.cost), 0)).toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                        <p className="text-sm text-[#64748B] dark:text-gray-400 mb-2">Gross Profit (FIFO)</p>
                        <p className={`text-2xl font-semibold ${(salesReportData?.summary?.totalProfit ?? statsData.profit) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                          ₦{(salesReportData?.summary?.totalProfit ?? statsData.profit).toFixed(2)}
                        </p>
                        <p className="text-xs text-[#94A3B8] mt-1">
                          ⚠ Excludes unconfirmed shipping costs
                        </p>
                      </div>
                      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                        <p className="text-sm text-[#64748B] dark:text-gray-400 mb-2">Net Profit (FIFO)</p>
                        <p className={`text-2xl font-semibold ${(salesReportData?.summary?.totalProfit ?? statsData.profit) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                          ₦{(salesReportData?.summary?.totalProfit ?? statsData.profit).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Product Breakdown Table */}
                    <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                      <h3 className="font-semibold text-lg text-[#0F172A] dark:text-white mb-4">Per Product Breakdown</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#F9FAFB] dark:bg-[#2A2A2A]">
                              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Product</th>
                              <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Revenue</th>
                              <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">COGS</th>
                              <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">Profit</th>
                            </tr>
                          </thead>
                          <tbody>
                          {inventory.map((item) => {
                          // Use FIFO data from salesReportData if available
                          const fifoProduct = salesReportData?.products?.find(p => p.product.id === item.id);
                          const revenue = fifoProduct ? fifoProduct.totalRevenue : item.sold * item.price;
                          const cogs = fifoProduct ? fifoProduct.totalCost : item.sold * item.cost;
                          const profit = fifoProduct ? fifoProduct.totalProfit : revenue - cogs;
                          return (
                            <tr key={item.id} className="border-b border-[#F1F5F9] dark:border-[#2A2A2A] hover:bg-[#F9FAFB] dark:hover:bg-[#2A2A2A]">
                              <td className="px-4 py-3 text-[#0F172A] dark:text-white font-medium">{item.name}</td>
                              <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">₦{revenue.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">₦{cogs.toFixed(2)}</td>
                              <td className={`px-4 py-3 text-right font-semibold ${profit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                ₦{profit.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-[#F9FAFB] dark:bg-[#2A2A2A] font-bold">
                              <td className="px-4 py-3 text-[#0F172A] dark:text-white">Grand Total</td>
                              <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">
                                ₦{(salesReportData?.summary?.totalRevenue ?? statsData.totalRevenue).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">
                                ₦{(salesReportData?.summary?.totalCost ?? inventory.reduce((sum, item) => sum + (item.sold * item.cost), 0)).toFixed(2)}
                              </td>
                              <td className={`px-4 py-3 text-right ${(salesReportData?.summary?.totalProfit ?? statsData.profit) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                ₦{(salesReportData?.summary?.totalProfit ?? statsData.profit).toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Price Change Log */}
                {activeReportTab === 'priceLog' && (
                  <div>
                    <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-4 mb-6">
                      <div className="flex gap-4 items-center">
                        <select
                          className="flex-1 px-3 py-2 rounded-lg text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] focus:ring-2 focus:ring-[#2FB7A1] bg-white dark:bg-[#1A1A1A] text-[#0F172A] dark:text-white"
                          value={priceLogProductFilter}
                          onChange={(e) => setPriceLogProductFilter(e.target.value)}
                        >
                          <option value="">All Products</option>
                          {inventory.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={fetchPriceChangeLog}
                          className="px-4 py-2 border border-[#E3E8EF] dark:border-[#2A2A2A] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition text-sm"
                        >
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-[#E3E8EF] dark:border-[#2A2A2A] p-6">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[#E3E8EF] dark:border-[#2A2A2A] bg-[#F9FAFB] dark:bg-[#2A2A2A]">
                              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">
                                Product
                              </th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">
                                Batch
                              </th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">
                                Type
                              </th>
                              <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">
                                Old Price
                              </th>
                              <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">
                                New Price
                              </th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">
                                Date Changed
                              </th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase">
                                Changed By
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {loadingPriceChangeLog ? (
                              <tr>
                                <td
                                  colSpan="7"
                                  className="px-4 py-8 text-center text-[#64748B] dark:text-gray-400"
                                >
                                  Loading price change log...
                                </td>
                              </tr>
                            ) : priceChangeLog.length === 0 ? (
                              <tr>
                                <td
                                  colSpan="7"
                                  className="px-4 py-8 text-center text-[#64748B] dark:text-gray-400"
                                >
                                  No price changes found.
                                </td>
                              </tr>
                            ) : (
                              priceChangeLog.map((change) => (
                                <tr
                                  key={change.id}
                                  className="border-b border-[#F1F5F9] dark:border-[#2A2A2A] hover:bg-[#F9FAFB] dark:hover:bg-[#2A2A2A]"
                                >
                                  <td className="px-4 py-3 text-[#0F172A] dark:text-white">
                                    {change.productName || change.productId}
                                  </td>
                                  <td className="px-4 py-3 text-[#0F172A] dark:text-white font-mono text-xs">
                                    {change.batchId}
                                  </td>
                                  <td className="px-4 py-3 text-[#0F172A] dark:text-white capitalize">
                                    {change.changeType}
                                  </td>
                                  <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">
                                    ₦{Number(change.oldPrice).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-right text-[#0F172A] dark:text-white">
                                    ₦{Number(change.newPrice).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-[#0F172A] dark:text-white">
                                    {change.dateChanged
                                      ? new Date(change.dateChanged).toLocaleString()
                                      : ''}
                                  </td>
                                  <td className="px-4 py-3 text-[#0F172A] dark:text-white">
                                    {change.changedBy || 'System'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Bottom Navigation - Mobile */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E3E8EF] z-50 shadow-lg">
            <div className="flex justify-around py-2">
            {tabs.filter(tab => tab.id !== 'settings').map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition relative ${
                    activeTab === tab.id ? 'text-[#2FB7A1]' : 'text-[#64748B]'
                  }`}
                >
                  <tab.icon size={24} />
                  <span className="text-xs font-medium">{tab.label}</span>
                  {tab.badge > 0 && (
                    <span className="absolute top-0 right-0 bg-[#DC2626] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </nav>
        )}
      </div>

      {/* Modals */}
      {showModal && modalType === 'addInventory' && (
        <Modal onClose={() => { setShowModal(false); setImagePreview(null); }} title="Add New Product" darkMode={darkMode} size="xl">
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            // Handle image file
            let imageBase64 = null;
            const imageFile = formData.get('image');
            if (imageFile && imageFile.size > 0) {
              try {
                imageBase64 = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result);
                  reader.onerror = reject;
                  reader.readAsDataURL(imageFile);
                });
              } catch (error) {
                console.error('Error reading image:', error);
                showToast('Error reading image file. Please try again.');
                return;
              }
            }
            
            // Convert FormData to object
            const data = {
              productId: formData.get('productId'),
              productName: formData.get('productName'),
              batchId: formData.get('batchId'),
              category: formData.get('category') || 'Uncategorized',
              description: formData.get('description') || '',
              supplier: formData.get('supplier') || '',
              dateReceived: formData.get('dateReceived'),
              quantity: formData.get('quantity'),
              cost: formData.get('cost'),
              price: formData.get('price'),
              shippingCost: formData.get('shippingCost') || '0',
              image: imageBase64
            };
            
            // Simple manual validation (avoids native HTML5 issues with hidden responsive inputs)
            if (!data.productName || !data.productName.trim()) {
              showToast('Please enter a product name.');
              return;
            }
            if (!data.productId || !data.productId.trim()) {
              showToast('Please enter a product ID.');
              return;
            }
            if (!data.batchId || !data.batchId.trim()) {
              showToast('Please enter a batch ID.');
              return;
            }
            if (!data.dateReceived) {
              showToast('Please select a received date.');
              return;
            }
            const qty = parseFloat(data.quantity);
            if (!data.quantity || Number.isNaN(qty) || qty <= 0) {
              showToast('Please enter a valid quantity greater than 0.');
              return;
            }
            const cost = parseFloat(data.cost);
            if (!data.cost || Number.isNaN(cost) || cost < 0) {
              showToast('Please enter a valid cost per unit.');
              return;
            }
            const price = parseFloat(data.price);
            if (!data.price || Number.isNaN(price) || price < 0) {
              showToast('Please enter a valid selling price.');
              return;
            }

            handleAddInventory(data);
          }}
          onInput={(e) => {
            // Real-time calculation for Total Cost and Profit
            const form = e.currentTarget;
            const costInput = form.querySelector('[name="cost"]') || form.querySelector('#cost-input') || form.querySelector('#cost-input-tablet') || form.querySelector('#cost-input-mobile');
            const shippingInput = form.querySelector('[name="shippingCost"]') || form.querySelector('#shipping-input') || form.querySelector('#shipping-input-tablet') || form.querySelector('#shipping-input-mobile');
            const priceInput = form.querySelector('[name="price"]') || form.querySelector('#price-input') || form.querySelector('#price-input-tablet') || form.querySelector('#price-input-mobile');
            const quantityInput = form.querySelector('[name="quantity"]');
            
            const totalCostDisplay = form.querySelector('#total-cost-display') || form.querySelector('#total-cost-display-tablet') || form.querySelector('#total-cost-display-mobile');
            const profitPerUnitDisplay = form.querySelector('#profit-per-unit-display');
            const totalProfitDisplay = form.querySelector('#total-profit-display');
            
            if (costInput && shippingInput && quantityInput && totalCostDisplay) {
              const cost = parseFloat(costInput.value) || 0;
              const shipping = parseFloat(shippingInput.value) || 0;
              const quantity = parseFloat(quantityInput.value) || 0;
              
              // Calculate shipping per unit (if shipping is per batch)
              const shippingPerUnit = quantity > 0 ? shipping / quantity : 0;
              
              // Total Cost per Unit = Cost per Unit + Shipping per Unit
              const totalCostPerUnit = cost + shippingPerUnit;
              
              totalCostDisplay.value = totalCostPerUnit.toFixed(2);
            }
            
            if (priceInput && totalCostDisplay && profitPerUnitDisplay && totalProfitDisplay && quantityInput) {
              const price = parseFloat(priceInput.value) || 0;
              const totalCostPerUnit = parseFloat(totalCostDisplay.value) || 0;
              const quantity = parseFloat(quantityInput.value) || 0;
              
              // Expected Profit Per Unit = Selling Price - Total Cost
              const profitPerUnit = price - totalCostPerUnit;
              
              // Expected Total Profit = Expected Profit Per Unit × Quantity
              const totalProfit = profitPerUnit * quantity;
              
              profitPerUnitDisplay.value = profitPerUnit.toFixed(2);
              totalProfitDisplay.value = totalProfit.toFixed(2);
              
              // Color coding: green for profit, red for loss
              if (profitPerUnit >= 0) {
                profitPerUnitDisplay.className = profitPerUnitDisplay.className.replace(/text-(red|green)-\d+|text-gray-\d+/g, '') + (darkMode ? ' text-green-400' : ' text-green-600');
                totalProfitDisplay.className = totalProfitDisplay.className.replace(/text-(red|green)-\d+|text-gray-\d+/g, '') + (darkMode ? ' text-green-400' : ' text-green-600');
              } else {
                profitPerUnitDisplay.className = profitPerUnitDisplay.className.replace(/text-(red|green)-\d+|text-gray-\d+/g, '') + (darkMode ? ' text-red-400' : ' text-red-600');
                totalProfitDisplay.className = totalProfitDisplay.className.replace(/text-(red|green)-\d+|text-gray-\d+/g, '') + (darkMode ? ' text-red-400' : ' text-red-600');
              }
            }
          }}>
            <div className="space-y-6">
              {/* BLOCK A: BASIC PRODUCT INFORMATION */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-[#2A2A2A]">
                  <Package className="text-[#2FB7A1]" size={20} />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Product Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input 
                      name="productName" 
                      placeholder="Enter product name" 
                      className={`w-full px-4 py-3 border rounded-lg transition-all ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                      }`}
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <input 
                      name="category" 
                      list="category-options"
                      placeholder="Select or type a category" 
                      className={`w-full px-4 py-3 border rounded-lg transition-all ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                      }`}
                      required 
                    />
                    <datalist id="category-options">
                      {getUniqueCategories().map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input 
                      name="quantity" 
                      type="number" 
                      min="1"
                      placeholder="Enter quantity" 
                      className={`w-full px-4 py-3 border rounded-lg transition-all ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                      }`}
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Supplier
                    </label>
                    <input 
                      name="supplier" 
                      placeholder="Enter supplier name (optional)" 
                      className={`w-full px-4 py-3 border rounded-lg transition-all ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                      }`}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date Added <span className="text-red-500">*</span>
                    </label>
                    <input 
                      name="dateReceived" 
                      type="date" 
                      className={`w-full px-4 py-3 border rounded-lg transition-all ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                      }`}
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Product ID <span className="text-red-500">*</span>
                    </label>
                    <input 
                      name="productId" 
                      placeholder="e.g., PROD-001" 
                      className={`w-full px-4 py-3 border rounded-lg transition-all ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                      }`}
                      required 
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Batch ID <span className="text-red-500">*</span>
                    </label>
                    <input 
                      name="batchId" 
                      placeholder="e.g., BATCH-001" 
                      className={`w-full px-4 py-3 border rounded-lg transition-all ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                      }`}
                      required 
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Unique identifier for this stock batch
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description (Optional)
                    </label>
                    <input 
                      name="description" 
                      placeholder="Product description" 
                      className={`w-full px-4 py-3 border rounded-lg transition-all ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* BLOCK B: PRICING SECTION (HORIZONTAL CARD LAYOUT) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-[#2A2A2A]">
                  <DollarSign className="text-[#2FB7A1]" size={20} />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pricing Section</h3>
                </div>
                
                {/* Highlighted Card with Horizontal Layout */}
                <div className={`p-6 rounded-xl border-2 ${
                  darkMode 
                    ? 'bg-[#1A1A1A]/80 border-[#2FB7A1]/30' 
                    : 'bg-gradient-to-br from-[#F0FDF4] to-[#ECFDF5] border-[#2FB7A1]/20'
                }`}>
                  {/* Desktop: Single Row */}
                  <div className="hidden md:grid md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Cost per Unit <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          name="cost" 
                          id="cost-input"
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0.00" 
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg transition-all ${
                            darkMode 
                              ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                              : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                          }`}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Shipping/Delivery Cost
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          name="shippingCost" 
                          id="shipping-input"
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0.00" 
                          defaultValue="0"
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg transition-all ${
                            darkMode 
                              ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                              : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                          }`}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Total Cost (AUTO)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          id="total-cost-display"
                          type="text" 
                          readOnly
                          value="0.00"
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg ${
                            darkMode 
                              ? 'bg-gray-700/50 border-[#2A2A2A] text-gray-300 cursor-not-allowed' 
                              : 'bg-gray-100 border-gray-300 text-gray-700 cursor-not-allowed'
                          }`}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Selling Price <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          name="price" 
                          id="price-input"
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0.00" 
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg transition-all ${
                            darkMode 
                              ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                              : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                          }`}
                          required 
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Tablet: Two Rows */}
                  <div className="hidden sm:grid sm:grid-cols-2 md:hidden gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Cost per Unit <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          name="cost" 
                          id="cost-input-tablet"
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0.00" 
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg transition-all ${
                            darkMode 
                              ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                              : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                          }`}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Shipping/Delivery Cost
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          name="shippingCost" 
                          id="shipping-input-tablet"
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0.00" 
                          defaultValue="0"
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg transition-all ${
                            darkMode 
                              ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                              : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                          }`}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Total Cost (AUTO)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          id="total-cost-display-tablet"
                          type="text" 
                          readOnly
                          value="0.00"
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg ${
                            darkMode 
                              ? 'bg-gray-700/50 border-[#2A2A2A] text-gray-300 cursor-not-allowed' 
                              : 'bg-gray-100 border-gray-300 text-gray-700 cursor-not-allowed'
                          }`}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Selling Price <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          name="price" 
                          id="price-input-tablet"
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0.00" 
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg transition-all ${
                            darkMode 
                              ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                              : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Mobile: Stack Vertically */}
                  <div className="grid sm:hidden gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Cost per Unit <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          name="cost" 
                          id="cost-input-mobile"
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0.00" 
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg transition-all ${
                            darkMode 
                              ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                              : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                          }`}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Shipping/Delivery Cost
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          name="shippingCost" 
                          id="shipping-input-mobile"
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0.00" 
                          defaultValue="0"
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg transition-all ${
                            darkMode 
                              ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                              : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                          }`}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Total Cost (AUTO)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          id="total-cost-display-mobile"
                          type="text" 
                          readOnly
                          value="0.00"
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg ${
                            darkMode 
                              ? 'bg-gray-700/50 border-[#2A2A2A] text-gray-300 cursor-not-allowed' 
                              : 'bg-gray-100 border-gray-300 text-gray-700 cursor-not-allowed'
                          }`}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Selling Price <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          name="price" 
                          id="price-input-mobile"
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0.00" 
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg transition-all ${
                            darkMode 
                              ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]' 
                              : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCK C: PROFIT PREVIEW (Auto-Calculated) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-[#2A2A2A]">
                  <TrendingUp className="text-[#2FB7A1]" size={20} />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profit Preview</h3>
                </div>
                
                <div className={`p-6 rounded-xl border-2 ${
                  darkMode 
                    ? 'bg-[#1A1A1A]/80 border-[#16A34A]/30' 
                    : 'bg-gradient-to-br from-[#F0FDF4] to-[#ECFDF5] border-[#16A34A]/20'
                }`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Expected Profit Per Unit
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          id="profit-per-unit-display"
                          type="text" 
                          readOnly
                          value="0.00"
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg font-semibold ${
                            darkMode 
                              ? 'bg-gray-700/50 border-[#2A2A2A] text-green-400 cursor-not-allowed' 
                              : 'bg-gray-100 border-gray-300 text-green-600 cursor-not-allowed'
                          }`}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Expected Total Profit
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                        <input 
                          id="total-profit-display"
                          type="text" 
                          readOnly
                          value="0.00"
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg font-semibold ${
                            darkMode 
                              ? 'bg-gray-700/50 border-[#2A2A2A] text-green-400 cursor-not-allowed' 
                              : 'bg-gray-100 border-gray-300 text-green-600 cursor-not-allowed'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Information Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-[#2A2A2A]">
                  <Upload className="text-[#2FB7A1]" size={20} />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Additional Information</h3>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Product Label (Optional)
                  </label>
                  <input
                    name="label"
                    placeholder="e.g., Summer Collection, Promo Batch"
                    className={`w-full px-4 py-3 border rounded-lg transition-all ${
                      darkMode
                        ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2FB7A1] focus:border-[#2FB7A1]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Product Image (Optional)
                  </label>
                  <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                    darkMode 
                      ? 'border-[#2A2A2A] bg-[#1A1A1A]/50 hover:border-gray-600' 
                      : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                  }`}>
                    {imagePreview ? (
                      <div className="space-y-3">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="mx-auto max-h-48 rounded-lg object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImagePreview(null);
                            const fileInput = document.getElementById('image-upload');
                            if (fileInput) fileInput.value = '';
                          }}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove Image
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className={`mx-auto mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} size={24} />
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Click to upload or drag and drop
                        </p>
                        <input 
                          name="image" 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          id="image-upload"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setImagePreview(reader.result);
                                imageBase64 = reader.result;
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <label 
                          htmlFor="image-upload" 
                          className="mt-2 inline-block px-4 py-2 bg-[#2FB7A1] text-white rounded-lg cursor-pointer hover:bg-[#28a085] transition text-sm font-medium"
                        >
                          Choose File
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-gray-200 dark:border-[#2A2A2A]">
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full bg-gradient-to-r from-[#2FB7A1] to-[#28a085] text-white py-3.5 rounded-lg font-semibold hover:from-[#28a085] hover:to-[#2FB7A1] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Adding Product...
                    </span>
                  ) : (
                    'Add Product to Inventory'
                  )}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {showModal && modalType === 'addOrder' && (
        <Modal 
          onClose={() => {
            setShowModal(false);
            setOrderStep('details');
            setPendingOrder(null);
            setCustomerSearchQuery('');
            setSelectedCustomerData(null);
            setPaymentProofPreview(null);
            setProductDropdownOpen(false);   
            setSelectedProductIds([]);  
            setProductAmountInputs({});      
          }} 
          title={orderStep === 'payment' ? 'Confirm Payment' : 'Add Customer Order'} 
          darkMode={darkMode}
          size="lg"
        >
          {orderStep === 'details' ? (
            <form onSubmit={async (e) => {
              e.preventDefault();
            const formData = new FormData(e.target);
            
            const productIds = formData.getAll('productIds');
            if (!productIds || productIds.length === 0) {
              showToast('Please select at least one product.');
              return;
            }
            
            // Build per-product quantity map
            const productQuantities = {};
            for (const id of productIds) {
              const qty = parseInt(formData.get(`quantity_${id}`));
              if (!qty || qty <= 0) {
                showToast(`Please enter a valid quantity for ${inventory.find(p => p.id === id)?.name || id}`);
                return;
              }
              productQuantities[id] = qty;
            }

            let amountPaid = null;
            if (selectedProductIds.length <= 1) {
              amountPaid = formData.get('amountPaid') || null;
            } else {
              // Sum all per-product amounts
              const total = selectedProductIds.reduce((sum, id) => {
                return sum + (parseFloat(formData.get(`amountPaid_${id}`)) || 0);
              }, 0);
              amountPaid = total > 0 ? total.toString() : null;
            }
            

            const data = {
              customerName: formData.get('customerName'),
              username: formData.get('username') || selectedCustomerData?.username || '',
              email: formData.get('email') || selectedCustomerData?.email || '',
              phone: formData.get('phone') || selectedCustomerData?.phone || '',
              upline: formData.get('upline') || selectedCustomerData?.upline || null,
              productIds,
              productQuantities,
              quantity: formData.get('quantity'),
              amountPaid,
              productAmounts: selectedProductIds.reduce((acc, id) => {
                acc[id] = parseFloat(formData.get(`amountPaid_${id}`)) || 0;
                return acc;
              }, {}),
              accountNumber: formData.get('accountNumber') || selectedCustomerData?.accountNumber || '',
              address: formData.get('address') || selectedCustomerData?.address || '',
              invoice: formData.get('invoice') || '',
              paymentMethod: formData.get('paymentMethod'),
              // payment info will be collected in the next step
              paymentProof: null,
              paymentReference: '',
              paymentConfirmed: false
            };
            
            // Move to payment confirmation step instead of creating order immediately
            setPendingOrderData(data);
            setOrderStep('payment');
            }}>
              <div className="space-y-4">
                {/* Customer Name with Autocomplete */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    name="customerName" 
                    value={customerSearchQuery}
                    onChange={(e) => handleCustomerSearch(e.target.value)}
                    placeholder="Type customer name or @Username..." 
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#2FB7A1] ${
                      darkMode 
                        ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400' 
                        : 'bg-white dark:bg-[#1A1A1A] border-[#E3E8EF] dark:border-[#2A2A2A] text-gray-900'
                    }`}
                    required 
                  />
                  {customerSearchResults.length > 0 && (
                    <div className={`absolute z-10 w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-y-auto ${
                      darkMode ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-[#E3E8EF]'
                    }`}>
                      {customerSearchResults.map(customer => (
                        <div
                          key={customer.id}
                          onClick={() => {
                            setCustomerSearchQuery(customer.name); // always fill the name field
                            setSelectedCustomerData({...customer, username: customer.username || ''});
                            setUsernameInput(customer.username || '');  // ← add this
                            setCustomerSearchResults([]);
                            
                          }}
                          className={`p-3 cursor-pointer hover:bg-[#F5F7FA] dark:hover:bg-[#2A2A2A] border-b ${
                            darkMode ? 'border-[#2A2A2A]' : 'border-[#E3E8EF]'
                          } last:border-b-0`}
                        >
                          <div className="flex items-center justify-between">
                            <p className={`font-medium ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                              {customer.name}
                            </p>
                            {customer.username && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                darkMode ? 'bg-[#2FB7A1]/20 text-[#2FB7A1]' : 'bg-[#2FB7A1]/10 text-[#2FB7A1]'
                              }`}>
                                @{customer.username}
                              </span>
                            )}
                          </div>
                          {customer.totalOrders > 0 && (
                            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
                              {customer.totalOrders} orders • ₦{customer.totalSpent.toFixed(2)} total
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Auto-filled Customer Details */}
                {selectedCustomerData && (
                  <div className={`p-3 rounded-lg border ${darkMode ? 'bg-[#1A1A1A]/50 border-[#2A2A2A]' : 'bg-green-50 border-green-200'}`}>
                    <p className={`text-xs font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-green-800'}`}>
                      ✓ Customer found - Details auto-filled
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedCustomerData.username && (
                        <div>
                          <span className={darkMode ? 'text-gray-400' : 'text-[#64748B]'}>Username: </span>
                          <span className={darkMode ? 'text-white' : 'text-[#0F172A]'}>{selectedCustomerData.username}</span>
                        </div>
                      )}
                      {selectedCustomerData.email && (
                        <div>
                          <span className={darkMode ? 'text-gray-400' : 'text-[#64748B]'}>Email: </span>
                          <span className={darkMode ? 'text-white' : 'text-[#0F172A]'}>{selectedCustomerData.email}</span>
                        </div>
                      )}
                      {selectedCustomerData.phone && (
                        <div>
                          <span className={darkMode ? 'text-gray-400' : 'text-[#64748B]'}>Phone: </span>
                          <span className={darkMode ? 'text-white' : 'text-[#0F172A]'}>{selectedCustomerData.phone}</span>
                        </div>
                      )}
                      {selectedCustomerData.accountNumber && (
                        <div>
                          <span className={darkMode ? 'text-gray-400' : 'text-[#64748B]'}>Account No: </span>
                          <span className={darkMode ? 'text-white' : 'text-[#0F172A]'}>{selectedCustomerData.accountNumber}</span>
                        </div>
                      )}
                      {selectedCustomerData.upline && (
                        <div>
                          <span className={darkMode ? 'text-gray-400' : 'text-[#64748B]'}>Upline: </span>
                          <span className={darkMode ? 'text-white' : 'text-[#0F172A]'}>{selectedCustomerData.upline}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input 
                      name="username" 
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="Enter username"
                      required
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#2FB7A1] ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400' 
                          : 'bg-white dark:bg-[#1A1A1A] border-[#E3E8EF] dark:border-[#2A2A2A] text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email (Optional)
                    </label>
                    <input 
                      name="email" 
                      type="email"
                      defaultValue={selectedCustomerData?.email || ''}
                      placeholder="customer@email.com" 
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#2FB7A1] ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400' 
                          : 'bg-white dark:bg-[#1A1A1A] border-[#E3E8EF] dark:border-[#2A2A2A] text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Phone (Optional)
                    </label>
                    <input 
                      name="phone" 
                      type="tel"
                      defaultValue={selectedCustomerData?.phone || ''}
                      placeholder="+1234567890" 
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#2FB7A1] ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400' 
                          : 'bg-white dark:bg-[#1A1A1A] border-[#E3E8EF] dark:border-[#2A2A2A] text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Account Number (Optional)
                    </label>
                    <input 
                      name="accountNumber" 
                      defaultValue={selectedCustomerData?.accountNumber || ''}
                      placeholder="Customer bank account number" 
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#2FB7A1] ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400' 
                          : 'bg-white dark:bg-[#1A1A1A] border-[#E3E8EF] dark:border-[#2A2A2A] text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Upline
                    </label>
                    <input 
                      name="upline" 
                
                      defaultValue={selectedCustomerData?.upline || ''}
                     className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#2FB7A1] ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400' 
                          : 'bg-white dark:bg-[#1A1A1A] border-[#E3E8EF] dark:border-[#2A2A2A] text-gray-900'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Products <span className="text-red-500">*</span>
                  </label>
                  {(() => {
                                  

                    const toggleProduct = (id) => {
                      setSelectedProductIds(prev =>
                        prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
                      );
                    };

                    return (
                      <div className="relative">
                        {/* Hidden inputs for form submission */}
                        {selectedProductIds.map(id => (
                          <input key={id} type="hidden" name="productIds" value={id} />
                        ))}

                        {/* Dropdown Trigger */}
                        <button
                          type="button"
                          onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                          className={`w-full px-4 py-3 border rounded-lg text-left flex items-center justify-between transition ${
                            darkMode
                              ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white hover:border-[#2FB7A1]'
                              : 'bg-white border-[#E3E8EF] text-gray-900 hover:border-[#2FB7A1]'
                          }`}
                        >
                          <span className={selectedProductIds.length === 0 ? 'text-gray-400' : ''}>
                            {selectedProductIds.length === 0
                              ? 'Select products...'
                              : `${selectedProductIds.length} product${selectedProductIds.length > 1 ? 's' : ''} selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${productDropdownOpen ? 'rotate-180' : ''} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Selected Tags */}
                        {selectedProductIds.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedProductIds.map(id => {
                              const item = inventory.find(p => p.id === id);
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-[#2FB7A1]/10 text-[#2FB7A1] border border-[#2FB7A1]/30 rounded-full text-xs font-medium"
                                >
                                  {item?.name || id}
                                  <button
                                    type="button"
                                    onClick={() => toggleProduct(id)}
                                    className="hover:text-red-500 transition ml-1"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Dropdown List */}
                        {productDropdownOpen && (
                          <div className={`absolute z-20 w-full mt-1 border rounded-lg shadow-xl max-h-56 overflow-y-auto ${
                            darkMode
                              ? 'bg-[#1A1A1A] border-[#2A2A2A]'
                              : 'bg-white border-[#E3E8EF]'
                          }`}>
                            {inventory.map(item => {
                              const isSelected = selectedProductIds.includes(item.id);
                              return (
                                  <div
                                    key={item.id}
                                    onClick={() => item.quantity > 0 && toggleProduct(item.id)}
                                    className={`flex items-center gap-3 px-4 py-3 transition border-b last:border-b-0 ${
                                      item.quantity === 0
                                        ? 'opacity-50 cursor-not-allowed pointer-events-none'
                                        : 'cursor-pointer'
                                    } ${darkMode
                                        ? `border-[#2A2A2A] ${isSelected ? 'bg-[#2FB7A1]/10' : 'hover:bg-[#2A2A2A]'}`
                                        : `border-[#F1F5F9] ${isSelected ? 'bg-[#2FB7A1]/5' : 'hover:bg-[#F8FAFC]'}`
                                    }`}
                                  >
                                  {/* Checkbox */}
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                                    isSelected
                                      ? 'bg-[#2FB7A1] border-[#2FB7A1]'
                                      : darkMode ? 'border-[#4A4A4A]' : 'border-[#CBD5E1]'
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>

                                  {/* Product Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                                      {item.name}
                                    </p>
                                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
                                      ID: {item.id} • Stock: {item.quantity} • ₦{item.price}
                                    </p>
                                  </div>

                                  {/* Stock badge */}
                                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                                    item.quantity === 0
                                      ? 'bg-red-100 text-red-600'
                                      : item.quantity < 50
                                      ? 'bg-yellow-100 text-yellow-600'
                                      : 'bg-green-100 text-green-600'
                                  }`}>
                                    {item.quantity === 0 ? 'Out' : item.quantity < 50 ? 'Low' : 'In Stock'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Quantity per Product <span className="text-red-500">*</span>
                  </label>
                  {selectedProductIds.length === 0 ? (
                    <p className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
                      Select products above to set quantities
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedProductIds.map(id => {
                        const item = inventory.find(p => p.id === id);
                        return (
                          <div key={id} className={`flex items-center gap-3 p-3 rounded-lg border ${
                            darkMode ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-[#F8FAFC] border-[#E3E8EF]'
                          }`}>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                                {item?.name || id}
                              </p>
                              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
                                Stock: {item?.quantity} · ₦{item?.price}/unit
                              </p>
                            </div>
                            <input
                              name={`quantity_${id}`}
                              type="number"
                              min="1"
                              max={item?.quantity}
                              placeholder="Qty"
                              className={`w-24 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2FB7A1] text-center ${
                                darkMode
                                  ? 'bg-[#111827] border-[#2A2A2A] text-white placeholder-gray-500'
                                  : 'bg-white border-[#E3E8EF] text-[#0F172A]'
                              }`}
                              required
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Amount Paid (₦)
                  </label>
                  {selectedProductIds.length <= 1 ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                    <input
                      name="amountPaid"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Amount paid (optional)"
                      className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#2FB7A1] ${
                        darkMode
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400'
                          : 'bg-white border-[#E3E8EF] text-gray-900'
                      }`}
                    />
                  </div>
                ) : (
                  <div className={`rounded-lg border overflow-hidden ${
                    darkMode ? 'border-[#2A2A2A]' : 'border-[#E3E8EF]'
                  }`}>
                    {selectedProductIds.map((id, index) => {
                      const item = inventory.find(p => p.id === id);
                      return (
                        <div
                          key={id}
                          className={`flex items-center gap-3 px-3 py-2.5 ${
                            index < selectedProductIds.length - 1
                              ? darkMode ? 'border-b border-[#2A2A2A]' : 'border-b border-[#E3E8EF]'
                              : ''
                          } ${darkMode ? 'bg-[#111827]' : 'bg-white'}`}
                        >
                          {/* Thread indicator */}
                          <div className="flex flex-col items-center self-stretch pt-1 pb-1">
                            <div className="w-2 h-2 rounded-full flex-shrink-0 bg-[#2FB7A1]" />
                            {index < selectedProductIds.length - 1 && (
                              <div className={`w-px flex-1 mt-1 ${darkMode ? 'bg-[#2A2A2A]' : 'bg-[#E3E8EF]'}`} />
                            )}
                          </div>

                          {/* Product name */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                              {item?.name || id}
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-[#94A3B8]'}`}>
                              ₦{item?.price}/unit
                            </p>
                          </div>

                          {/* Amount input — tracked in state */}
                          <div className="relative w-32 flex-shrink-0">
                            <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-xs ${
                              darkMode ? 'text-gray-500' : 'text-[#94A3B8]'
                            }`}>₦</span>
                            <input
                              name={`amountPaid_${id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={productAmountInputs[id] || ''}
                              onChange={(e) => {
                                setProductAmountInputs(prev => ({
                                  ...prev,
                                  [id]: e.target.value
                                }));
                              }}
                              className={`w-full pl-6 pr-2 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2FB7A1] text-right ${
                                darkMode
                                  ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-600'
                                  : 'bg-[#F8FAFC] border-[#E3E8EF] text-[#0F172A]'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* Live total row */}
                    <div className={`flex items-center justify-between px-3 py-2.5 ${
                      darkMode ? 'bg-[#0d1117] border-t border-[#2A2A2A]' : 'bg-[#F8FAFC] border-t border-[#E3E8EF]'
                    }`}>
                      <span className={`text-xs font-semibold uppercase tracking-wide ${
                        darkMode ? 'text-gray-400' : 'text-[#64748B]'
                      }`}>Total</span>
                      <span className="text-sm font-bold text-[#2FB7A1]">
                        ₦{selectedProductIds.reduce((sum, id) => {
                          return sum + (parseFloat(productAmountInputs[id]) || 0);
                        }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Shipping Address <span className="text-red-500">*</span>
                  </label>
                  <textarea 
                    name="address" 
                    defaultValue={selectedCustomerData?.address || ''}
                    placeholder="Enter shipping address" 
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#2FB7A1] ${
                      darkMode 
                        ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400' 
                        : 'bg-white dark:bg-[#1A1A1A] border-[#E3E8EF] dark:border-[#2A2A2A] text-gray-900'
                    }`}
                    rows="3" 
                    required 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Invoice Number (Optional)
                  </label>
                  <input 
                    name="invoice" 
                    placeholder="Invoice number" 
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#2FB7A1] ${
                      darkMode 
                        ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400' 
                        : 'bg-white dark:bg-[#1A1A1A] border-[#E3E8EF] dark:border-[#2A2A2A] text-gray-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select 
                    name="paymentMethod" 
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#2FB7A1] ${
                      darkMode 
                        ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white' 
                        : 'bg-white dark:bg-[#1A1A1A] border-[#E3E8EF] dark:border-[#2A2A2A] text-gray-900'
                    }`}
                    required
                  >
                    <option value="">Select Payment Method</option>
                    <option value="zelle">Zelle</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="cashapp">Cash App</option>
                  </select>
                </div>

                {/* Note: Payment reference and proof now collected in the next step */}
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full bg-[#2FB7A1] text-white py-3 rounded-lg font-medium hover:bg-[#28a085] disabled:opacity-50 transition"
                >
                  {loading ? 'Next...' : 'Next: Confirm Payment'}
                </button>
              </div>
            </form>
          ) : (
            // Payment Confirmation Step
            (pendingOrder || pendingOrderData) && (
              <div className="space-y-4">
                {pendingOrder ? (
                  <div className={`p-4 rounded-lg border ${darkMode ? 'bg-[#1A1A1A]/50 border-[#2A2A2A]' : 'bg-blue-50 border-blue-200'}`}>
                    <h3 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                      Order Created: {pendingOrder.id}
                    </h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#64748B]'}`}>
                      Please confirm payment by uploading the reference number and proof of payment.
                    </p>
                  </div>
                ) : (
                  <div className={`p-4 rounded-lg border ${darkMode ? 'bg-[#1A1A1A]/50 border-[#2A2A2A]' : 'bg-blue-50 border-blue-200'}`}>
                    <h3 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                      Confirm Payment & Create Order
                    </h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#64748B]'}`}>
                      Upload the payment slip and reference number to create this order.
                    </p>
                  </div>
                )}

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  
                  // Handle payment proof image
                  let paymentProofBase64 = null;
                  const paymentProofFile = formData.get('paymentProof');
                  if (paymentProofFile && paymentProofFile.size > 0) {
                    try {
                      paymentProofBase64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(paymentProofFile);
                      });
                    } catch (error) {
                      console.error('Error reading payment proof:', error);
                      showToast('Error reading payment proof image. Please try again.');
                      return;
                    }
                  }
                  
                  const paymentReference = formData.get('paymentReference') || '';
                  
                  if (pendingOrder) {
                    // Confirm payment for an existing order
                    handleConfirmPayment(pendingOrder.id, paymentReference, paymentProofBase64);
                  } else if (pendingOrderData) {
                    // Create a brand new order with payment info included
                    const data = {
                      ...pendingOrderData,
                      paymentReference: paymentReference,
                      paymentProof: paymentProofBase64,
                      paymentConfirmed: true
                    };
                    await handleAddOrder(data);
                    setPendingOrderData(null);
                  }
                }}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Payment Reference Number (Optional)
                    </label>
                    <input 
                      name="paymentReference" 
                      placeholder="Enter payment reference number" 
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#2FB7A1] ${
                        darkMode 
                          ? 'bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder-gray-400' 
                          : 'bg-white dark:bg-[#1A1A1A] border-[#E3E8EF] dark:border-[#2A2A2A] text-gray-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Payment Proof Image (Optional)
                    </label>
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center ${
                      darkMode ? 'border-[#2A2A2A] bg-[#1A1A1A]/50' : 'border-gray-300 bg-gray-50'
                    }`}>
                      {paymentProofPreview ? (
                        <div className="space-y-3">
                          <img 
                            src={paymentProofPreview} 
                            alt="Payment Proof Preview" 
                            className="mx-auto max-h-48 rounded-lg object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentProofPreview(null);
                              const fileInput = document.querySelector('input[name="paymentProof"]');
                              if (fileInput) fileInput.value = '';
                            }}
                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            Remove Image
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className={`mx-auto mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} size={24} />
                          <p className={`text-sm mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Upload proof of payment
                          </p>
                          <input 
                            name="paymentProof" 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            id="payment-proof-confirm"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setImagePreview(reader.result);
                                  imageBase64 = reader.result;
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <label 
                            htmlFor="payment-proof-confirm" 
                            className="inline-block px-4 py-2 bg-[#2FB7A1] text-white rounded-lg cursor-pointer hover:bg-[#28a085] transition text-sm font-medium"
                          >
                            Choose File
                          </label>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setOrderStep('details');
                        setPaymentProofPreview(null);
                        // If we were creating a new order, keep the filled details; if confirming existing, keep pendingOrder
                      }}
                      className="flex-1 px-4 py-3 border border-[#E3E8EF] dark:border-[#2A2A2A] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition"
                    >
                      Back
                    </button>
                    <button 
                      type="submit" 
                      disabled={loading} 
                      className="flex-1 bg-[#2FB7A1] text-white py-3 rounded-lg font-medium hover:bg-[#28a085] disabled:opacity-50 transition"
                    >
                      {loading ? 'Submitting...' : (pendingOrder ? 'Confirm Payment' : 'Confirm Payment & Create Order')}
                    </button>
                  </div>
                </form>
              </div>
            )
          )}
        </Modal>
      )}

      {showModal && modalType === 'addQuantity' && productToUpdate && (
        <Modal onClose={() => { setShowModal(false); setProductToUpdate(null); }} title="Add Quantity to Stock" darkMode={darkMode}>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const quantityToAdd = parseInt(formData.get('quantity'));
            if (quantityToAdd > 0) {
              handleAddQuantity(productToUpdate.id, quantityToAdd);
            } else {
              showToast('Please enter a valid quantity greater than 0');
            }
          }}>
            <div className="space-y-4">
              <div className="bg-[#F5F7FA] rounded-lg p-4 mb-4">
                <p className="text-sm text-[#64748B] mb-1">Product</p>
                <p className="font-semibold text-lg text-[#0F172A] dark:text-white">{productToUpdate.name}</p>
                <p className="text-xs text-[#64748B] font-mono mt-1">ID: {productToUpdate.id}</p>
                <div className="mt-3 pt-3 border-t border-[#E3E8EF]">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#64748B] dark:text-gray-400">Current Stock:</span>
                    <span className="font-bold text-lg text-[#0F172A] dark:text-white">{productToUpdate.quantity} units</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#64748B] mb-2">Quantity to Add</label>
                <input 
                  name="quantity" 
                  type="number" 
                  min="1"
                  placeholder="Enter quantity to add" 
                  className="w-full px-4 py-3 border border-[#E3E8EF] rounded-lg focus:ring-2 focus:ring-[#2FB7A1]" 
                  required 
                />
                <p className="text-xs text-[#64748B] mt-1">Enter the number of units received in stock</p>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-[#2563EB] text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Adding...' : 'Add to Stock'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showModal && modalType === 'editProduct' && productToEdit && (
        <Modal
          onClose={() => { setShowModal(false); setProductToEdit(null); }}
          title="Edit Product Pricing"
          darkMode={darkMode}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const updates = {
                price: formData.get('price'),
                cost: formData.get('cost'),
                shippingCost: formData.get('shippingCost'),
                label: formData.get('label') || ''
              };
              handleUpdateProduct(productToEdit.id, updates);
            }}
          >
            <div className="space-y-4">
              <div className="bg-[#F5F7FA] rounded-lg p-4 mb-4">
                <p className="text-sm text-[#64748B] mb-1">Product</p>
                <p className="font-semibold text-lg text-[#0F172A] dark:text-white">{productToEdit.name}</p>
                <p className="text-xs text-[#64748B] font-mono mt-1">ID: {productToEdit.id}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#64748B] mb-2">
                    Cost per Unit (₦)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₦</span>
                    <input
                      name="cost"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={productToEdit.cost}
                      className="w-full pl-8 pr-4 py-2.5 border border-[#E3E8EF] rounded-lg text-sm focus:ring-2 focus:ring-[#2FB7A1]"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#64748B] mb-2">
                    Selling Price (₦)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₦</span>
                    <input
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={productToEdit.price}
                      className="w-full pl-8 pr-4 py-2.5 border border-[#E3E8EF] rounded-lg text-sm focus:ring-2 focus:ring-[#2FB7A1]"
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#64748B] mb-2">
                    Shipping Cost (₦)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₦</span>
                    <input
                      name="shippingCost"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={productToEdit.shippingCost || 0}
                      className="w-full pl-8 pr-4 py-2.5 border border-[#E3E8EF] rounded-lg text-sm focus:ring-2 focus:ring-[#2FB7A1]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#64748B] mb-2">
                    Product Label (Optional)
                  </label>
                  <input
                    name="label"
                    defaultValue={productToEdit.label || ''}
                    placeholder="Label for this product"
                    className="w-full px-4 py-2.5 border border-[#E3E8EF] rounded-lg text-sm focus:ring-2 focus:ring-[#2FB7A1]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2563EB] text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showVerification && verificationData && (
        <Modal onClose={() => { setShowVerification(false); setVerificationData(null); }} title="Inventory Verification" size="xl" darkMode={darkMode}>
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-[#F5F7FA] rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-[#0F172A] mb-2">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-[#64748B] dark:text-gray-400">Total Products</p>
                  <p className="font-semibold text-lg text-[#0F172A] dark:text-white">{verificationData.summary.totalProducts}</p>
                </div>
                <div>
                  <p className="text-[#64748B] dark:text-gray-400">With Discrepancies</p>
                  <p className={`font-semibold text-lg ${verificationData.summary.productsWithDiscrepancies > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                    {verificationData.summary.productsWithDiscrepancies}
                  </p>
                </div>
                <div>
                  <p className="text-[#64748B] dark:text-gray-400">Total from Orders</p>
                  <p className="font-semibold text-lg text-[#2563EB]">{verificationData.summary.totalOrdersSold}</p>
                </div>
                <div>
                  <p className="text-[#64748B] dark:text-gray-400">Total in Inventory</p>
                  <p className="font-semibold text-lg text-[#0F172A] dark:text-white">{verificationData.summary.totalInventorySold}</p>
                </div>
              </div>
              {verificationData.summary.difference !== 0 && (
                <div className={`mt-3 p-3 rounded-lg ${verificationData.summary.difference > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className="text-sm font-medium">
                    <span className={verificationData.summary.difference > 0 ? 'text-yellow-800' : 'text-red-800'}>
                      Difference: {verificationData.summary.difference > 0 ? '+' : ''}{verificationData.summary.difference} units
                    </span>
                  </p>
                  <p className="text-xs text-[#64748B] mt-1">
                    {verificationData.summary.difference > 0 
                      ? 'Orders show more sold than inventory. Inventory needs to be updated.'
                      : 'Inventory shows more sold than orders. This may indicate deleted orders.'}
                  </p>
                </div>
              )}
            </div>

            {/* Discrepancies List */}
            {verificationData.discrepancies.length > 0 ? (
              <div>
                <h3 className="font-semibold text-[#0F172A] mb-3">Products with Discrepancies</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {verificationData.discrepancies.map((item, index) => (
                    <div key={index} className="bg-white border border-[#E3E8EF] rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-[#0F172A] dark:text-white">{item.productName}</p>
                          <p className="text-xs text-[#64748B] dark:text-gray-400">ID: {item.productId}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          item.difference > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {item.difference > 0 ? '+' : ''}{item.difference}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[#64748B] dark:text-gray-400">In Inventory:</p>
                          <p className="font-semibold text-[#0F172A] dark:text-white">{item.inventorySold} units</p>
                        </div>
                        <div>
                          <p className="text-[#64748B] dark:text-gray-400">From Orders:</p>
                          <p className="font-semibold text-[#2563EB]">{item.ordersSold} units</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <p className="text-green-800 font-medium">✓ All sold quantities match!</p>
                <p className="text-sm text-green-700 mt-1">Inventory sold counts match the actual orders.</p>
              </div>
            )}



            {/* Fix Button */}
            {verificationData.discrepancies.length > 0 && (
              <div className="flex justify-end gap-3 pt-4 border-t border-[#E3E8EF]">
                <button
                  onClick={() => { setShowVerification(false); setVerificationData(null); }}
                  className="px-4 py-2 border border-[#E3E8EF] rounded-lg text-[#64748B] hover:bg-[#F5F7FA] transition"
                >
                  Close
                </button>
                <button
                  onClick={fixInventory}
                  className="px-4 py-2 bg-[#2FB7A1] text-white rounded-lg hover:bg-[#28a085] transition font-medium"
                >
                  Fix Inventory
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {selectedProduct && (
        <Modal onClose={() => setSelectedProduct(null)} title="Product Details" darkMode={darkMode}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[#64748B] dark:text-gray-400">Product ID</p>
                <p className="font-semibold text-lg text-[#0F172A] dark:text-white">{selectedProduct.id}</p>
              </div>
              <div>
                <p className="text-sm text-[#64748B] dark:text-gray-400">Product Name</p>
                <p className="font-semibold text-lg text-[#0F172A] dark:text-white">{selectedProduct.name}</p>
              </div>
              {selectedProduct.label && (
                <div>
                  <p className="text-sm text-[#64748B] dark:text-gray-400">Label</p>
                  <p className="font-semibold text-lg text-[#0F172A] dark:text-white">{selectedProduct.label}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-[#64748B] dark:text-gray-400">In Stock</p>
                <p className="font-semibold text-lg text-[#16A34A]">{selectedProduct.quantity}</p>
              </div>
              <div>
                <p className="text-sm text-[#64748B] dark:text-gray-400">Sold</p>
                <p className="font-semibold text-lg text-[#2563EB]">{selectedProduct.sold}</p>
              </div>
              <div>
                <p className="text-sm text-[#64748B] dark:text-gray-400">Total Bought</p>
                <p className="font-semibold text-lg text-[#0F172A] dark:text-white">{selectedProduct.quantity + selectedProduct.sold}</p>
              </div>
              <div>
                <p className="text-sm text-[#64748B] dark:text-gray-400">Date Received</p>
                <p className="font-semibold text-lg text-[#0F172A] dark:text-white">{selectedProduct.dateReceived}</p>
              </div>
              <div>
                <p className="text-sm text-[#64748B] dark:text-gray-400">Cost per Unit</p>
                <p className="font-semibold text-lg text-[#0F172A] dark:text-white">₦{selectedProduct.cost}</p>
              </div>
              <div>
                <p className="text-sm text-[#64748B] dark:text-gray-400">Selling Price</p>
                <p className="font-semibold text-lg text-[#0F172A] dark:text-white">₦{selectedProduct.price}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-[#E3E8EF] dark:border-[#2A2A2A]">
            {userRole === 'admin' && (
  <div className="pt-4 border-t border-[#E3E8EF] dark:border-[#2A2A2A]">
    <button
      onClick={() => handleDeleteProduct(selectedProduct.id)}
      className="w-full py-2.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition"
    >
      Delete Product
    </button>
  </div>
)}
          </div>
          </div>
        </Modal>
      )}

      {selectedOrder && (
        <Modal
          onClose={() => setSelectedOrder(null)}
          title="Order Details"
          size="xl"
          darkMode={darkMode}
        >
          {(() => {
            const order = selectedOrder;
            const product = inventory.find((p) => p.id === order.productId);
            const customerInfo = customers.find((c) => c.name === order.customerName);
            const shipping = order.shipping || {};
            const orderTotal = product ? (product.price || 0) * (order.quantity || 0) : 0;
            const amountPaid = order.amountPaid != null ? order.amountPaid : orderTotal;

            return (
              <div className="space-y-6">
                {/* Top Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 flex items-start gap-4">
                    {product?.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-20 h-20 rounded-lg object-cover border border-[#E3E8EF] dark:border-[#2A2A2A]"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-[#2FB7A1] to-[#1F3A5F] flex items-center justify-center text-white font-bold text-xl">
                        {product ? product.name.substring(0, 2).toUpperCase() : 'OR'}
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
                        Order ID
                      </p>
                      <p className={`font-mono font-semibold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                        {order.id}
                      </p>
                      <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
                        Date
                      </p>
                      <p className={darkMode ? 'text-gray-200' : 'text-[#0F172A]'}>
                        {order.dateCreated || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>Status</p>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        shipping.status === 'shipped'
                          ? 'bg-purple-50 text-[#9333EA] dark:bg-purple-900/30 dark:text-purple-300'
                          : shipping.status === 'transit'
                          ? 'bg-blue-50 text-[#2563EB] dark:bg-blue-900/30 dark:text-blue-300'
                          : order.paymentConfirmed
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-yellow-50 text-[#F59E0B] dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}
                    >
                      {shipping.status
                        ? shipping.status.charAt(0).toUpperCase() + shipping.status.slice(1)
                        : order.paymentConfirmed
                        ? 'Confirmed'
                        : 'Pending'}
                    </span>
                    <div className="mt-2">
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
                        Payment Method
                      </p>
                      <p className={`text-sm capitalize ${darkMode ? 'text-gray-200' : 'text-[#0F172A]'}`}>
                        {order.paymentMethod || 'N/A'}
                      </p>
                      <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
                        Amount Paid
                      </p>
                      <p className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-[#0F172A]'}`}>
                        ₦{amountPaid.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Customer & Order Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                      Customer Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>Name</p>
                        <p className={darkMode ? 'text-gray-200' : 'text-[#0F172A]'}>
                          {order.customerName}
                        </p>
                      </div>
                      {customerInfo?.username && (
                        <div>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>Username</p>
                          <p className={darkMode ? 'text-gray-200' : 'text-[#0F172A]'}>
                            @{customerInfo.username}
                          </p>
                        </div>
                      )}
                      {customerInfo?.email && (
                        <div>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>Email</p>
                          <p className={darkMode ? 'text-gray-200' : 'text-[#0F172A]'}>
                            {customerInfo.email}
                          </p>
                        </div>
                      )}
                      {customerInfo?.phone && (
                        <div>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>Phone</p>
                          <p className={darkMode ? 'text-gray-200' : 'text-[#0F172A]'}>
                            {customerInfo.phone}
                          </p>
                        </div>
                      )}
                      {customerInfo?.accountNumber && (
                        <div>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>Account Number</p>
                          <p className={darkMode ? 'text-gray-200' : 'text-[#0F172A]'}>
                            {customerInfo.accountNumber}
                          </p>
                        </div>
                      )}
                      {customerInfo?.upline && (
                        <div>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>Upline</p>
                          <p className={darkMode ? 'text-gray-200' : 'text-[#0F172A]'}>
                            {customerInfo.upline}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
                          Shipping Address
                        </p>
                        <p className={darkMode ? 'text-gray-200' : 'text-[#0F172A]'}>
                          {order.address || customerInfo?.address || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                      Order Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>Product</p>
                        <p className={darkMode ? 'text-gray-200' : 'text-[#0F172A]'}>
                          {product ? `${product.name} (${product.id})` : order.productId}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>Quantity</p>
                        <p className={darkMode ? 'text-gray-200' : 'text-[#0F172A]'}>
                          {order.quantity} units
                        </p>
                      </div>
                      {product && (
                        <div>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>Unit Price</p>
                          <p className={darkMode ? 'text-gray-200' : 'text-[#0F172A]'}>
                            ₦{product.price}
                          </p>
                        </div>
                      )}
                      {order.invoice && (
                        <div>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>Invoice</p>
                          <p className={darkMode ? 'text-gray-200' : 'text-[#0F172A]'}>
                            {order.invoice}
                          </p>
                        </div>
                      )}
                      {order.paymentReference && (
                        <div>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
                            Payment Reference
                          </p>
                          <p className={`font-mono ${darkMode ? 'text-gray-200' : 'text-[#0F172A]'}`}>
                            {order.paymentReference}
                          </p>
                        </div>
                      )}
                      {shipping.trackingNumber && (
                        <div>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
                            Tracking Number
                          </p>
                          <p className={`font-mono ${darkMode ? 'text-gray-200' : 'text-[#0F172A]'}`}>
                            {shipping.trackingNumber}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Images */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {order.paymentProof && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-2 ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                        Payment Proof
                      </h3>
                      <img
                        src={order.paymentProof}
                        alt="Payment Proof"
                        className="max-w-full max-h-80 rounded-lg border border-[#E3E8EF] dark:border-[#2A2A2A]"
                      />
                    </div>
                  )}
                  {product?.image && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-2 ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                        Product Image
                      </h3>
                      <img
                        src={product.image}
                        alt={product.name}
                        className="max-w-full max-h-80 rounded-lg border border-[#E3E8EF] dark:border-[#2A2A2A]"
                      />
                    </div>
                  )}

                </div>
                
              </div>
            );
          })()}
        </Modal>
      )}

      {selectedShipping && (
        <Modal onClose={() => { setSelectedShipping(null); setShippingHistory([]); }} title="Shipping History" size="xl" darkMode={darkMode}>
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="bg-[#F5F7FA] rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[#0F172A] dark:text-white">{selectedShipping.customerName}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedShipping.status === 'transit' ? 'bg-blue-50 text-[#2563EB]' :
                  selectedShipping.status === 'shipped' ? 'bg-purple-50 text-[#9333EA]' :
                  'bg-yellow-50 text-[#F59E0B]'
                }`}>
                  {selectedShipping.status.charAt(0).toUpperCase() + selectedShipping.status.slice(1)}
                </span>
              </div>
              <div className="text-sm text-[#64748B] space-y-1">
                <div><span className="font-medium">Order ID:</span> {selectedShipping.id}</div>
                <div><span className="font-medium">Product:</span> {selectedShipping.productId} × {selectedShipping.quantity}</div>
                {selectedShipping.trackingNumber && (
                  <div><span className="font-medium">Tracking:</span> {selectedShipping.trackingNumber}</div>
                )}
                {selectedShipping.shippingCompany && (
                  <div><span className="font-medium">Shipping Company:</span> {selectedShipping.shippingCompany}</div>
                )}
                {selectedShipping.shippingDate && (
                  <div><span className="font-medium">Shipping Date:</span> {selectedShipping.shippingDate}</div>
                )}
                {selectedShipping.shippingCost && (
                  <div><span className="font-medium">Shipping Cost:</span> ₦{parseFloat(selectedShipping.shippingCost).toFixed(2)}</div>
                )}
                {selectedShipping.address && (
                  <div className="pt-1">
                    <div className="font-medium mb-1">Address:</div>
                    <div className="text-xs">{selectedShipping.address}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Shipping History Timeline */}
            <div>
              <h4 className="font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
                <Clock size={18} />
                Full Shipping History
              </h4>
              {shippingHistory.length === 0 ? (
                <div className="text-center py-8 text-[#64748B] dark:text-gray-400">
                  <p>No history available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shippingHistory.map((entry, index) => {
                    const date = entry.timestamp ? new Date(entry.timestamp) : null;
                    const formattedDate = date ? date.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    }) : 'N/A';
                    const formattedTime = date ? date.toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    }) : 'N/A';
                    
                    const statusColors = {
                      'pending': 'bg-yellow-100 text-[#F59E0B]',
                      'transit': 'bg-blue-100 text-[#2563EB]',
                      'shipped': 'bg-purple-100 text-[#9333EA]'
                    };
                    const statusColor = statusColors[entry.status] || statusColors['pending'];
                    
                    return (
                      <div key={entry.id || index} className="relative pl-8 pb-4 border-l-2 border-[#E3E8EF] last:border-l-0">
                        <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-white border-2 border-[#2FB7A1]"></div>
                        <div className="bg-white rounded-lg p-4 shadow-sm border border-[#E3E8EF]">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
                                {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                              </span>
                            </div>
                            <div className="flex flex-col md:items-end gap-1 text-xs text-[#64748B] dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <Calendar size={12} />
                                <span className="font-medium">{formattedDate}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock size={12} />
                                <span>{formattedTime}</span>
                              </div>
                            </div>
                          </div>
                          {entry.trackingNumber && (
                            <div className="text-sm text-[#64748B] mb-1">
                              <span className="font-medium">Tracking:</span> {entry.trackingNumber}
                            </div>
                          )}
                          {entry.shippingCost && (
                            <div className="text-sm text-[#64748B] mb-1">
                              <span className="font-medium">Cost:</span> ₦{parseFloat(entry.shippingCost).toFixed(2)}
                            </div>
                          )}
                          {entry.notes && (
                            <div className="text-sm text-[#64748B] mt-2 pt-2 border-t border-[#E3E8EF]">
                              <span className="font-medium">Notes:</span> {entry.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9998] p-4">
          <div className={`rounded-2xl shadow-2xl p-6 max-w-sm w-full ${
            darkMode ? 'bg-[#111827]' : 'bg-white'
          }`}>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                  Are you sure?
                </h3>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-[#64748B]'}`}>
                  {confirmDialog.message}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
                  darkMode
                    ? 'border-[#1f2937] text-gray-300 hover:bg-[#1f2937]'
                    : 'border-[#E3E8EF] text-[#64748B] hover:bg-[#F8FAFC]'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Toast Notifications */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white pointer-events-auto transition-all animate-fade-in max-w-sm ${
              toast.type === 'success' ? 'bg-[#2FB7A1]' :
              toast.type === 'error'   ? 'bg-red-500' :
              toast.type === 'warning' ? 'bg-amber-500' :
              'bg-[#1F3A5F]'
            }`}
          >
            <span className="text-lg flex-shrink-0">
              {toast.type === 'success' ? '✓' :
               toast.type === 'error'   ? '✕' :
               toast.type === 'warning' ? '⚠' : 'ℹ'}
            </span>
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="ml-2 opacity-70 hover:opacity-100 transition text-white font-bold"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const Modal = ({ children, onClose, title, size = 'md', darkMode = false }) => {
  const sizeClasses = {
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-2xl',
    'xl': 'max-w-5xl',
    'full': 'max-w-full mx-4'
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className={`${darkMode ? 'bg-[#1A1A1A]' : 'bg-white'} rounded-2xl shadow-2xl ${sizeClasses[size]} w-full max-h-[90vh] overflow-y-auto transition-colors`}>
        <div className={`sticky top-0 ${darkMode ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-gray-200'} border-b px-6 py-4 flex justify-between items-center`}>
          <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
          <button 
            onClick={onClose} 
            className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-[#2A2A2A] text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default InventorySystem;