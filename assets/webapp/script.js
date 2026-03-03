// Import Firebase functions from firebase-config.js
import { 
    db, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    orderBy, 
    query, 
    serverTimestamp,
    getDocs 
} from './firebase-config.js';

// DOM Elements
const loginPage = document.getElementById('login-page');
const appContainer = document.getElementById('app');
const currentDateEl = document.getElementById('current-date');
const currentYearEl = document.getElementById('current-year');
const navItems = document.querySelectorAll('[data-section]');
const sectionNavButtons = document.querySelectorAll('[data-section-nav]');
const contentSections = document.querySelectorAll('.content-section');
const orderForm = document.getElementById('order-form');
const addProductForm = document.getElementById('add-product-form');
const ordersTableBody = document.querySelector('#orders-table tbody');
const recentOrdersTableBody = document.querySelector('#recent-orders-table tbody');
const reportTableBody = document.querySelector('#report-table tbody');
const pendingPaymentsTableBody = document.querySelector('#pending-payments-table tbody');
const productsContainer = document.getElementById('products-container');
const productListSidebar = document.getElementById('product-list-sidebar');

// Dashboard elements
const totalOrdersEl = document.getElementById('total-orders');
const totalRevenueEl = document.getElementById('total-revenue');
const todayOrdersEl = document.getElementById('today-orders');
const todayRevenueEl = document.getElementById('today-revenue');
const dashboardTodayRevenueEl = document.getElementById('dashboard-today-revenue');
const activeShopsEl = document.getElementById('active-shops');
const dashboardPendingPaymentsEl = document.getElementById('dashboard-pending-payments');
const paidAmountEl = document.getElementById('paid-amount');
const sidebarPendingPaymentsEl = document.getElementById('pending-payments');

// View Orders Filter Summary elements
const filteredOrdersCountEl = document.getElementById('filtered-orders-count');
const filteredTotalRevenueEl = document.getElementById('filtered-total-revenue');
const filteredPaidAmountEl = document.getElementById('filtered-paid-amount');
const filteredPendingAmountEl = document.getElementById('filtered-pending-amount');

// Report elements
const reportTotalOrdersEl = document.getElementById('report-total-orders');
const reportTotalRevenueEl = document.getElementById('report-total-revenue');
const reportAvgOrderEl = document.getElementById('report-avg-order');
const reportPaidAmountEl = document.getElementById('report-paid-amount');
const reportPendingAmountEl = document.getElementById('report-pending-amount');

// Form elements
const quantityInput = document.getElementById('quantity');
const rateInput = document.getElementById('rate');
const totalInput = document.getElementById('total');
const productSelect = document.getElementById('product');
const filterProductSelect = document.getElementById('filter-product');
const updateProductSelect = document.getElementById('update-product');
const paymentStatusSelect = document.getElementById('payment-status');
const paidDateInput = document.getElementById('paid-date');
const printBillAfterSaveInput = document.getElementById('print-bill-after-save');

// Report buttons
const generateReportBtn = document.getElementById('generate-report');
const exportPdfBtn = document.getElementById('export-pdf');
const exportFilteredPdfBtn = document.getElementById('export-filtered-pdf');

// Login elements
const loginForm = document.getElementById('login-form');
const userNameEl = document.getElementById('user-name');
const userRoleEl = document.getElementById('user-role');
const sidebarUserNameEl = document.getElementById('sidebar-user-name');
const sidebarUserRoleEl = document.getElementById('sidebar-user-role');
const logoutBtn = document.getElementById('logoutBtn');
const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
const loginTabs = document.querySelectorAll('.login-tab');
const loginRoleSelect = document.getElementById('login-role');
const installAppBtn = document.getElementById('installAppBtn');
const networkStatusEl = document.getElementById('network-status');
const pageTitleEl = document.getElementById('current-view-title');
const pageDescriptionEl = document.getElementById('current-view-description');
const toastRegion = document.getElementById('toast-region');
const sidebar = document.getElementById('app-sidebar');
const sidebarToggleBtn = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');

// Product toggle button
const toggleAddProductBtn = document.getElementById('toggle-add-product');
const addProductSection = document.getElementById('add-product-section');

// Theme toggle
const themeToggle = document.getElementById('themeToggle');

// Chart
let salesChart = null;

// Global variables
let allOrders = [];
let filteredOrders = [];
let allProducts = [];
let productPrices = {};
let currentReportOrders = [];
let currentReportStartDate = '';
let currentReportEndDate = '';
let currentFilteredOrders = [];
let currentUser = null;
let deferredInstallPrompt = null;
let unsubscribeOrdersListener = null;
let unsubscribeProductsListener = null;
const MOBILE_BREAKPOINT = 1024;
const MOBILE_TABLE_BREAKPOINT = 1024;
const MOBILE_KEYBOARD_THRESHOLD = 120;
const MODAL_IDS = ['edit-modal', 'edit-product-modal', 'pdf-export-modal'];
const TABLE_ADAPTERS = {
    'orders-table': { pattern: 'cards', columns: 11 },
    'pending-payments-table': { pattern: 'cards', columns: 7 },
    'recent-orders-table': { pattern: 'cards', columns: 7 },
    'report-table': { pattern: 'scroll', columns: 6 }
};
let mobileTableModeActive = false;
const SECTION_META = {
    'dashboard': {
        title: 'Dashboard',
        description: 'Track daily orders, revenue, and pending collections.'
    },
    'add-order': {
        title: 'Add New Order',
        description: 'Create a fresh order entry with billing and payment details.'
    },
    'view-orders': {
        title: 'View Orders',
        description: 'Search and filter historical orders by date, shop, product, and status.'
    },
    'reports': {
        title: 'Reports',
        description: 'Analyze revenue trends and generate downloadable report exports.'
    },
    'products': {
        title: 'Products Management',
        description: 'Maintain catalog pricing and product metadata used in orders.'
    }
};

// Auth state
const AUTH_STATE = {
    isLoggedIn: false,
    role: 'guest',
    username: 'Guest'
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    registerServiceWorker();
    if (!isFlutterHostEnvironment()) {
        initializePWAInstallPrompt();
    } else {
        hideInstallButton();
    }
    initializeMobileSidebar();
    initializeNetworkStatus();
    initializeMobileViewportSupport();
    initializeResponsiveTableAdapters();
    setModalVisibilityState();

    // Check for saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        const moonIcon = themeToggle.querySelector('.fa-moon');
        const sunIcon = themeToggle.querySelector('.fa-sun');
        if (moonIcon) moonIcon.style.display = 'none';
        if (sunIcon) sunIcon.style.display = 'block';
    }

    // Setup event listeners
    setupEventListeners();
    initializeDelegatedTableActions();
    setActiveNavigation('dashboard');
    updatePageContext('dashboard');
    showGlobalLoadingSkeletons();
    
    // Check for saved login state
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        setTimeout(() => {
            loginUser(user.username, user.role);
        }, 50);
    }
});

function debounce(callback, wait = 180) {
    let timeoutId = null;
    return (...args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            callback(...args);
        }, wait);
    };
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleLogin();
    });
    
    // Login tabs
    loginTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            loginTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            loginRoleSelect.value = this.dataset.role;
        });
    });
    
    // Navigation (sidebar + mobile)
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navigateToSection(item.getAttribute('data-section'));
        });

        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigateToSection(item.getAttribute('data-section'));
            }
        });
    });

    // Section-level action buttons
    sectionNavButtons.forEach(button => {
        button.addEventListener('click', () => {
            navigateToSection(button.getAttribute('data-section-nav'));
        });
    });
    
    // Order form
    quantityInput.addEventListener('input', calculateTotal);
    rateInput.addEventListener('input', calculateTotal);
    productSelect.addEventListener('change', updateRateByProduct);
    
    orderForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!checkAdminPermission('add orders')) return;
        saveOrder();
    });
    
    // Add product form
    addProductForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!checkAdminPermission('add products')) return;
        addProduct();
    });
    
    // Toggle Add Product Form
    if (toggleAddProductBtn) {
        toggleAddProductBtn.addEventListener('click', function() {
            if (!checkAdminPermission('add products')) return;
            
            if (addProductSection.style.display === 'none' || addProductSection.style.display === '') {
                addProductSection.style.display = 'block';
                this.innerHTML = '<i class="fas fa-times"></i> Cancel Add Product';
                this.classList.remove('btn-primary');
                this.classList.add('btn-secondary');
            } else {
                addProductSection.style.display = 'none';
                this.innerHTML = '<i class="fas fa-plus"></i> Add New Product';
                this.classList.remove('btn-secondary');
                this.classList.add('btn-primary');
                addProductForm.reset();
            }
        });
    }
    
    // Toggle Paid Date based on Payment Status
    paymentStatusSelect.addEventListener('change', function() {
        if (this.value === 'paid') {
            paidDateInput.required = true;
            paidDateInput.disabled = false;
            if (!paidDateInput.value) {
                paidDateInput.valueAsDate = new Date();
            }
        } else {
            paidDateInput.required = false;
            paidDateInput.disabled = true;
            paidDateInput.value = '';
        }
    });
    
    // Color selection for new product
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('new-product-color').value = this.getAttribute('data-color');
        });
    });
    
    // Icon selection for new product
    document.querySelectorAll('.icon-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('new-product-icon').value = this.getAttribute('data-icon');
        });
    });
    
    // Filter controls
    const debouncedFilterOrders = debounce(() => filterOrders(), 180);
    document.getElementById('filter-date').addEventListener('change', filterOrders);
    filterProductSelect.addEventListener('change', filterOrders);
    document.getElementById('filter-shop').addEventListener('input', debouncedFilterOrders);
    document.getElementById('filter-payment-status').addEventListener('change', filterOrders);
    document.getElementById('clear-filters').addEventListener('click', clearFilters);
    
    // Export filtered orders as PDF
    exportFilteredPdfBtn.addEventListener('click', function() {
        if (!checkAdminPermission('export PDF')) return;
        exportFilteredOrdersPDF();
    });
    
    // Report controls
    document.querySelectorAll('.btn-period').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.btn-period').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            setReportPeriod(this.getAttribute('data-period'));
        });
    });
    
    generateReportBtn.addEventListener('click', function() {
        if (!AUTH_STATE.isLoggedIn) {
            showNotification('Please login first', 'warning');
            return;
        }
        generateReport();
    });
    
    // PDF Export button
    exportPdfBtn.addEventListener('click', function() {
        if (!checkAdminPermission('export PDF')) return;
        showPDFExportModal();
    });
    
    // Update product price
    document.getElementById('update-price-btn').addEventListener('click', function() {
        if (!checkAdminPermission('update prices')) return;
        updateProductPrice();
    });
    
    // Logout buttons
    logoutBtn.addEventListener('click', handleLogout);
    sidebarLogoutBtn.addEventListener('click', handleLogout);
    
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    
    // Modal close buttons
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.querySelector('.close-product-modal').addEventListener('click', closeProductModal);
    document.getElementById('cancel-export').addEventListener('click', closePDFExportModal);
    
    // Close modals when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target === document.getElementById('edit-modal')) {
            closeModal();
        }
        if (e.target === document.getElementById('edit-product-modal')) {
            closeProductModal();
        }
        if (e.target === document.getElementById('pdf-export-modal')) {
            closePDFExportModal();
        }
    });
}

// Toggle theme
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const moonIcon = themeToggle.querySelector('.fa-moon');
    const sunIcon = themeToggle.querySelector('.fa-sun');
    
    if (document.body.classList.contains('dark-mode')) {
        moonIcon.style.display = 'none';
        sunIcon.style.display = 'block';
        localStorage.setItem('theme', 'dark');
    } else {
        moonIcon.style.display = 'block';
        sunIcon.style.display = 'none';
        localStorage.setItem('theme', 'light');
    }
}

