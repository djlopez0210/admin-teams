/**
 * Manages dynamic favicon switching based on active theme or OS color scheme:
 * - Dark mode -> /favicon-white.png (Cuadrado Blanco)
 * - Light mode -> /favicon-blue.png (Cuadrado Azul)
 */

export const updateFavicon = (customUrl = null) => {
    if (customUrl) {
        setFaviconHref(customUrl);
        return;
    }

    const saved = localStorage.getItem('uiTheme');
    const isDark = saved === 'dark' || 
                   (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
                   document.body.classList.contains('theme-dark');

    const iconUrl = isDark ? '/favicon-white.png' : '/favicon-blue.png';
    setFaviconHref(iconUrl);
};

const setFaviconHref = (url) => {
    const linkTypes = ["link[rel='icon']", "link[rel='shortcut icon']"];
    let updated = false;

    linkTypes.forEach(selector => {
        const links = document.querySelectorAll(selector);
        links.forEach(l => {
            // Update links without specific media rule or update all dynamic links
            l.href = url;
            updated = true;
        });
    });

    if (!updated) {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/png';
        link.href = url;
        document.head.appendChild(link);
    }
};

/**
 * Initializes automatic theme & favicon listeners.
 */
export const initThemeListener = () => {
    // Initial sync
    updateFavicon();

    // Listen to system OS theme changes
    if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            if (!localStorage.getItem('uiTheme')) {
                // If user hasn't explicitly set an in-app theme, follow OS
                document.body.classList.toggle('theme-dark', e.matches);
                updateFavicon();
            }
        };

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
        } else if (mediaQuery.addListener) {
            mediaQuery.addListener(handleChange);
        }
    }
};
