/*
 * Loads a published menu for /menu/<id> and keeps the category navigation
 * in step with scrolling.
 *
 * Menu files are written by demenu-bot from what restaurant owners send it,
 * so their content is untrusted. Everything is rendered with createElement
 * and textContent; no markup is ever parsed from menu data.
 */
(function () {
    'use strict';

    // Ids are base62 and 16 to 32 characters long. Checking the shape first
    // means an id can never change the path that is fetched.
    var MENU_ID = /^[A-Za-z0-9]{16,32}$/;
    var MENU_PATH = /\/menu\/([^/]+)\/?$/;
    var FETCH_TIMEOUT_MS = 10000;

    // Upper bounds from the bot's schema, enforced again here.
    var MAX_CATEGORIES = 50;
    var MAX_ITEMS = 200;
    var MAX_NAME = 100;
    var MAX_TEXT = 500;
    var MAX_BADGES = 6;
    var MAX_URL = 2048;

    var SPICE_LEVELS = ['Mild', 'Medium', 'Hot'];

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    // A trimmed string of at most max characters, or '' for anything else.
    function clean(value, max) {
        if (typeof value !== 'string') return '';
        return value.trim().slice(0, max);
    }

    // Reads the id from /menu/<id>, or from ?hash=<id> for older links.
    // Returns { id } when the shape is valid, { id: null } for a menu URL
    // with a malformed id, and null when the URL is not a menu URL at all.
    function readMenuId(location) {
        var fromQuery = new URLSearchParams(location.search).get('hash');
        var match = MENU_PATH.exec(location.pathname);
        var candidate = fromQuery !== null ? fromQuery : match && match[1];
        if (candidate === null) return null;
        return { id: MENU_ID.test(candidate) ? candidate : null };
    }

    // A safe image src, or null. Only two forms are allowed: an https URL
    // with a host and no credentials, or a site-relative path such as
    // /images/soup.jpg, resolved against the site root.
    function resolveImageUrl(image, siteRoot) {
        if (typeof image !== 'string' || image === '' || image.length > MAX_URL) return null;
        if (/[\s\\]/.test(image)) return null;
        if (image.charAt(0) === '/') {
            if (image.charAt(1) === '/' || image.split('/').indexOf('..') !== -1) return null;
            return siteRoot + image.slice(1);
        }
        if (image.slice(0, 8).toLowerCase() !== 'https://') return null;
        try {
            var url = new URL(image);
            if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
            return url.href;
        } catch (error) {
            return null;
        }
    }

    function dietaryLabels(value) {
        var list = Array.isArray(value) ? value : [value];
        var labels = [];
        for (var i = 0; i < list.length && labels.length < MAX_BADGES; i++) {
            var label = clean(list[i], MAX_NAME);
            if (label) labels.push(label);
        }
        return labels;
    }

    // Accepts a label ("Hot"), a level from 1 to 3, or true.
    function spicyLabel(value) {
        if (value === true) return 'Spicy';
        if (typeof value === 'number') return SPICE_LEVELS[value - 1] || '';
        return clean(value, MAX_NAME);
    }

    function formatPrice(price, currency) {
        if (typeof price !== 'number' || !isFinite(price) || price < 0) return '';
        return currency + price.toFixed(2);
    }

    function renderDish(item, config) {
        var name = item && typeof item === 'object' ? clean(item.name, MAX_NAME) : '';
        if (!name) return null;

        var dish = el('li', 'dish');

        var src = resolveImageUrl(item.image, config.siteRoot);
        if (src) {
            var frame = el('div', 'dish__image');
            var img = el('img');
            img.alt = '';
            img.width = 178;
            img.height = 110;
            img.loading = 'lazy';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            img.addEventListener('error', function () {
                frame.remove();
            });
            img.src = src;
            frame.appendChild(img);
            dish.appendChild(frame);
        }

        var body = el('div', 'dish__body');
        var heading = el('div', 'dish__heading');
        heading.appendChild(el('h3', 'dish__name', name));
        var price = formatPrice(item.price, config.currency);
        if (price) {
            var leader = el('span', 'dish__leader');
            leader.setAttribute('aria-hidden', 'true');
            heading.appendChild(leader);
            heading.appendChild(el('span', 'dish__price', price));
        }
        body.appendChild(heading);

        var description = clean(item.description, MAX_TEXT);
        if (description) body.appendChild(el('p', 'dish__description', description));

        var dietary = dietaryLabels(item.dietary);
        var spicy = spicyLabel(item.spicy);
        if (dietary.length || spicy) {
            var badges = el('ul', 'badges');
            dietary.forEach(function (label) {
                badges.appendChild(el('li', 'badge badge--dietary', label));
            });
            if (spicy) badges.appendChild(el('li', 'badge badge--spicy', spicy));
            body.appendChild(badges);
        }

        dish.appendChild(body);
        return dish;
    }

    // Builds the same markup as layouts/partials/menu.html. Returns null
    // when there is no dish to show anywhere in the menu.
    function renderMenu(data, config) {
        var categories = data && Array.isArray(data.categories) ? data.categories.slice(0, MAX_CATEGORIES) : [];
        var menu = el('div', 'menu');
        var nav = el('nav', 'menu-nav');
        nav.setAttribute('aria-label', 'Menu sections');
        var navList = el('ul', 'menu-nav__list');
        var sections = el('div', 'menu-sections');
        var dishCount = 0;

        categories.forEach(function (category) {
            var name = category && typeof category === 'object' ? clean(category.name, MAX_NAME) : '';
            if (!name) return;

            // Section ids are numbered here; the ids in the file are not used.
            var id = 'section-' + (sections.childElementCount + 1);
            var section = el('section', 'menu-section');
            section.id = id;
            section.setAttribute('aria-labelledby', id + '-title');
            var title = el('h2', 'menu-section__title', name);
            title.id = id + '-title';
            section.appendChild(title);

            var description = clean(category.description, MAX_TEXT);
            if (description) section.appendChild(el('p', 'menu-section__description', description));

            var list = el('ul', 'dish-list');
            var items = Array.isArray(category.items) ? category.items.slice(0, MAX_ITEMS) : [];
            items.forEach(function (item) {
                var dish = renderDish(item, config);
                if (dish) list.appendChild(dish);
            });
            if (list.childElementCount) {
                dishCount += list.childElementCount;
                section.appendChild(list);
            } else {
                section.appendChild(el('p', 'menu-section__empty', 'No dishes in this section yet.'));
            }
            sections.appendChild(section);

            var navItem = el('li');
            var link = el('a', 'menu-nav__link', name);
            link.href = '#' + id;
            navItem.appendChild(link);
            navList.appendChild(navItem);
        });

        if (dishCount === 0) return null;
        nav.appendChild(navList);
        menu.appendChild(nav);
        menu.appendChild(sections);
        return menu;
    }

    function renderNotice(notice) {
        var box = el('div', 'notice');
        var title = el('h2', 'notice__title', notice.title);
        title.tabIndex = -1;
        box.appendChild(title);
        box.appendChild(el('p', 'notice__body', notice.body));
        if (notice.action) {
            var action;
            if (notice.action.href) {
                action = el('a', 'notice__action', notice.action.label);
                action.href = notice.action.href;
            } else {
                action = el('button', 'notice__action', notice.action.label);
                action.type = 'button';
                action.addEventListener('click', notice.action.onClick);
            }
            box.appendChild(action);
        }
        return box;
    }

    // Marks the link of the section being read, and on narrow screens keeps
    // that link in view inside the horizontally scrolling bar.
    function followScroll(menu) {
        var list = menu.querySelector('.menu-nav__list');
        var sections = menu.querySelectorAll('.menu-section');
        if (!list || !sections.length || !('IntersectionObserver' in window)) return;

        var links = {};
        list.querySelectorAll('.menu-nav__link').forEach(function (link) {
            links[link.getAttribute('href').slice(1)] = link;
        });
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        var current = null;

        function setCurrent(link) {
            if (!link || link === current) return;
            if (current) current.removeAttribute('aria-current');
            link.setAttribute('aria-current', 'location');
            current = link;
            if (list.scrollWidth > list.clientWidth) {
                list.scrollTo({
                    left: link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2,
                    behavior: reduceMotion.matches ? 'auto' : 'smooth'
                });
            }
        }

        // A section is current while it crosses a thin band below the top
        // of the viewport.
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) setCurrent(links[entry.target.id]);
            });
        }, { rootMargin: '-25% 0px -70% 0px' });
        sections.forEach(function (section) {
            observer.observe(section);
        });
        setCurrent(links[sections[0].id]);
    }

    function loadMenu(app) {
        var loading = document.getElementById('menu-loading');
        var content = document.getElementById('menu-content');
        var config = {
            menusBase: app.dataset.menusBase || '/menus/',
            siteRoot: app.dataset.siteRoot || '/',
            currency: app.dataset.currency || ''
        };

        function show(node, title) {
            loading.hidden = true;
            content.replaceChildren(node);
            if (title) document.title = title;
        }

        function showNotice(notice) {
            var box = renderNotice(notice);
            show(box, notice.title);
            box.querySelector('.notice__title').focus();
        }

        var route = readMenuId(window.location);
        if (!route) {
            showNotice({
                title: 'Page not found',
                body: 'There is nothing at this address. Menu links end in /menu/ followed by a code.',
                action: { label: 'Go to the home page', href: config.siteRoot }
            });
            return;
        }

        var notFound = {
            title: 'Menu not found',
            body: 'This link does not match a published menu. Scan the QR code again, or ask the restaurant for a new link.'
        };
        if (!route.id) {
            showNotice(notFound);
            return;
        }

        function request() {
            loading.hidden = false;
            content.replaceChildren();

            var controller = new AbortController();
            var timer = setTimeout(function () {
                controller.abort();
            }, FETCH_TIMEOUT_MS);

            fetch(config.menusBase + route.id + '.json', {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
                credentials: 'omit',
                // Revalidate, so a menu published again shows up promptly.
                cache: 'no-cache'
            })
                .then(function (response) {
                    if (response.status === 404) return { missing: true };
                    if (!response.ok) throw new Error('unexpected status');
                    return response.json().then(function (data) {
                        return { data: data };
                    });
                })
                .then(function (result) {
                    clearTimeout(timer);
                    if (result.missing) {
                        showNotice(notFound);
                        return;
                    }
                    var menu = renderMenu(result.data, config);
                    if (!menu) {
                        showNotice({
                            title: 'No dishes yet',
                            body: 'The restaurant has not added any dishes to this menu. Check back soon.'
                        });
                        return;
                    }
                    show(menu);
                    followScroll(menu);
                })
                .catch(function () {
                    clearTimeout(timer);
                    showNotice({
                        title: 'The menu did not load',
                        body: 'Check your connection and try again.',
                        action: { label: 'Try again', onClick: request }
                    });
                });
        }

        request();
    }

    var app = document.getElementById('menu-app');
    if (app) {
        loadMenu(app);
    } else {
        var menu = document.querySelector('.menu');
        if (menu) followScroll(menu);
    }
})();