// Handle login
function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = loginRoleSelect.value;
    
    // Demo credentials - In production, this should be server-side authentication
    if (role === 'admin' && username === 'admin' && password === 'admin123') {
        loginUser(username, 'admin');
    } else if (role === 'user' && username === 'user' && password === 'user123') {
        loginUser(username, 'user');
    } else {
        showNotification('Invalid username or password', 'error');
    }
}

// Login user
function loginUser(username, role) {
    AUTH_STATE.isLoggedIn = true;
    AUTH_STATE.role = role;
    AUTH_STATE.username = username;
    
    // Hide login page, show app
    loginPage.style.display = 'none';
    appContainer.style.display = 'flex';
    closeMobileSidebar();
    
    // Set current date and year
    const now = new Date();
    currentDateEl.textContent = now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    currentYearEl.textContent = now.getFullYear();
    
    // Set default dates
    document.getElementById('order-date').valueAsDate = now;
    document.getElementById('filter-date').valueAsDate = now;
    
    // Set report dates (default to current week)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    document.getElementById('report-start-date').valueAsDate = startOfWeek;
    document.getElementById('report-end-date').valueAsDate = now;
    
    // Update UI
    userNameEl.textContent = username;
    userRoleEl.textContent = role === 'admin' ? 'Administrator' : 'User (View Only)';
    sidebarUserNameEl.textContent = username;
    sidebarUserRoleEl.textContent = role === 'admin' ? 'Administrator' : 'Viewer';
    
    logoutBtn.style.display = 'block';
    sidebarLogoutBtn.style.display = 'block';
    
    // Save to localStorage
    localStorage.setItem('currentUser', JSON.stringify({ username, role }));
    
    // Update UI based on role
    updatePermissions();
    switchSection('dashboard');
    
    showNotification(`Welcome ${username}! Logged in as ${role}`, 'success');
    
    // Load data
    requestAnimationFrame(() => {
        loadProducts();
        loadOrders();
    });
}

// Handle logout
function handleLogout() {
    AUTH_STATE.isLoggedIn = false;
    AUTH_STATE.role = 'guest';
    AUTH_STATE.username = 'Guest';
    
    // Show login page, hide app
    loginPage.style.display = 'flex';
    appContainer.style.display = 'none';
    
    // Reset login form
    document.getElementById('login-form').reset();
    
    // Remove from localStorage
    localStorage.removeItem('currentUser');
    
    // Clear data
    allOrders = [];
    filteredOrders = [];
    currentFilteredOrders = [];
    allProducts = [];
    productPrices = {};

    if (typeof unsubscribeOrdersListener === 'function') {
        unsubscribeOrdersListener();
        unsubscribeOrdersListener = null;
    }

    if (typeof unsubscribeProductsListener === 'function') {
        unsubscribeProductsListener();
        unsubscribeProductsListener = null;
    }

    closeMobileSidebar();
    setActiveNavigation('dashboard');
    updatePageContext('dashboard');
    showGlobalLoadingSkeletons();
    
    showNotification('Logged out successfully', 'info');
}

function isFlutterHostEnvironment() {
    return typeof window.flutter_inappwebview !== 'undefined' || /\bwv\b/.test(navigator.userAgent);
}

// Register service worker (only on secure web contexts)
function registerServiceWorker() {
    if (isFlutterHostEnvironment()) {
        return;
    }

    const isWebContext = window.location.protocol === 'http:' || window.location.protocol === 'https:';
    if (!isWebContext || !('serviceWorker' in navigator)) {
        return;
    }

    window.addEventListener('load', async () => {
        try {
            await navigator.serviceWorker.register('./service-worker.js');
        } catch (error) {
            console.error('Service worker registration failed:', error);
        }
    });
}

function initializePWAInstallPrompt() {
    if (!installAppBtn) {
        return;
    }

    if (isRunningStandalone()) {
        hideInstallButton();
        return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        showInstallButton();
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        hideInstallButton();
        showNotification('App installed successfully.', 'success');
    });

    installAppBtn.addEventListener('click', handleInstallApp);
}

function isRunningStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function showInstallButton() {
    if (!installAppBtn) {
        return;
    }
    installAppBtn.style.display = 'inline-flex';
}

function hideInstallButton() {
    if (!installAppBtn) {
        return;
    }
    installAppBtn.style.display = 'none';
}

async function handleInstallApp() {
    if (!deferredInstallPrompt) {
        showNotification('Install option is not available yet in this browser/session.', 'info');
        return;
    }

    try {
        deferredInstallPrompt.prompt();
        const choiceResult = await deferredInstallPrompt.userChoice;

        if (choiceResult.outcome === 'accepted') {
            showNotification('Install request accepted.', 'success');
        } else {
            showNotification('Install canceled.', 'info');
        }
    } catch (error) {
        console.error('Install prompt failed:', error);
        showNotification('Unable to start install. Please try again.', 'error');
    } finally {
        deferredInstallPrompt = null;
        hideInstallButton();
    }
}

function initializeMobileSidebar() {
    if (!sidebar || !sidebarToggleBtn || !sidebarOverlay) {
        return;
    }

    sidebarToggleBtn.addEventListener('click', toggleMobileSidebar);
    sidebarOverlay.addEventListener('click', closeMobileSidebar);

    window.addEventListener('resize', () => {
        if (!isMobileViewport()) {
            closeMobileSidebar();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeMobileSidebar();
            closeModal();
            closeProductModal();
            closePDFExportModal();
        }
    });
}

function initializeMobileViewportSupport() {
    updateMobileViewportMetrics();
    handleResponsiveTableViewportChange();

    const syncViewport = () => {
        updateMobileViewportMetrics();
        ensureFocusedFieldVisible(false);
        handleResponsiveTableViewportChange();
    };

    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', () => {
        setTimeout(syncViewport, 160);
    });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncViewport);
        window.visualViewport.addEventListener('scroll', syncViewport);
    }

    document.addEventListener('focusin', (event) => {
        if (!isEditableField(event.target)) {
            return;
        }

        // Wait one frame so browser native focus scrolling can settle first.
        setTimeout(() => ensureFocusedFieldVisible(true), 80);
    }, true);

    document.addEventListener('focusout', () => {
        setTimeout(updateMobileViewportMetrics, 80);
    }, true);
}

function updateMobileViewportMetrics() {
    const visualViewport = window.visualViewport;
    const visualHeight = visualViewport ? visualViewport.height : window.innerHeight;
    const visualOffsetTop = visualViewport ? visualViewport.offsetTop : 0;
    const bottomInset = Math.max(0, window.innerHeight - (visualHeight + visualOffsetTop));
    const keyboardOpen = isMobileViewport() && bottomInset > MOBILE_KEYBOARD_THRESHOLD;

    document.documentElement.style.setProperty('--keyboard-offset', `${Math.round(bottomInset)}px`);
    document.documentElement.style.setProperty('--mobile-nav-offset', keyboardOpen ? '0px' : `${Math.round(bottomInset)}px`);
    document.body.classList.toggle('keyboard-open', keyboardOpen);
}

function isEditableField(element) {
    if (!element || !(element instanceof HTMLElement)) {
        return false;
    }

    if (element.matches('input, textarea, select') && !element.disabled) {
        return true;
    }

    if (element.isContentEditable) {
        return true;
    }

    return false;
}

function getBottomObstructionHeight() {
    let obstruction = 12;

    const mobileNav = document.querySelector('.mobile-bottom-nav');
    if (mobileNav && getComputedStyle(mobileNav).display !== 'none' && !document.body.classList.contains('keyboard-open')) {
        obstruction += mobileNav.getBoundingClientRect().height;
    }

    const stickyActions = document.querySelector('.content-section.active .form-actions.sticky-mobile');
    if (stickyActions && getComputedStyle(stickyActions).position === 'sticky') {
        obstruction += stickyActions.getBoundingClientRect().height;
    }

    return obstruction;
}

function getTopObstructionHeight() {
    const headerElement = document.querySelector('.header');
    if (!headerElement) {
        return 12;
    }
    return headerElement.getBoundingClientRect().height + 12;
}

