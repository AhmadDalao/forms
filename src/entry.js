if(/\/management\/?$/.test(location.pathname))await import('./management/main.js');
else await import('./main.js');
