// Menu filtering functionality and id-based routing (/menu/{id})
document.addEventListener('DOMContentLoaded', function() {
    // Menu ids are issued by demenu_bot: exactly 17 base62 characters.
    // Anything else is rejected, so the id can never alter the fetch path.
    const MENU_ID = /^[A-Za-z0-9]{17}$/;

    // Read the id from /menu/{id} (primary format) or ?hash={id}
    function getHashFromURL() {
        const hashParam = new URLSearchParams(window.location.search).get('hash');
        if (hashParam) {
            return MENU_ID.test(hashParam) ? hashParam : null;
        }

        const pathParts = window.location.pathname.split('/').filter(p => p);
        const menuIndex = pathParts.indexOf('menu');
        if (menuIndex !== -1 && pathParts.length > menuIndex + 1) {
            const hash = pathParts[menuIndex + 1];
            if (MENU_ID.test(hash)) {
                return hash;
            }
        }

        return null;
    }

    const hash = getHashFromURL();
    // Published menus live in this site at menus/<id>.json (static/menus in
    // the repository). The base path is set by the layout from Hugo's baseURL.
    const menusBaseUrl = window.MENUS_BASE_URL || '/menus/';

    // If an id is present, fetch that menu (NOT the static default menu)
    if (hash) {
        const menuStatic = document.getElementById('menu-static');
        const menuDynamic = document.getElementById('menu-dynamic');
        const menuLoading = document.getElementById('menu-loading');
        const menuError = document.getElementById('menu-error');

        // Hide the static menu (if it exists) and show the loading state
        if (menuStatic) {
            menuStatic.style.display = 'none';
            menuStatic.innerHTML = '';
        }
        if (menuLoading) menuLoading.style.display = 'block';
        if (menuError) menuError.style.display = 'none';

        const menuUrl = `${menusBaseUrl}${hash}.json`;

        // Add timeout to fetch (10 seconds for better reliability)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('Request timeout - aborting fetch after 10 seconds');
            controller.abort();
        }, 10000); // 10 second timeout
        
        fetch(menuUrl, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
            },
            // Revalidate so a re-published menu shows up promptly
            cache: 'no-cache'
        })
            .then(response => {
                clearTimeout(timeoutId);
                if (!response.ok) {
                    // Log full error details for debugging
                    console.error('Response not OK:', response.status, response.statusText);
                    // Don't expose HTTP status details to users
                    if (response.status === 404) {
                        throw new Error('NOT_FOUND');
                    }
                    throw new Error('SERVER_ERROR');
                }
                return response.json();
            })
            .then(data => {
                if (menuLoading) menuLoading.style.display = 'none';
                if (menuError) menuError.style.display = 'none';
                
                // Render menu dynamically
                renderDynamicMenu(data, menuDynamic);
                
                // Initialize filtering after menu is rendered
                setTimeout(initializeMenuFiltering, 100);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                // Log error details to console for debugging (not exposed to users)
                console.error('Error loading menu:', error);
                console.error('Error name:', error.name);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
                if (menuLoading) menuLoading.style.display = 'none';
                if (menuError) {
                    menuError.style.display = 'block';
                    let errorMsg = 'Unable to load menu. Please check your link and try again.';
                    if (error.name === 'AbortError') {
                        errorMsg = 'Request timed out. Please try again.';
                    } else if (error.message === 'NOT_FOUND') {
                        errorMsg = 'Menu not found. Please check your link.';
                    } else if (error.message === 'SERVER_ERROR') {
                        errorMsg = 'Unable to load menu. Please try again later.';
                    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                        errorMsg = 'Unable to connect. Please try again later.';
                    }
                    menuError.innerHTML = `<p><strong>Error loading menu:</strong> ${errorMsg}</p><p style="font-size: 0.9em; color: #666;">Check browser console (F12) for details.</p>`;
                }
            });
    } else {
        // No hash - use static menu (default menu at /menu)
        // Make sure static menu is visible
        const menuStatic = document.getElementById('menu-static');
        if (menuStatic) {
            menuStatic.style.display = 'block';
        }
        // Hide loading and error elements
        const menuLoading = document.getElementById('menu-loading');
        const menuError = document.getElementById('menu-error');
        if (menuLoading) menuLoading.style.display = 'none';
        if (menuError) menuError.style.display = 'none';
        // Initialize filtering for static menu
        initializeMenuFiltering();
    }
    
    function renderDynamicMenu(data, container) {
        if (!container) return;
        
        if (!data || !Array.isArray(data.categories) || data.categories.length === 0) {
            container.innerHTML = '<p>No menu data available.</p>';
            container.style.display = 'block';
            return;
        }
        
        // Build menu HTML (same structure as static menu)
        let html = '<div class="menu-container">';
        
        // Sidebar with filters
        html += '<button class="sidebar-toggle sidebar-toggle-external" aria-label="Toggle categories"><span class="toggle-icon">☰</span></button>';
        html += '<div class="sidebar-overlay"></div>';
        html += '<div class="menu-sidebar">';
        html += '<div class="sidebar-header">';
        html += '<button class="sidebar-toggle sidebar-toggle-internal" aria-label="Toggle categories"><span class="toggle-icon">☰</span></button>';
        html += '<button class="sidebar-close" aria-label="Close sidebar">×</button>';
        html += '</div>';
        html += '<div class="menu-filters">';
        html += '<button class="filter-btn active" data-category="all">All</button>';
        
        data.categories.forEach(category => {
            html += `<button class="filter-btn" data-category="${escapeHtml(category.id)}">${escapeHtml(category.name)}</button>`;
        });
        
        html += '</div></div>';
        
        // Menu content
        html += '<div class="menu-content"><div class="menu-categories">';
        
        data.categories.forEach(category => {
            html += `<section class="menu-category" data-category="${escapeHtml(category.id)}">`;
            html += `<h2 class="category-title">${escapeHtml(category.name)}</h2>`;
            if (category.description) {
                html += `<p class="category-description">${escapeHtml(category.description)}</p>`;
            }
            html += '<div class="menu-items">';
            
            (category.items || []).forEach(item => {
                html += '<div class="menu-item">';
                html += `<h3 class="item-name">${escapeHtml(item.name)}</h3>`;
                if (item.description) {
                    html += `<p class="item-description">${escapeHtml(item.description)}</p>`;
                }
                html += `<span class="item-price">$${(Number(item.price) || 0).toFixed(2)}</span>`;
                html += '</div>';
            });
            
            html += '</div></section>';
        });
        
        html += '</div></div></div>';
        
        container.innerHTML = html;
        container.style.display = 'block';
    }
    
    // Escapes for both element content and quoted attribute values
    // (category ids are written into data-category="...").
    function escapeHtml(text) {
        const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(text == null ? '' : text).replace(/[&<>"']/g, ch => escapes[ch]);
    }
    
    function initializeMenuFiltering() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        const menuCategories = document.querySelectorAll('.menu-category');
        const sidebar = document.querySelector('.menu-sidebar');
        const sidebarToggles = document.querySelectorAll('.sidebar-toggle');
        const sidebarClose = document.querySelector('.sidebar-close');
        const sidebarOverlay = document.querySelector('.sidebar-overlay');
    
    function isMobile() {
        return window.innerWidth <= 768;
    }
    
    // Toggle sidebar on mobile
    function openSidebar() {
        if (sidebar && isMobile()) {
            sidebar.classList.add('open');
            if (sidebarOverlay) {
                sidebarOverlay.classList.add('active');
            }
            document.body.style.overflow = 'hidden';
        }
    }
    
    function closeSidebar() {
        if (sidebar) {
            sidebar.classList.remove('open');
            if (sidebarOverlay) {
                sidebarOverlay.classList.remove('active');
            }
            document.body.style.overflow = '';
        }
    }
    
    function toggleSidebar() {
        if (sidebar && isMobile()) {
            if (sidebar.classList.contains('open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        }
    }
    
    sidebarToggles.forEach(toggle => {
        toggle.addEventListener('click', toggleSidebar);
    });
    
    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    // Close sidebar when clicking a filter button on mobile
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Filter categories
            menuCategories.forEach(categorySection => {
                if (category === 'all') {
                    categorySection.classList.remove('hidden');
                } else {
                    const categoryId = categorySection.getAttribute('data-category');
                    if (categoryId === category) {
                        categorySection.classList.remove('hidden');
                    } else {
                        categorySection.classList.add('hidden');
                    }
                }
            });
            
            // Close sidebar on mobile after selecting a category
            if (isMobile()) {
                closeSidebar();
            }
            
            // Scroll to category after filtering
            setTimeout(() => {
                if (category !== 'all') {
                    const targetCategory = document.querySelector(`.menu-category[data-category="${category}"]:not(.hidden)`);
                    if (targetCategory) {
                        const offset = isMobile() ? 20 : 100;
                        const categoryTop = targetCategory.getBoundingClientRect().top + window.pageYOffset;
                        window.scrollTo({
                            top: categoryTop - offset,
                            behavior: 'smooth'
                        });
                    }
                } else {
                    const menuContent = document.querySelector('.menu-content');
                    if (menuContent) {
                        const menuContentTop = menuContent.getBoundingClientRect().top + window.pageYOffset;
                        const offset = isMobile() ? 20 : 100;
                        window.scrollTo({
                            top: menuContentTop - offset,
                            behavior: 'smooth'
                        });
                    } else {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }
            }, 50);
        });
    });
    
        // Handle window resize
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                closeSidebar();
            }
        });
    }
});