function ensureFocusedFieldVisible(forceScroll = false) {
    const activeElement = document.activeElement;
    if (!isEditableField(activeElement)) {
        return;
    }

    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const activeRect = activeElement.getBoundingClientRect();
    const topClearance = getTopObstructionHeight();
    const bottomClearance = getBottomObstructionHeight();
    const isOutOfView = activeRect.top < topClearance || activeRect.bottom > (viewportHeight - bottomClearance);

    if (!forceScroll && !isOutOfView) {
        return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activeElement.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
}

function setModalVisibilityState() {
    const hasOpenModal = MODAL_IDS.some((modalId) => {
        const modalElement = document.getElementById(modalId);
        if (!modalElement) {
            return false;
        }
        return getComputedStyle(modalElement).display !== 'none';
    });

    document.body.classList.toggle('modal-open', hasOpenModal);
}

function openDialogById(modalId) {
    const modalElement = document.getElementById(modalId);
    if (!modalElement) {
        return;
    }

    modalElement.style.display = 'flex';
    setModalVisibilityState();
    updateMobileViewportMetrics();
    ensureFocusedFieldVisible(true);
}

function closeDialogById(modalId) {
    const modalElement = document.getElementById(modalId);
    if (!modalElement) {
        return;
    }

    modalElement.style.display = 'none';
    setModalVisibilityState();
    updateMobileViewportMetrics();
}

function isMobileViewport() {
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

function isMobileTableViewport() {
    return window.matchMedia(`(max-width: ${MOBILE_TABLE_BREAKPOINT}px)`).matches;
}

function getTableAdapter(tableId) {
    return TABLE_ADAPTERS[tableId] || null;
}

function isCardTable(tableId) {
    const adapter = getTableAdapter(tableId);
    return !!adapter && adapter.pattern === 'cards';
}

function hasActiveOrderFilters() {
    const dateFilter = document.getElementById('filter-date')?.value;
    const productFilter = filterProductSelect?.value;
    const shopFilter = document.getElementById('filter-shop')?.value.trim();
    const paymentFilter = document.getElementById('filter-payment-status')?.value;

    return !!(dateFilter || productFilter || shopFilter || paymentFilter);
}

function getDisplayedOrdersForRepaint() {
    if (hasActiveOrderFilters()) {
        return currentFilteredOrders;
    }

    if (filteredOrders.length > 0) {
        return filteredOrders;
    }

    return allOrders;
}

function updateTableScrollHintState(container) {
    if (!container) {
        return;
    }

    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    const atStart = container.scrollLeft <= 2;
    const atEnd = maxScrollLeft - container.scrollLeft <= 2;

    container.classList.toggle('mobile-scroll-start', atStart);
    container.classList.toggle('mobile-scroll-end', atEnd);
}

function applyResponsiveTableClasses() {
    const mobileTableViewport = isMobileTableViewport();

    Object.entries(TABLE_ADAPTERS).forEach(([tableId, adapter]) => {
        const table = document.getElementById(tableId);
        if (!table) {
            return;
        }

        const container = table.closest('.table-container');
        if (!container) {
            return;
        }

        const useCards = mobileTableViewport && adapter.pattern === 'cards';
        const useScrollHint = mobileTableViewport && adapter.pattern === 'scroll';

        table.classList.toggle('mobile-table-cards', useCards);
        container.classList.toggle('mobile-scroll-hint', useScrollHint);

        if (useScrollHint) {
            updateTableScrollHintState(container);
        } else {
            container.classList.remove('mobile-scroll-start', 'mobile-scroll-end');
        }
    });
}

function refreshResponsiveTableViews() {
    if (!AUTH_STATE.isLoggedIn) {
        applyResponsiveTableClasses();
        return;
    }

    const activeSection = getActiveSectionId();
    if (activeSection === 'view-orders') {
        displayOrders(getDisplayedOrdersForRepaint());
    }

    if (activeSection === 'dashboard') {
        updatePendingPayments();
        updateRecentOrders(allOrders.slice(0, 5));
    }

    if (currentReportStartDate && currentReportEndDate) {
        updateReportTable(currentReportOrders);
    } else {
        applyResponsiveTableClasses();
    }
}

function handleResponsiveTableViewportChange() {
    const nextMode = isMobileTableViewport();

    if (nextMode === mobileTableModeActive) {
        applyResponsiveTableClasses();
        return;
    }

    mobileTableModeActive = nextMode;
    refreshResponsiveTableViews();
}

function initializeResponsiveTableAdapters() {
    mobileTableModeActive = isMobileTableViewport();

    Object.keys(TABLE_ADAPTERS).forEach((tableId) => {
        const table = document.getElementById(tableId);
        const container = table ? table.closest('.table-container') : null;
        if (!container) {
            return;
        }

        container.addEventListener('scroll', () => {
            if (container.classList.contains('mobile-scroll-hint')) {
                updateTableScrollHintState(container);
            }
        }, { passive: true });
    });

    applyResponsiveTableClasses();
}

function toggleMobileSidebar() {
    if (!isMobileViewport()) {
        return;
    }

    if (sidebar.classList.contains('open')) {
        closeMobileSidebar();
    } else {
        openMobileSidebar();
    }
}

function openMobileSidebar() {
    if (!sidebar || !sidebarToggleBtn || !sidebarOverlay) {
        return;
    }

    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
    sidebarToggleBtn.setAttribute('aria-expanded', 'true');
    sidebarToggleBtn.setAttribute('aria-label', 'Close navigation menu');
    sidebarToggleBtn.innerHTML = '<i class="fas fa-times"></i>';
    document.body.classList.add('sidebar-open');
}

function closeMobileSidebar() {
    if (!sidebar || !sidebarToggleBtn || !sidebarOverlay) {
        return;
    }

    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    sidebarToggleBtn.setAttribute('aria-expanded', 'false');
    sidebarToggleBtn.setAttribute('aria-label', 'Open navigation menu');
    sidebarToggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    document.body.classList.remove('sidebar-open');
}

function navigateToSection(sectionId) {
    if (!sectionId) {
        return;
    }

    if (!AUTH_STATE.isLoggedIn) {
        showNotification('Please login first', 'warning');
        return;
    }

    const targetItems = Array.from(navItems).filter(item => item.getAttribute('data-section') === sectionId);
    const isAdminOnly = targetItems.some(item => item.classList.contains('admin-only'));
    if (isAdminOnly && AUTH_STATE.role !== 'admin') {
        showNotification('You do not have permission to access this section', 'warning');
        return;
    }

    switchSection(sectionId);
    closeMobileSidebar();
}

function setActiveNavigation(sectionId) {
    navItems.forEach(item => {
        const isActive = item.getAttribute('data-section') === sectionId;
        item.classList.toggle('active', isActive);
        if (isActive) {
            item.setAttribute('aria-current', 'page');
        } else {
            item.removeAttribute('aria-current');
        }
    });
}

function getActiveSectionId() {
    return document.querySelector('.content-section.active')?.id || 'dashboard';
}

function updatePageContext(sectionId) {
    const metadata = SECTION_META[sectionId] || SECTION_META.dashboard;
    if (pageTitleEl) {
        pageTitleEl.textContent = metadata.title;
    }
    if (pageDescriptionEl) {
        pageDescriptionEl.textContent = metadata.description;
    }
}

function initializeNetworkStatus() {
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();
}

function updateNetworkStatus() {
    if (!networkStatusEl) {
        return;
    }

    const isOnline = navigator.onLine;
    networkStatusEl.textContent = isOnline ? 'Online' : 'Offline';
    networkStatusEl.classList.toggle('status-online', isOnline);
    networkStatusEl.classList.toggle('status-offline', !isOnline);
}

function renderTableSkeleton(tableBody, columnCount, rows = 4) {
    if (!tableBody) {
        return;
    }

    const tableId = tableBody.closest('table')?.id;
    const useMobileCardSkeleton = !!tableId && isMobileTableViewport() && isCardTable(tableId);
    const colspan = getTableAdapter(tableId)?.columns || columnCount;

    const skeletonRows = Array.from({ length: rows }, () => {
        if (useMobileCardSkeleton) {
            return `
                <tr class="skeleton-row mobile-table-row">
                    <td colspan="${colspan}" class="mobile-card-cell">
                        <div class="mobile-row-card skeleton-card">
                            <span class="skeleton skeleton-title"></span>
                            <div class="mobile-row-grid">
                                <span class="skeleton skeleton-text"></span>
                                <span class="skeleton skeleton-text"></span>
                                <span class="skeleton skeleton-text"></span>
                            </div>
                            <span class="skeleton skeleton-text"></span>
                        </div>
                    </td>
                </tr>
            `;
        }

        return `
            <tr class="skeleton-row">
                ${Array.from({ length: columnCount }, () => '<td><span class="skeleton skeleton-text"></span></td>').join('')}
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = skeletonRows;
}

function showProductsSkeleton() {
    if (!productsContainer) {
        return;
    }

    productsContainer.innerHTML = `
        <div class="products-skeleton-grid">
            ${Array.from({ length: 4 }, () => `
                <article class="product-card skeleton-card">
                    <div class="skeleton skeleton-block"></div>
                    <div class="product-body">
                        <span class="skeleton skeleton-title"></span>
                        <span class="skeleton skeleton-text"></span>
                        <span class="skeleton skeleton-text"></span>
                    </div>
                </article>
            `).join('')}
        </div>
    `;
}

function showGlobalLoadingSkeletons() {
    renderTableSkeleton(ordersTableBody, 11);
    renderTableSkeleton(recentOrdersTableBody, 7, 3);
    renderTableSkeleton(pendingPaymentsTableBody, 7, 3);
    renderTableSkeleton(reportTableBody, 6, 3);
    applyResponsiveTableClasses();
    showProductsSkeleton();
}

// Check admin permission
function checkAdminPermission(action) {
    if (!AUTH_STATE.isLoggedIn) {
        showNotification('Please login first', 'warning');
        return false;
    }
    
    if (AUTH_STATE.role !== 'admin') {
        showNotification(`You need administrator permission to ${action}`, 'warning');
        return false;
    }
    
    return true;
}

// Update permissions based on role
function updatePermissions() {
    const isAdmin = AUTH_STATE.role === 'admin';
    
    // Show/hide admin-only navigation and actions
    document.querySelectorAll('.admin-only').forEach(item => {
        item.style.display = isAdmin ? '' : 'none';
    });
    
    // Show/hide add product button
    if (toggleAddProductBtn) {
        toggleAddProductBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    }

    document.querySelectorAll('[data-section-nav="add-order"]').forEach(button => {
        button.style.display = isAdmin ? 'inline-flex' : 'none';
    });
    
    // Disable edit buttons for non-admin
    if (!isAdmin) {
        // Disable all action buttons
        document.querySelectorAll('.edit-order, .delete-order, .mark-paid, .btn-edit-product, .btn-delete-product, .btn-collect, #update-price-btn').forEach(btn => {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.disabled = true;
        });
        
        // Disable update price section
        document.querySelectorAll('.update-prices-section input, .update-prices-section select').forEach(el => {
            el.disabled = true;
        });
        
        // Disable PDF export buttons
        if (exportFilteredPdfBtn) exportFilteredPdfBtn.disabled = true;
        if (exportPdfBtn) exportPdfBtn.disabled = true;
    } else {
        document.querySelectorAll('.edit-order, .delete-order, .mark-paid, .btn-edit-product, .btn-delete-product, .btn-collect, #update-price-btn').forEach(btn => {
            btn.style.opacity = '';
            btn.style.cursor = '';
            btn.disabled = false;
        });

        document.querySelectorAll('.update-prices-section input, .update-prices-section select').forEach(el => {
            el.disabled = false;
        });
    }

    const activeAdminSection = ['add-order', 'products'].includes(getActiveSectionId());
    if (!isAdmin && activeAdminSection) {
        navigateToSection('dashboard');
    }
}

// Initialize PDF Export Modal
function initPDFExportModal() {
    const pdfOptionBtns = document.querySelectorAll('.pdf-option-btn');
    
    pdfOptionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const exportType = this.getAttribute('data-type');
            exportToPDF(exportType);
        });
    });
}

// Show PDF Export Modal
function showPDFExportModal() {
    if (currentReportOrders.length === 0) {
        showNotification('Please generate a report first before exporting.', 'warning');
        return;
    }
    
    openDialogById('pdf-export-modal');
}

// Close PDF Export Modal
function closePDFExportModal() {
    closeDialogById('pdf-export-modal');
}

// Export to PDF
function exportToPDF(exportType = 'both') {
    try {
        // Check if jsPDF is loaded
        if (typeof window.jspdf === 'undefined') {
            showNotification('PDF library not loaded. Please check your internet connection.', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Show loading indicator
        const originalText = exportPdfBtn.innerHTML;
        exportPdfBtn.innerHTML = '<div class="loading"></div>Exporting...';
        exportPdfBtn.disabled = true;
        
        // Set up document
        doc.setFontSize(20);
        doc.setTextColor(37, 99, 235);
        doc.text('MG PRODUCTS - Sales Report', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Report Period: ${formatDate(currentReportStartDate)} to ${formatDate(currentReportEndDate)}`, 105, 30, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 36, { align: 'center' });
        doc.text(`Generated by: ${AUTH_STATE.username} (${AUTH_STATE.role})`, 105, 42, { align: 'center' });
        
        let yPos = 50;
        
        if (exportType === 'summary' || exportType === 'both') {
            // Add summary section
            doc.setFontSize(16);
            doc.setTextColor(37, 99, 235);
            doc.text('Report Summary', 20, yPos);
            
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            yPos += 10;
            
            // Calculate summary data
            const totalOrders = currentReportOrders.length;
            const totalRevenue = currentReportOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
            const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
            
            // Calculate paid vs non-paid
            const paidOrders = currentReportOrders.filter(order => {
                const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
                return paymentStatus === 'paid';
            });
            const nonPaidOrders = currentReportOrders.filter(order => {
                const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
                return paymentStatus === 'non-paid';
            });
            const paidAmount = paidOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
            const pendingAmount = nonPaidOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
            
            // Create summary table
            doc.autoTable({
                startY: yPos,
                head: [['Metric', 'Value']],
                body: [
                    ['Total Orders', totalOrders.toString()],
                    ['Total Revenue', `Rs. ${totalRevenue.toFixed(2)}`],
                    ['Average Order Value', `Rs. ${avgOrderValue.toFixed(2)}`],
                    ['Paid Amount', `Rs. ${paidAmount.toFixed(2)}`],
                    ['Pending Amount', `Rs. ${pendingAmount.toFixed(2)}`]
                ],
                theme: 'grid',
                headStyles: { fillColor: [37, 99, 235] },
                margin: { left: 20, right: 20 }
            });
            
            yPos = doc.lastAutoTable.finalY + 15;
        }
        
        if (exportType === 'detailed' || exportType === 'both') {
            // Add detailed report section
            if (exportType === 'both') {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(16);
            doc.setTextColor(37, 99, 235);
            doc.text('Detailed Orders Report', 20, yPos);
            
            // Prepare table data
            const tableData = currentReportOrders.map(order => {
                const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
                return [
                    formatDate(order.date),
                    order.shopName || '',
                    order.product || '',
                    (order.quantity || 0).toString(),
                    `Rs. ${(order.rate || 0).toFixed(2)}`,
                    `Rs. ${parseFloat(order.total || 0).toFixed(2)}`,
                    paymentStatus === 'paid' ? 'Paid' : 'Pending'
                ];
            });
            
            // Add autoTable
            doc.autoTable({
                startY: yPos + 10,
                head: [['Date', 'Shop', 'Product', 'Qty', 'Rate', 'Total', 'Status']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [37, 99, 235] },
                columnStyles: {
                    0: { cellWidth: 25 },
                    1: { cellWidth: 30 },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 15 },
                    4: { cellWidth: 20 },
                    5: { cellWidth: 25 },
                    6: { cellWidth: 20 }
                },
                margin: { left: 15, right: 15 },
                styles: { fontSize: 9 }
            });
            
            // Add summary at the end of detailed report
            if (exportType === 'detailed') {
                yPos = doc.lastAutoTable.finalY + 10;
                const totalRevenue = currentReportOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
                doc.setFontSize(12);
                doc.text(`Total Orders: ${currentReportOrders.length}`, 15, yPos);
                doc.text(`Total Revenue: Rs. ${totalRevenue.toFixed(2)}`, 15, yPos + 7);
            }
        }
        
        // Add footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(128, 128, 128);
            doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
            doc.text('MG PRODUCTS Shop Management System', 105, 290, { align: 'center' });
        }
        
        // Save the PDF
        const fileName = `MG_PRODUCTS_Report_${currentReportStartDate}_to_${currentReportEndDate}.pdf`;
        doc.save(fileName);
        
        // Close modal
        closePDFExportModal();
        
        // Show success message
        showNotification('PDF exported successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting PDF:', error);
        showNotification('Error exporting PDF. Please try again.', 'error');
    } finally {
        // Restore button
        if (exportPdfBtn) {
            exportPdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Export PDF';
            exportPdfBtn.disabled = false;
        }
    }
}

// Export filtered orders as PDF
function exportFilteredOrdersPDF() {
    if (currentFilteredOrders.length === 0) {
        showNotification('No filtered orders to export.', 'warning');
        return;
    }
    
    try {
        // Check if jsPDF is loaded
        if (typeof window.jspdf === 'undefined') {
            showNotification('PDF library not loaded. Please check your internet connection.', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Show loading indicator
        const originalText = exportFilteredPdfBtn.innerHTML;
        exportFilteredPdfBtn.innerHTML = '<div class="loading"></div>Exporting...';
        exportFilteredPdfBtn.disabled = true;
        
        // Set up document
        doc.setFontSize(20);
        doc.setTextColor(37, 99, 235);
        doc.text('MG PRODUCTS - Filtered Orders Report', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Report Generated on: ${new Date().toLocaleDateString()}`, 105, 30, { align: 'center' });
        doc.text(`Generated by: ${AUTH_STATE.username} (${AUTH_STATE.role})`, 105, 36, { align: 'center' });
        
        // Add filter summary
        doc.setFontSize(14);
        doc.setTextColor(37, 99, 235);
        doc.text('Filter Summary', 20, 45);
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        
        // Calculate filtered data
        const totalOrders = currentFilteredOrders.length;
        const totalRevenue = currentFilteredOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
        
        // Calculate paid vs non-paid
        const paidOrders = currentFilteredOrders.filter(order => {
            const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
            return paymentStatus === 'paid';
        });
        const nonPaidOrders = currentFilteredOrders.filter(order => {
            const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
            return paymentStatus === 'non-paid';
        });
        const paidAmount = paidOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
        const pendingAmount = nonPaidOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
        
        // Create summary table
        doc.autoTable({
            startY: 55,
            head: [['Metric', 'Value']],
            body: [
                ['Total Orders', totalOrders.toString()],
                ['Total Revenue', `Rs. ${totalRevenue.toFixed(2)}`],
                ['Paid Amount', `Rs. ${paidAmount.toFixed(2)}`],
                ['Pending Amount', `Rs. ${pendingAmount.toFixed(2)}`]
            ],
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235] },
            margin: { left: 20, right: 20 }
        });
        
        let yPos = doc.lastAutoTable.finalY + 15;
        
        // Add detailed orders
        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235);
        doc.text('Filtered Orders Details', 20, yPos);
        
        // Prepare table data
        const tableData = currentFilteredOrders.map(order => {
            const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
            return [
                formatDate(order.date),
                order.shopName || '',
                order.product || '',
                order.billNumber || '',
                (order.quantity || 0).toString(),
                `Rs. ${(order.rate || 0).toFixed(2)}`,
                `Rs. ${parseFloat(order.total || 0).toFixed(2)}`,
                order.paidDate ? formatDate(order.paidDate) : '-',
                paymentStatus === 'paid' ? 'Paid' : 'Pending',
                order.note || '-'
            ];
        });
        
        // Add autoTable
        doc.autoTable({
            startY: yPos + 10,
            head: [['Date', 'Shop', 'Product', 'Bill No.', 'Qty', 'Rate', 'Total', 'Paid Date', 'Status', 'Note']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235] },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 25 },
                2: { cellWidth: 20 },
                3: { cellWidth: 20 },
                4: { cellWidth: 15 },
                5: { cellWidth: 18 },
                6: { cellWidth: 20 },
                7: { cellWidth: 20 },
                8: { cellWidth: 15 },
                9: { cellWidth: 25 }
            },
            margin: { left: 10, right: 10 },
            styles: { fontSize: 8 }
        });
        
        // Add footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(128, 128, 128);
            doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
            doc.text('MG PRODUCTS Shop Management System', 105, 290, { align: 'center' });
        }
        
        // Save the PDF
        const fileName = `MG_PRODUCTS_Filtered_Orders_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        
        // Show success message
        showNotification('Filtered orders PDF exported successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting filtered orders PDF:', error);
        showNotification('Error exporting PDF. Please try again.', 'error');
    } finally {
        // Restore button
        if (exportFilteredPdfBtn) {
            exportFilteredPdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Export Filtered Report';
            exportFilteredPdfBtn.disabled = false;
        }
    }
}

// Load products from Firebase
function loadProducts() {
    if (!AUTH_STATE.isLoggedIn) return;

    if (typeof unsubscribeProductsListener === 'function') {
        unsubscribeProductsListener();
        unsubscribeProductsListener = null;
    }

    showProductsSkeleton();
    
    const productsQuery = query(collection(db, "products"), orderBy("name"));
    
    unsubscribeProductsListener = onSnapshot(productsQuery, (querySnapshot) => {
        allProducts = [];
        productPrices = {};
        
        querySnapshot.forEach((doc) => {
            const product = doc.data();
            product.id = doc.id;
            allProducts.push(product);
            productPrices[product.name] = product.price;
        });
        
        // Update product displays
        updateProductSelects();
        updateProductCards();
        updateProductPricesDisplay();
        updateProductListSidebar();
        
        // Save product prices to localStorage
        localStorage.setItem('productPrices', JSON.stringify(productPrices));
        
    }, (error) => {
        console.error("Error loading products: ", error);
        
        // If no products exist, create default products
        if (error.code === 'failed-precondition' && AUTH_STATE.role === 'admin') {
            createDefaultProducts();
        }
    });
}

// Create default products if none exist
async function createDefaultProducts() {
    if (AUTH_STATE.role !== 'admin') return;
    
    const defaultProducts = [
        {
            name: "Watalappan",
            price: 95,
            description: "Traditional Sri Lankan dessert made with coconut milk, jaggery, and eggs.",
            color: "#2563EB",
            icon: "fa-utensils",
            createdAt: serverTimestamp()
        },
        {
            name: "Jelly-Pudding",
            price: 95,
            description: "Refreshing jelly-based pudding with layers of fruit flavors.",
            color: "#1F9D57",
            icon: "fa-cookie-bite",
            createdAt: serverTimestamp()
        },
        {
            name: "Biscuit Pudding",
            price: 100,
            description: "Delicious layered pudding made with biscuits and cream.",
            color: "#6366F1",
            icon: "fa-birthday-cake",
            createdAt: serverTimestamp()
        }
    ];
    
    try {
        for (const product of defaultProducts) {
            await addDoc(collection(db, "products"), product);
        }
        console.log("Default products created successfully");
    } catch (error) {
        console.error("Error creating default products: ", error);
    }
}

// Update product selects in forms
function updateProductSelects() {
    // Update product select in add order form
    productSelect.innerHTML = '<option value="">Select a product</option>';
    filterProductSelect.innerHTML = '<option value="">All Products</option>';
    updateProductSelect.innerHTML = '<option value="">Select product</option>';
    
    allProducts.forEach(product => {
        // Add to order form select
        const option = document.createElement('option');
        option.value = product.name;
        option.textContent = product.name;
        productSelect.appendChild(option);
        
        // Add to filter select
        const filterOption = document.createElement('option');
        filterOption.value = product.name;
        filterOption.textContent = product.name;
        filterProductSelect.appendChild(filterOption);
        
        // Add to update price select
        const updateOption = document.createElement('option');
        updateOption.value = product.name;
        updateOption.textContent = product.name;
        updateProductSelect.appendChild(updateOption);
    });
}

// Update product cards display
function updateProductCards() {
    productsContainer.innerHTML = '';
    
    if (allProducts.length === 0) {
        productsContainer.innerHTML = `
            <div class="empty-products">
                <i class="fas fa-box-open"></i>
                <p>No products added yet. Click "Add New Product" to add your first product!</p>
            </div>
        `;
        return;
    }
    
    allProducts.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-header" style="background-color: ${product.color};">
                <i class="fas ${product.icon}"></i>
                <h3>${product.name}</h3>
            </div>
            <div class="product-body">
                <p>${product.description || 'No description available.'}</p>
                <div class="product-price">
                    <span>Price:</span>
                    <strong>Rs. ${product.price}</strong>
                </div>
                <div class="product-actions">
                    <button type="button" class="btn-edit-product" data-id="${product.id}" aria-label="Edit ${product.name}" ${AUTH_STATE.role !== 'admin' ? 'disabled' : ''}>
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button type="button" class="btn-delete-product" data-id="${product.id}" aria-label="Delete ${product.name}" ${AUTH_STATE.role !== 'admin' ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        
        productsContainer.appendChild(productCard);
    });
    
    // Add event listeners to product buttons
    if (AUTH_STATE.role === 'admin') {
        document.querySelectorAll('.btn-edit-product').forEach(btn => {
            btn.addEventListener('click', function() {
                const productId = this.getAttribute('data-id');
                editProduct(productId);
            });
        });
        
        document.querySelectorAll('.btn-delete-product').forEach(btn => {
            btn.addEventListener('click', function() {
                const productId = this.getAttribute('data-id');
                deleteProduct(productId);
            });
        });
    }
}

// Update product prices display in sidebar
function updateProductPricesDisplay() {
    // Update sidebar product list
    updateProductListSidebar();
}

// Update product list in sidebar
function updateProductListSidebar() {
    productListSidebar.innerHTML = '';
    
    allProducts.forEach(product => {
        const li = document.createElement('li');
        li.innerHTML = `
            ${product.name}: <span class="price">Rs. ${product.price}</span>
        `;
        productListSidebar.appendChild(li);
    });
}

// Add new product
async function addProduct() {
    if (!checkAdminPermission('add products')) return;
    
    const name = document.getElementById('new-product-name').value.trim();
    const price = parseFloat(document.getElementById('new-product-price').value);
    const description = document.getElementById('new-product-description').value.trim();
    const color = document.getElementById('new-product-color').value;
    const icon = document.getElementById('new-product-icon').value;
    
    // Validate
    if (!name || !price || price <= 0) {
        showNotification('Please enter a valid product name and price.', 'warning');
        return;
    }
    
    // Check if product already exists
    if (allProducts.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showNotification('A product with this name already exists.', 'warning');
        return;
    }
    
    const product = {
        name,
        price,
        description,
        color,
        icon,
        createdAt: serverTimestamp()
    };
    
    try {
        const docRef = await addDoc(collection(db, "products"), product);
        console.log("Product added with ID: ", docRef.id);
        showNotification('Product added successfully!', 'success');
        
        // Reset and hide form
        addProductForm.reset();
        addProductSection.style.display = 'none';
        toggleAddProductBtn.innerHTML = '<i class="fas fa-plus"></i> Add New Product';
        toggleAddProductBtn.classList.remove('btn-secondary');
        toggleAddProductBtn.classList.add('btn-primary');
        
    } catch (error) {
        console.error("Error adding product: ", error);
        showNotification('Error adding product. Please try again.', 'error');
    }
}

// Edit product - Using same UI as Add Product
function editProduct(productId) {
    if (!checkAdminPermission('edit products')) return;
    
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    const modalBody = document.querySelector('#edit-product-modal .modal-body');
    modalBody.innerHTML = `
        <form id="edit-product-form">
            <div class="form-row">
                <div class="form-group">
                    <label for="edit-product-name"><i class="fas fa-tag"></i> Product Name</label>
                    <input type="text" id="edit-product-name" value="${product.name}" placeholder="Enter product name" required>
                </div>
                <div class="form-group">
                    <label for="edit-product-price"><i class="fas fa-money-bill"></i> Price (Rs.)</label>
                    <input type="number" id="edit-product-price" min="1" value="${product.price}" placeholder="Enter price" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="edit-product-description"><i class="fas fa-align-left"></i> Description</label>
                    <textarea id="edit-product-description" rows="2" placeholder="Enter product description">${product.description || ''}</textarea>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="edit-product-color"><i class="fas fa-palette"></i> Box Color</label>
                    <div class="color-options">
                        <div class="color-option" data-color="#2563EB" style="background-color: #2563EB;"></div>
                        <div class="color-option" data-color="#1F9D57" style="background-color: #1F9D57;"></div>
                        <div class="color-option" data-color="#0EA5E9" style="background-color: #0EA5E9;"></div>
                        <div class="color-option" data-color="#6366F1" style="background-color: #6366F1;"></div>
                        <div class="color-option" data-color="#B7791F" style="background-color: #B7791F;"></div>
                        <div class="color-option" data-color="#C53030" style="background-color: #C53030;"></div>
                        <div class="color-option" data-color="#475569" style="background-color: #475569;"></div>
                        <div class="color-option" data-color="#0F172A" style="background-color: #0F172A;"></div>
                    </div>
                    <input type="hidden" id="edit-product-color" value="${product.color || '#2563EB'}" required>
                </div>
                
                <div class="form-group">
                    <label for="edit-product-icon"><i class="fas fa-icons"></i> Product Icon</label>
                    <div class="icon-options">
                        <div class="icon-option" data-icon="fa-utensils"><i class="fas fa-utensils"></i></div>
                        <div class="icon-option" data-icon="fa-cookie-bite"><i class="fas fa-cookie-bite"></i></div>
                        <div class="icon-option" data-icon="fa-birthday-cake"><i class="fas fa-birthday-cake"></i></div>
                        <div class="icon-option" data-icon="fa-ice-cream"><i class="fas fa-ice-cream"></i></div>
                        <div class="icon-option" data-icon="fa-mug-hot"><i class="fas fa-mug-hot"></i></div>
                        <div class="icon-option" data-icon="fa-bread-slice"><i class="fas fa-bread-slice"></i></div>
                        <div class="icon-option" data-icon="fa-pie-chart"><i class="fas fa-pie-chart"></i></div>
                        <div class="icon-option" data-icon="fa-cheese"><i class="fas fa-cheese"></i></div>
                        <div class="icon-option" data-icon="fa-candy-cane"><i class="fas fa-candy-cane"></i></div>
                        <div class="icon-option" data-icon="fa-wine-bottle"><i class="fas fa-wine-bottle"></i></div>
                    </div>
                    <input type="hidden" id="edit-product-icon" value="${product.icon || 'fa-utensils'}" required>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i> Update Product
                </button>
                <button type="button" class="btn btn-secondary close-product-modal">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </form>
    `;
    
    // Set selected color and icon
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.remove('selected');
        if (opt.getAttribute('data-color') === product.color) {
            opt.classList.add('selected');
        }
    });
    
    document.querySelectorAll('.icon-option').forEach(opt => {
        opt.classList.remove('selected');
        if (opt.getAttribute('data-icon') === product.icon) {
            opt.classList.add('selected');
        }
    });
    
    // Color selection
    document.querySelectorAll('#edit-product-form .color-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('#edit-product-form .color-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('edit-product-color').value = this.getAttribute('data-color');
        });
    });
    
    // Icon selection
    document.querySelectorAll('#edit-product-form .icon-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('#edit-product-form .icon-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('edit-product-icon').value = this.getAttribute('data-icon');
        });
    });
    
    // Form submission
    document.getElementById('edit-product-form').addEventListener('submit', function(e) {
        e.preventDefault();
        updateProductInFirebase(productId);
    });
    
    // Cancel button
    document.querySelector('#edit-product-form .close-product-modal').addEventListener('click', closeProductModal);
    
    // Show modal
    openDialogById('edit-product-modal');
}

// Update product in Firebase
async function updateProductInFirebase(productId) {
    if (!checkAdminPermission('update products')) return;
    
    const name = document.getElementById('edit-product-name').value.trim();
    const price = parseFloat(document.getElementById('edit-product-price').value);
    const description = document.getElementById('edit-product-description').value.trim();
    const color = document.getElementById('edit-product-color').value;
    const icon = document.getElementById('edit-product-icon').value;
    
    // Validate
    if (!name || !price || price <= 0) {
        showNotification('Please enter a valid product name and price.', 'warning');
        return;
    }
    
    // Check if product name already exists (excluding current product)
    if (allProducts.some(p => p.id !== productId && p.name.toLowerCase() === name.toLowerCase())) {
        showNotification('A product with this name already exists.', 'warning');
        return;
    }
    
    const updatedProduct = {
        name,
        price,
        description,
        color,
        icon,
        updatedAt: serverTimestamp()
    };
    
    try {
        await updateDoc(doc(db, "products", productId), updatedProduct);
        showNotification('Product updated successfully!', 'success');
        closeProductModal();
        
        // Also update any existing orders with the old product name
        await updateOrdersWithNewProductName(productId, name, price);
        
    } catch (error) {
        console.error("Error updating product: ", error);
        showNotification('Error updating product. Please try again.', 'error');
    }
}

// Update orders when product name changes
async function updateOrdersWithNewProductName(productId, newName, newPrice) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    const oldName = product.name;
    
    if (oldName === newName) return; // No change in name
    
    try {
        // Get all orders with the old product name
        const ordersQuery = query(collection(db, "orders"));
        const querySnapshot = await getDocs(ordersQuery);
        
        const updatePromises = [];
        querySnapshot.forEach((orderDoc) => {
            const order = orderDoc.data();
            if (order.product === oldName) {
                updatePromises.push(
                    updateDoc(doc(db, "orders", orderDoc.id), {
                        product: newName,
                        rate: newPrice,
                        total: order.quantity * newPrice,
                        updatedAt: serverTimestamp()
                    })
                );
            }
        });
        
        await Promise.all(updatePromises);
        console.log(`Updated ${updatePromises.length} orders with new product name`);
        
    } catch (error) {
        console.error("Error updating orders with new product name: ", error);
    }
}

// Delete product
async function deleteProduct(productId) {
    if (!checkAdminPermission('delete products')) return;
    
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    if (!confirm(`Are you sure you want to delete "${product.name}"? This will also delete all orders for this product.`)) {
        return;
    }
    
    try {
        // First, delete all orders for this product
        const ordersQuery = query(collection(db, "orders"));
        const querySnapshot = await getDocs(ordersQuery);
        
        const deletePromises = [];
        querySnapshot.forEach((orderDoc) => {
            const order = orderDoc.data();
            if (order.product === product.name) {
                deletePromises.push(deleteDoc(doc(db, "orders", orderDoc.id)));
            }
        });
        
        // Wait for all orders to be deleted
        await Promise.all(deletePromises);
        
        // Then delete the product
        await deleteDoc(doc(db, "products", productId));
        
        showNotification('Product and related orders deleted successfully!', 'success');
        
    } catch (error) {
        console.error("Error deleting product: ", error);
        showNotification('Error deleting product. Please try again.', 'error');
    }
}

// Update product price from update form
async function updateProductPrice() {
    if (!checkAdminPermission('update prices')) return;
    
    const productName = updateProductSelect.value;
    const newPrice = parseFloat(document.getElementById('new-price').value);
    
    if (!productName || !newPrice || newPrice <= 0) {
        showNotification('Please select a product and enter a valid price.', 'warning');
        return;
    }
    
    const product = allProducts.find(p => p.name === productName);
    if (!product) {
        showNotification('Product not found.', 'error');
        return;
    }
    
    try {
        // Update product price
        await updateDoc(doc(db, "products", product.id), {
            price: newPrice,
            updatedAt: serverTimestamp()
        });
        
        // Also update all orders with this product
        const ordersQuery = query(collection(db, "orders"));
        const querySnapshot = await getDocs(ordersQuery);
        
        const updatePromises = [];
        querySnapshot.forEach((orderDoc) => {
            const order = orderDoc.data();
            if (order.product === productName) {
                updatePromises.push(
                    updateDoc(doc(db, "orders", orderDoc.id), {
                        rate: newPrice,
                        total: order.quantity * newPrice,
                        updatedAt: serverTimestamp()
                    })
                );
            }
        });
        
        await Promise.all(updatePromises);
        
        showNotification(`Price updated for ${productName} and all related orders!`, 'success');
        
        // Clear form
        updateProductSelect.value = '';
        document.getElementById('new-price').value = '';
        
    } catch (error) {
        console.error("Error updating product price: ", error);
        showNotification('Error updating product price. Please try again.', 'error');
    }
}

// Close product modal
function closeProductModal() {
    closeDialogById('edit-product-modal');
}

// Close modal
function closeModal() {
    closeDialogById('edit-modal');
}

// Switch between sections
function switchSection(sectionId) {
    contentSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === sectionId) {
            section.classList.add('active');
        }
    });

    setActiveNavigation(sectionId);
    updatePageContext(sectionId);
    
    // Refresh data for certain sections
    if (sectionId === 'dashboard') {
        updateDashboard();
    } else if (sectionId === 'view-orders') {
        if (hasActiveOrderFilters()) {
            filterOrders(true);
        } else {
            displayOrders(allOrders);
        }
    } else if (sectionId === 'reports') {
        ensureChartInitialized();
    }
}

// Calculate total amount
function calculateTotal() {
    const quantity = parseInt(quantityInput.value) || 0;
    const rate = parseFloat(rateInput.value) || 0;
    const total = quantity * rate;
    totalInput.value = total.toFixed(2);
}

// Update rate based on selected product
function updateRateByProduct() {
    const selectedProduct = productSelect.value;
    if (selectedProduct && productPrices[selectedProduct]) {
        rateInput.value = productPrices[selectedProduct];
        calculateTotal();
    }
}

// Load orders from Firebase
function loadOrders() {
    if (!AUTH_STATE.isLoggedIn) return;

    if (typeof unsubscribeOrdersListener === 'function') {
        unsubscribeOrdersListener();
        unsubscribeOrdersListener = null;
    }

    renderTableSkeleton(ordersTableBody, 11);
    renderTableSkeleton(recentOrdersTableBody, 7, 3);
    renderTableSkeleton(pendingPaymentsTableBody, 7, 3);
    
    const ordersQuery = query(collection(db, "orders"), orderBy("date", "desc"));
    
    unsubscribeOrdersListener = onSnapshot(ordersQuery, (querySnapshot) => {
        allOrders = [];
        querySnapshot.forEach((doc) => {
            const order = doc.data();
            order.id = doc.id;
            allOrders.push(order);
        });

        const viewOrdersActive = getActiveSectionId() === 'view-orders';
        if (viewOrdersActive) {
            if (hasActiveOrderFilters()) {
                filterOrders(true);
            } else {
                displayOrders(allOrders);
            }
        } else {
            filteredOrders = allOrders;
            currentFilteredOrders = allOrders;
        }

        updateDashboard();
        updatePendingPayments();
        
        // Update recent orders
        updateRecentOrders(allOrders.slice(0, 5));
    }, (error) => {
        console.error("Error loading orders: ", error);
        showNotification('Error loading orders. Please check your internet connection.', 'error');
    });
}

// Display orders in table
function renderOrderDesktopRow(order, paymentStatus, statusBadge, editDisabled, deleteDisabled, printDisabled, markPaidDisabled) {
    return `
        <td>${formatDate(order.date)}</td>
        <td>${order.shopName}</td>
        <td>${order.product}</td>
        <td>${order.billNumber}</td>
        <td>${order.quantity}</td>
        <td>Rs. ${order.rate}</td>
        <td>Rs. ${order.total}</td>
        <td>${order.paidDate ? formatDate(order.paidDate) : '-'}</td>
        <td>${statusBadge}</td>
        <td>${order.note || '-'}</td>
        <td>
            <button class="btn-action edit-order" data-id="${order.id}" aria-label="Edit order" ${editDisabled}>
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-action delete-order" data-id="${order.id}" aria-label="Delete order" ${deleteDisabled}>
                <i class="fas fa-trash"></i>
            </button>
            <button class="btn-action print-order" data-id="${order.id}" aria-label="Print bill" ${printDisabled}>
                <i class="fas fa-print"></i>
            </button>
            <button class="btn-action mark-paid" data-id="${order.id}" data-status="${paymentStatus}" aria-label="${paymentStatus === 'paid' ? 'Mark as unpaid' : 'Mark as paid'}" ${markPaidDisabled}>
                <i class="fas ${paymentStatus === 'paid' ? 'fa-undo' : 'fa-check'}"></i>
            </button>
        </td>
    `;
}

function renderOrderMobileRow(order, paymentStatus, statusBadge, editDisabled, deleteDisabled, printDisabled, markPaidDisabled) {
    const noteText = order.note ? order.note : '-';
    const markPaidText = paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid';

    return `
        <td colspan="11" class="mobile-card-cell">
            <article class="mobile-row-card" role="group" aria-label="Order ${order.billNumber} for ${order.shopName}">
                <div class="mobile-row-head">
                    <p class="mobile-row-title">${order.shopName}</p>
                    <span class="mobile-row-status">${statusBadge}</span>
                </div>
                <div class="mobile-row-grid">
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Date</span>
                        <span class="mobile-row-value">${formatDate(order.date)}</span>
                    </div>
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Product</span>
                        <span class="mobile-row-value">${order.product}</span>
                    </div>
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Bill No.</span>
                        <span class="mobile-row-value">${order.billNumber}</span>
                    </div>
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Qty</span>
                        <span class="mobile-row-value">${order.quantity}</span>
                    </div>
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Total</span>
                        <span class="mobile-row-value">Rs. ${order.total}</span>
                    </div>
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Paid Date</span>
                        <span class="mobile-row-value">${order.paidDate ? formatDate(order.paidDate) : '-'}</span>
                    </div>
                    <div class="mobile-row-field mobile-row-field-full">
                        <span class="mobile-row-label">Note</span>
                        <span class="mobile-row-value">${noteText}</span>
                    </div>
                </div>
                <div class="mobile-row-actions mobile-row-order-actions" role="group" aria-label="Order actions">
                    <button class="btn-action edit-order mobile-row-action" data-id="${order.id}" aria-label="Edit order" ${editDisabled}>
                        <i class="fas fa-edit" aria-hidden="true"></i>
                        <span>Edit</span>
                    </button>
                    <button class="btn-action delete-order mobile-row-action" data-id="${order.id}" aria-label="Delete order" ${deleteDisabled}>
                        <i class="fas fa-trash" aria-hidden="true"></i>
                        <span>Delete</span>
                    </button>
                    <button class="btn-action print-order mobile-row-action" data-id="${order.id}" aria-label="Print bill" ${printDisabled}>
                        <i class="fas fa-print" aria-hidden="true"></i>
                        <span>Print</span>
                    </button>
                    <button class="btn-action mark-paid mobile-row-action" data-id="${order.id}" data-status="${paymentStatus}" aria-label="${paymentStatus === 'paid' ? 'Mark as unpaid' : 'Mark as paid'}" ${markPaidDisabled}>
                        <i class="fas ${paymentStatus === 'paid' ? 'fa-undo' : 'fa-check'}" aria-hidden="true"></i>
                        <span>${markPaidText}</span>
                    </button>
                </div>
            </article>
        </td>
    `;
}

function displayOrders(orders) {
    filteredOrders = orders;
    currentFilteredOrders = orders;
    
    if (orders.length === 0) {
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="11">
                    <div class="empty-state">
                        <i class="fas fa-inbox" aria-hidden="true"></i>
                        <p>No orders found for the selected filters.</p>
                    </div>
                </td>
            </tr>
        `;
        updateFilterSummary(orders);
        applyResponsiveTableClasses();
        return;
    }

    const isMobile = isMobileTableViewport();
    const isAdmin = AUTH_STATE.role === 'admin';
    const editDisabled = isAdmin ? '' : 'disabled';
    const deleteDisabled = isAdmin ? '' : 'disabled';
    const printDisabled = isAdmin ? '' : 'disabled';
    const markPaidDisabled = isAdmin ? '' : 'disabled';

    const rowsHtml = orders.map((order) => {
        const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
        const statusText = paymentStatus === 'paid' ? 'Paid' : 'Non-Paid';
        const statusBadge = `<span class="payment-badge ${paymentStatus}">${statusText}</span>`;
        const rowContent = isMobile
            ? renderOrderMobileRow(order, paymentStatus, statusBadge, editDisabled, deleteDisabled, printDisabled, markPaidDisabled)
            : renderOrderDesktopRow(order, paymentStatus, statusBadge, editDisabled, deleteDisabled, printDisabled, markPaidDisabled);
        const rowClass = isMobile ? ' class="mobile-table-row"' : '';
        return `<tr${rowClass}>${rowContent}</tr>`;
    }).join('');

    ordersTableBody.innerHTML = rowsHtml;
    
    // Update filter summary
    updateFilterSummary(orders);
    applyResponsiveTableClasses();
}

// Update filter summary
function updateFilterSummary(orders) {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
    
    // Calculate paid vs non-paid
    const paidOrders = orders.filter(order => {
        const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
        return paymentStatus === 'paid';
    });
    const nonPaidOrders = orders.filter(order => {
        const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
        return paymentStatus === 'non-paid';
    });
    const paidAmount = paidOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
    const pendingAmount = nonPaidOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
    
    // Update UI
    filteredOrdersCountEl.textContent = totalOrders;
    filteredTotalRevenueEl.textContent = `Rs. ${totalRevenue.toFixed(2)}`;
    filteredPaidAmountEl.textContent = `Rs. ${paidAmount.toFixed(2)}`;
    filteredPendingAmountEl.textContent = `Rs. ${pendingAmount.toFixed(2)}`;
    
    // Enable/disable export button
    exportFilteredPdfBtn.disabled = totalOrders === 0 || AUTH_STATE.role !== 'admin';
}

function initializeDelegatedTableActions() {
    if (ordersTableBody) {
        ordersTableBody.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (!button || !ordersTableBody.contains(button) || AUTH_STATE.role !== 'admin') {
                return;
            }

            const orderId = button.getAttribute('data-id');
            if (!orderId) {
                return;
            }

            if (button.classList.contains('edit-order')) {
                editOrder(orderId);
                return;
            }
            if (button.classList.contains('delete-order')) {
                deleteOrder(orderId);
                return;
            }
            if (button.classList.contains('print-order')) {
                printOrderBill(orderId);
                return;
            }
            if (button.classList.contains('mark-paid')) {
                const currentStatus = button.getAttribute('data-status');
                togglePaymentStatus(orderId, currentStatus);
            }
        });
    }

    if (pendingPaymentsTableBody) {
        pendingPaymentsTableBody.addEventListener('click', (event) => {
            const button = event.target.closest('.btn-collect');
            if (!button || !pendingPaymentsTableBody.contains(button) || AUTH_STATE.role !== 'admin') {
                return;
            }

            const orderId = button.getAttribute('data-id');
            if (orderId) {
                markAsPaid(orderId);
            }
        });
    }

    if (recentOrdersTableBody) {
        recentOrdersTableBody.addEventListener('click', (event) => {
            const button = event.target.closest('.mark-paid');
            if (!button || !recentOrdersTableBody.contains(button) || AUTH_STATE.role !== 'admin') {
                return;
            }

            const orderId = button.getAttribute('data-id');
            const currentStatus = button.getAttribute('data-status');
            if (orderId) {
                togglePaymentStatus(orderId, currentStatus);
            }
        });
    }
}

// Update pending payments table in dashboard
function renderPendingPaymentDesktopRow(order, daysPending, daysClass, collectDisabled) {
    return `
        <td><strong>${order.shopName}</strong></td>
        <td>${formatDate(order.date)}</td>
        <td>${order.product}</td>
        <td>${order.quantity}</td>
        <td><strong>Rs. ${order.total}</strong></td>
        <td><span class="days-pending ${daysClass}">${daysPending} days</span></td>
        <td>
            <button class="btn-collect" data-id="${order.id}" ${collectDisabled}>
                <i class="fas fa-money-bill-wave"></i> Mark as Paid
            </button>
        </td>
    `;
}

function renderPendingPaymentMobileRow(order, daysPending, daysClass, collectDisabled) {
    return `
        <td colspan="7" class="mobile-card-cell">
            <article class="mobile-row-card" role="group" aria-label="Pending payment for ${order.shopName}">
                <div class="mobile-row-head">
                    <p class="mobile-row-title">${order.shopName}</p>
                    <span class="mobile-row-status"><span class="days-pending ${daysClass}">${daysPending} days</span></span>
                </div>
                <div class="mobile-row-grid">
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Order Date</span>
                        <span class="mobile-row-value">${formatDate(order.date)}</span>
                    </div>
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Product</span>
                        <span class="mobile-row-value">${order.product}</span>
                    </div>
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Quantity</span>
                        <span class="mobile-row-value">${order.quantity}</span>
                    </div>
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Total</span>
                        <span class="mobile-row-value">Rs. ${order.total}</span>
                    </div>
                </div>
                <div class="mobile-row-actions" role="group" aria-label="Payment actions">
                    <button class="btn-collect mobile-row-action mobile-row-action-full" data-id="${order.id}" ${collectDisabled}>
                        <i class="fas fa-money-bill-wave" aria-hidden="true"></i>
                        <span>Mark as Paid</span>
                    </button>
                </div>
            </article>
        </td>
    `;
}

function updatePendingPayments() {
    // Get non-paid orders
    const nonPaidOrders = allOrders.filter(order => {
        const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
        return paymentStatus === 'non-paid';
    });
    
    if (nonPaidOrders.length === 0) {
        pendingPaymentsTableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state compact">
                        <i class="fas fa-check-circle" aria-hidden="true"></i>
                        <p>No pending payments. All current orders are settled.</p>
                    </div>
                </td>
            </tr>
        `;
        applyResponsiveTableClasses();
        return;
    }

    const isMobile = isMobileTableViewport();
    const collectDisabled = AUTH_STATE.role === 'admin' ? '' : 'disabled';
    const today = new Date();

    const rowsHtml = nonPaidOrders.map((order) => {
        const orderDate = new Date(order.date);
        const daysPending = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));
        const daysClass = daysPending > 7 ? 'overdue' : '';
        const rowContent = isMobile
            ? renderPendingPaymentMobileRow(order, daysPending, daysClass, collectDisabled)
            : renderPendingPaymentDesktopRow(order, daysPending, daysClass, collectDisabled);
        const rowClass = isMobile ? ' class="mobile-table-row"' : '';
        return `<tr${rowClass}>${rowContent}</tr>`;
    }).join('');

    pendingPaymentsTableBody.innerHTML = rowsHtml;

    applyResponsiveTableClasses();
}

// Mark order as paid (for dashboard quick action)
async function markAsPaid(orderId) {
    if (!checkAdminPermission('mark orders as paid')) return;
    
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const paidDate = new Date().toISOString().split('T')[0];
    
    const updatedOrder = {
        paymentStatus: 'paid',
        paidDate: paidDate,
        updatedAt: serverTimestamp()
    };
    
    try {
        await updateDoc(doc(db, "orders", orderId), updatedOrder);
        showNotification(`Payment collected from ${order.shopName}!`, 'success');
    } catch (error) {
        console.error("Error updating payment status: ", error);
        showNotification('Error updating payment status. Please try again.', 'error');
    }
}

// Toggle payment status
async function togglePaymentStatus(orderId, currentStatus) {
    if (!checkAdminPermission('update payment status')) return;
    
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const newStatus = currentStatus === 'paid' ? 'non-paid' : 'paid';
    const paidDate = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;
    
    const updatedOrder = {
        paymentStatus: newStatus,
        paidDate: paidDate,
        updatedAt: serverTimestamp()
    };
    
    try {
        await updateDoc(doc(db, "orders", orderId), updatedOrder);
        const statusText = newStatus === 'paid' ? 'Paid' : 'Non-Paid';
        showNotification(`Order marked as ${statusText} successfully!`, 'success');
    } catch (error) {
        console.error("Error updating payment status: ", error);
        showNotification('Error updating payment status. Please try again.', 'error');
    }
}

// Update recent orders
function renderRecentOrderDesktopRow(order, paymentStatus, statusBadge, markPaidDisabled) {
    return `
        <td>${formatDate(order.date)}</td>
        <td>${order.shopName}</td>
        <td>${order.product}</td>
        <td>${order.quantity}</td>
        <td>Rs. ${order.total}</td>
        <td>${statusBadge}</td>
        <td>
            <button class="btn-action mark-paid compact" data-id="${order.id}" data-status="${paymentStatus}" ${markPaidDisabled}>
                <i class="fas ${paymentStatus === 'paid' ? 'fa-undo' : 'fa-check'}"></i> ${paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
            </button>
        </td>
    `;
}

function renderRecentOrderMobileRow(order, paymentStatus, statusBadge, markPaidDisabled) {
    const markPaidText = paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid';

    return `
        <td colspan="7" class="mobile-card-cell">
            <article class="mobile-row-card" role="group" aria-label="Recent order from ${order.shopName}">
                <div class="mobile-row-head">
                    <p class="mobile-row-title">${order.shopName}</p>
                    <span class="mobile-row-status">${statusBadge}</span>
                </div>
                <div class="mobile-row-grid">
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Date</span>
                        <span class="mobile-row-value">${formatDate(order.date)}</span>
                    </div>
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Product</span>
                        <span class="mobile-row-value">${order.product}</span>
                    </div>
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Quantity</span>
                        <span class="mobile-row-value">${order.quantity}</span>
                    </div>
                    <div class="mobile-row-field">
                        <span class="mobile-row-label">Total</span>
                        <span class="mobile-row-value">Rs. ${order.total}</span>
                    </div>
                </div>
                <div class="mobile-row-actions" role="group" aria-label="Recent order actions">
                    <button class="btn-action mark-paid compact mobile-row-action mobile-row-action-full" data-id="${order.id}" data-status="${paymentStatus}" ${markPaidDisabled}>
                        <i class="fas ${paymentStatus === 'paid' ? 'fa-undo' : 'fa-check'}" aria-hidden="true"></i>
                        <span>${markPaidText}</span>
                    </button>
                </div>
            </article>
        </td>
    `;
}

function updateRecentOrders(orders) {
    if (orders.length === 0) {
        recentOrdersTableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state compact">
                        <p>No recent orders yet.</p>
                    </div>
                </td>
            </tr>
        `;
        applyResponsiveTableClasses();
        return;
    }

    const isMobile = isMobileTableViewport();
    const markPaidDisabled = AUTH_STATE.role === 'admin' ? '' : 'disabled';

    const rowsHtml = orders.map((order) => {
        const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
        const statusText = paymentStatus === 'paid' ? 'Paid' : 'Non-Paid';
        const statusBadge = `<span class="payment-badge ${paymentStatus}">${statusText}</span>`;
        const rowContent = isMobile
            ? renderRecentOrderMobileRow(order, paymentStatus, statusBadge, markPaidDisabled)
            : renderRecentOrderDesktopRow(order, paymentStatus, statusBadge, markPaidDisabled);
        const rowClass = isMobile ? ' class="mobile-table-row"' : '';
        return `<tr${rowClass}>${rowContent}</tr>`;
    }).join('');

    recentOrdersTableBody.innerHTML = rowsHtml;

    applyResponsiveTableClasses();
}

// Update dashboard
function updateDashboard() {
    if (allOrders.length === 0) {
        resetDashboard();
        return;
    }

    const totalOrders = allOrders.length;
    const today = new Date().toISOString().split('T')[0];
    const uniqueShops = new Set();
    let totalRevenue = 0;
    let todayOrdersCount = 0;
    let todayRevenue = 0;
    let paidAmount = 0;
    let pendingAmount = 0;

    for (const order of allOrders) {
        const orderTotal = parseFloat(order.total || 0);
        totalRevenue += orderTotal;

        if (order.date === today) {
            todayOrdersCount += 1;
            todayRevenue += orderTotal;
        }

        if (order.shopName) {
            uniqueShops.add(order.shopName);
        }

        const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
        if (paymentStatus === 'paid') {
            paidAmount += orderTotal;
        } else {
            pendingAmount += orderTotal;
        }
    }
    
    // Update UI
    totalOrdersEl.textContent = totalOrders;
    totalRevenueEl.textContent = `Rs. ${totalRevenue.toFixed(2)}`;
    todayOrdersEl.textContent = todayOrdersCount;
    todayRevenueEl.textContent = `Rs. ${todayRevenue.toFixed(2)}`;
    dashboardTodayRevenueEl.textContent = `Rs. ${todayRevenue.toFixed(2)}`;
    activeShopsEl.textContent = uniqueShops.size;
    dashboardPendingPaymentsEl.textContent = `Rs. ${pendingAmount.toFixed(2)}`;
    paidAmountEl.textContent = `Rs. ${paidAmount.toFixed(2)}`;
    sidebarPendingPaymentsEl.textContent = `Rs. ${pendingAmount.toFixed(2)}`;
}

// Reset dashboard when no orders
function resetDashboard() {
    totalOrdersEl.textContent = '0';
    totalRevenueEl.textContent = 'Rs. 0';
    todayOrdersEl.textContent = '0';
    todayRevenueEl.textContent = 'Rs. 0';
    dashboardTodayRevenueEl.textContent = 'Rs. 0';
    activeShopsEl.textContent = '0';
    dashboardPendingPaymentsEl.textContent = 'Rs. 0';
    paidAmountEl.textContent = 'Rs. 0';
    sidebarPendingPaymentsEl.textContent = 'Rs. 0';
}

// Request bill printing from Flutter app
async function requestBillPrint(orderData) {
    if (!window.flutter_inappwebview || typeof window.flutter_inappwebview.callHandler !== 'function') {
        showNotification('Bill printing is available in the mobile app.', 'warning');
        return;
    }

    try {
        const result = await window.flutter_inappwebview.callHandler('printBill', orderData);
        if (result && result.success) {
            showNotification(result.message || 'Bill printed successfully!', 'success');
        } else {
            showNotification((result && result.message) || 'Bill printing failed.', 'warning');
        }
    } catch (error) {
        console.error('Error while printing bill: ', error);
        showNotification('Unable to print bill. Please check printer connection.', 'error');
    }
}
function buildPrintableOrder(order) {
    const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');

    return {
        id: order.id || '',
        billNumber: order.billNumber || '',
        date: order.date || '',
        shopName: order.shopName || '',
        product: order.product || '',
        quantity: Number(order.quantity) || 0,
        rate: Number(order.rate) || 0,
        total: Number(order.total) || 0,
        paymentStatus,
        paidDate: order.paidDate || '',
        note: order.note || ''
    };
}

async function printOrderBill(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        showNotification('Order not found for printing.', 'warning');
        return;
    }

    await requestBillPrint(buildPrintableOrder(order));
}
// Save order to Firebase
async function saveOrder() {
    if (!checkAdminPermission('save orders')) return;
    
    const shopName = document.getElementById('shop-name').value;
    const orderDate = document.getElementById('order-date').value;
    const product = document.getElementById('product').value;
    const billNumber = document.getElementById('bill-number').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    const rate = parseFloat(document.getElementById('rate').value);
    const total = parseFloat(document.getElementById('total').value);
    const paymentStatus = document.getElementById('payment-status').value;
    const paidDate = paymentStatus === 'paid' ? document.getElementById('paid-date').value : null;
    const note = document.getElementById('note').value;
    const shouldPrintBillAfterSave = Boolean(printBillAfterSaveInput?.checked);
    
    const order = {
        shopName,
        date: orderDate,
        product,
        billNumber,
        quantity,
        rate,
        total,
        paymentStatus,
        paidDate,
        note,
        createdAt: serverTimestamp()
    };
    
    try {
        const docRef = await addDoc(collection(db, "orders"), order);
        console.log("Order saved with ID: ", docRef.id);
        showNotification('Order saved successfully!', 'success');

        const savedOrder = {
            id: docRef.id,
            ...order
        };

        if (shouldPrintBillAfterSave) {
            await requestBillPrint(buildPrintableOrder(savedOrder));
        }
        
        // Auto reset form
        orderForm.reset();
        
        // Reset form dates
        const now = new Date();
        document.getElementById('order-date').valueAsDate = now;
        document.getElementById('payment-status').value = 'non-paid';
        paidDateInput.disabled = true;
        
        // Switch to dashboard
        switchSection('dashboard');
    } catch (error) {
        console.error("Error saving order: ", error);
        showNotification('Error saving order. Please try again.', 'error');
    }
}

// Edit order
function editOrder(orderId) {
    if (!checkAdminPermission('edit orders')) return;
    
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
    
    const modalBody = document.querySelector('.modal-body');
    modalBody.innerHTML = `
        <form id="edit-order-form">
            <div class="form-row">
                <div class="form-group">
                    <label for="edit-shop-name">Shop Name</label>
                    <input type="text" id="edit-shop-name" value="${order.shopName}" required>
                </div>
                <div class="form-group">
                    <label for="edit-order-date">Order Date</label>
                    <input type="date" id="edit-order-date" value="${order.date}" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="edit-product">Product</label>
                    <select id="edit-product" required>
                        ${allProducts.map(p => `<option value="${p.name}" ${order.product === p.name ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="edit-bill-number">Bill Number</label>
                    <input type="text" id="edit-bill-number" value="${order.billNumber}" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="edit-quantity">Quantity</label>
                    <input type="number" id="edit-quantity" min="1" value="${order.quantity}" required>
                </div>
                <div class="form-group">
                    <label for="edit-rate">Rate per Product (Rs.)</label>
                    <input type="number" id="edit-rate" min="1" value="${order.rate}" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="edit-total">Total Amount (Rs.)</label>
                    <input type="number" id="edit-total" value="${order.total}" readonly>
                </div>
                <div class="form-group">
                    <label for="edit-payment-status">Payment Status</label>
                    <select id="edit-payment-status" required>
                        <option value="non-paid" ${paymentStatus === 'non-paid' ? 'selected' : ''}>Non-Paid</option>
                        <option value="paid" ${paymentStatus === 'paid' ? 'selected' : ''}>Paid</option>
                    </select>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="edit-paid-date">Paid Date</label>
                    <input type="date" id="edit-paid-date" value="${order.paidDate || ''}" ${paymentStatus === 'paid' ? 'required' : ''}>
                </div>
            </div>
            
            <div class="form-group full-width">
                <label for="edit-note">Note</label>
                <textarea id="edit-note" rows="3">${order.note || ''}</textarea>
            </div>
            
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i> Update Order
                </button>
                <button type="button" class="btn btn-secondary close-modal">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </form>
    `;
    
    // Calculate total when quantity or rate changes
    document.getElementById('edit-quantity').addEventListener('input', calculateEditTotal);
    document.getElementById('edit-rate').addEventListener('input', calculateEditTotal);
    
    // Toggle Paid Date based on Payment Status
    const editPaymentStatus = document.getElementById('edit-payment-status');
    const editPaidDate = document.getElementById('edit-paid-date');
    
    editPaymentStatus.addEventListener('change', function() {
        if (this.value === 'paid') {
            editPaidDate.required = true;
            editPaidDate.disabled = false;
            if (!editPaidDate.value) {
                editPaidDate.valueAsDate = new Date();
            }
        } else {
            editPaidDate.required = false;
            editPaidDate.disabled = true;
            editPaidDate.value = '';
        }
    });
    
    // Set initial state
    if (paymentStatus === 'non-paid') {
        editPaidDate.disabled = true;
        editPaidDate.required = false;
    }
    
    // Form submission
    document.getElementById('edit-order-form').addEventListener('submit', function(e) {
        e.preventDefault();
        updateOrder(orderId);
    });
    
    // Cancel button
    document.querySelector('#edit-order-form .close-modal').addEventListener('click', closeModal);
    
    // Show modal
    openDialogById('edit-modal');
}

// Calculate total for edit form
function calculateEditTotal() {
    const quantity = parseInt(document.getElementById('edit-quantity').value) || 0;
    const rate = parseFloat(document.getElementById('edit-rate').value) || 0;
    const total = quantity * rate;
    document.getElementById('edit-total').value = total.toFixed(2);
}

// Update order in Firebase
async function updateOrder(orderId) {
    if (!checkAdminPermission('update orders')) return;
    
    const shopName = document.getElementById('edit-shop-name').value;
    const orderDate = document.getElementById('edit-order-date').value;
    const product = document.getElementById('edit-product').value;
    const billNumber = document.getElementById('edit-bill-number').value;
    const quantity = parseInt(document.getElementById('edit-quantity').value);
    const rate = parseFloat(document.getElementById('edit-rate').value);
    const total = parseFloat(document.getElementById('edit-total').value);
    const paymentStatus = document.getElementById('edit-payment-status').value;
    const paidDate = paymentStatus === 'paid' ? document.getElementById('edit-paid-date').value : null;
    const note = document.getElementById('edit-note').value;
    
    const updatedOrder = {
        shopName,
        date: orderDate,
        product,
        billNumber,
        quantity,
        rate,
        total,
        paymentStatus,
        paidDate,
        note,
        updatedAt: serverTimestamp()
    };
    
    try {
        await updateDoc(doc(db, "orders", orderId), updatedOrder);
        console.log("Order updated successfully");
        showNotification('Order updated successfully!', 'success');
        closeModal();
    } catch (error) {
        console.error("Error updating order: ", error);
        showNotification('Error updating order. Please try again.', 'error');
    }
}

// Delete order
async function deleteOrder(orderId) {
    if (!checkAdminPermission('delete orders')) return;
    
    if (confirm('Are you sure you want to delete this order?')) {
        try {
            await deleteDoc(doc(db, "orders", orderId));
            console.log("Order deleted successfully");
            showNotification('Order deleted successfully!', 'success');
        } catch (error) {
            console.error("Error deleting order: ", error);
            showNotification('Error deleting order. Please try again.', 'error');
        }
    }
}

// Filter orders
function filterOrders(shouldRender = true) {
    const filterDate = document.getElementById('filter-date').value;
    const filterProduct = filterProductSelect.value;
    const filterShop = document.getElementById('filter-shop').value.toLowerCase();
    const filterPaymentStatus = document.getElementById('filter-payment-status').value;
    
    let filtered = allOrders;
    
    if (filterDate) {
        filtered = filtered.filter(order => order.date === filterDate);
    }
    
    if (filterProduct) {
        filtered = filtered.filter(order => order.product === filterProduct);
    }
    
    if (filterShop) {
        filtered = filtered.filter(order => 
            order.shopName.toLowerCase().includes(filterShop)
        );
    }
    
    if (filterPaymentStatus) {
        filtered = filtered.filter(order => {
            const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
            return paymentStatus === filterPaymentStatus;
        });
    }
    
    filteredOrders = filtered;
    currentFilteredOrders = filtered;
    if (shouldRender) {
        displayOrders(filtered);
    } else {
        updateFilterSummary(filtered);
    }
}

// Clear filters
function clearFilters() {
    document.getElementById('filter-date').value = '';
    filterProductSelect.value = '';
    document.getElementById('filter-shop').value = '';
    document.getElementById('filter-payment-status').value = '';
    currentFilteredOrders = allOrders;
    displayOrders(allOrders);
}

// Set report period
function setReportPeriod(period) {
    const endDate = new Date();
    let startDate = new Date();
    
    switch(period) {
        case 'daily':
            startDate = new Date();
            break;
        case 'weekly':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case 'monthly':
            startDate.setMonth(endDate.getMonth() - 1);
            break;
    }
    
    document.getElementById('report-start-date').valueAsDate = startDate;
    document.getElementById('report-end-date').valueAsDate = endDate;
    
    // Generate report
    generateReport();
}

// Generate report
function generateReport() {
    if (!AUTH_STATE.isLoggedIn) return;
    
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    
    if (!startDate || !endDate) {
        showNotification('Please select both start and end dates.', 'warning');
        return;
    }
    
    // Show loading
    const originalText = generateReportBtn.innerHTML;
    generateReportBtn.innerHTML = '<div class="loading"></div>Generating...';
    generateReportBtn.disabled = true;
    
    // Store current report data for PDF export
    currentReportStartDate = startDate;
    currentReportEndDate = endDate;
    
    // Filter orders by date range
    currentReportOrders = allOrders.filter(order => {
        const orderDate = new Date(order.date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59); // Include entire end day
        
        return orderDate >= start && orderDate <= end;
    });
    
    // Update report summary
    const totalOrders = currentReportOrders.length;
    const totalRevenue = currentReportOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Calculate paid vs non-paid
    const paidOrders = currentReportOrders.filter(order => {
        const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
        return paymentStatus === 'paid';
    });
    const nonPaidOrders = currentReportOrders.filter(order => {
        const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
        return paymentStatus === 'non-paid';
    });
    const paidAmount = paidOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
    const pendingAmount = nonPaidOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
    
    reportTotalOrdersEl.textContent = totalOrders;
    reportTotalRevenueEl.textContent = `Rs. ${totalRevenue.toFixed(2)}`;
    reportAvgOrderEl.textContent = `Rs. ${avgOrderValue.toFixed(2)}`;
    reportPaidAmountEl.textContent = `Rs. ${paidAmount.toFixed(2)}`;
    reportPendingAmountEl.textContent = `Rs. ${pendingAmount.toFixed(2)}`;
    
    // Update report table
    updateReportTable(currentReportOrders);
    
    // Update chart
    ensureChartInitialized();
    updateChart(currentReportOrders, startDate, endDate);
    
    // Enable PDF export button
    exportPdfBtn.disabled = AUTH_STATE.role !== 'admin';
    
    // Restore button
    generateReportBtn.innerHTML = originalText;
    generateReportBtn.disabled = false;
    
    showNotification('Report generated successfully!', 'success');
}

// Update report table
function updateReportTable(orders) {
    reportTableBody.innerHTML = '';
    
    if (orders.length === 0) {
        reportTableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <i class="fas fa-chart-line" aria-hidden="true"></i>
                        <p>No data found for the selected date range.</p>
                    </div>
                </td>
            </tr>
        `;
        applyResponsiveTableClasses();
        return;
    }
    
    orders.forEach(order => {
        const row = document.createElement('tr');
        const paymentStatus = order.paymentStatus || (order.paidDate ? 'paid' : 'non-paid');
        const statusText = paymentStatus === 'paid' ? 'Paid' : 'Non-Paid';
        const statusBadge = `<span class="payment-badge ${paymentStatus}">${statusText}</span>`;
        
        row.innerHTML = `
            <td>${formatDate(order.date)}</td>
            <td>${order.shopName || ''}</td>
            <td>${order.product || ''}</td>
            <td>${order.quantity || 0}</td>
            <td>Rs. ${(order.total || 0).toFixed(2)}</td>
            <td>${statusBadge}</td>
        `;
        
        reportTableBody.appendChild(row);
    });

    applyResponsiveTableClasses();
}

function ensureChartInitialized() {
    if (!salesChart) {
        initializeChart();
    }
}

// Initialize chart
function initializeChart() {
    if (salesChart || typeof Chart === 'undefined') {
        return;
    }

    const canvas = document.getElementById('sales-chart');
    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }
    
    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Daily Revenue (Rs.)',
                data: [],
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'Rs. ' + value;
                        }
                    }
                }
            }
        }
    });
}

// Update chart with data
function updateChart(orders, startDate, endDate) {
    if (!salesChart) {
        return;
    }

    // Group orders by date
    const ordersByDate = {};
    
    // Initialize all dates in range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    
    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        ordersByDate[dateStr] = 0;
        current.setDate(current.getDate() + 1);
    }
    
    // Sum totals by date
    orders.forEach(order => {
        if (ordersByDate.hasOwnProperty(order.date)) {
            ordersByDate[order.date] += parseFloat(order.total);
        }
    });
    
    // Prepare chart data
    const labels = Object.keys(ordersByDate).map(date => formatDate(date));
    const data = Object.values(ordersByDate);
    
    // Update chart
    salesChart.data.labels = labels;
    salesChart.data.datasets[0].data = data;
    salesChart.update();
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return '-';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString;
        }
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const mountPoint = toastRegion || document.body;
    const existingNotification = mountPoint.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
    notification.innerHTML = `
        <span class="notification-message">${message}</span>
        <button type="button" class="close-notification" aria-label="Dismiss notification">&times;</button>
    `;

    mountPoint.appendChild(notification);
    requestAnimationFrame(() => notification.classList.add('visible'));

    const closeBtn = notification.querySelector('.close-notification');
    closeBtn.addEventListener('click', () => {
        notification.classList.remove('visible');
        setTimeout(() => notification.remove(), 180);
    });

    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.remove('visible');
            setTimeout(() => notification.remove(), 180);
        }
    }, 4500);
}

// Initialize PDF export modal
initPDFExportModal();

