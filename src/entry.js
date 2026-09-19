if(/\/management\/?$/.test(location.pathname))await import('./management/main.js');
else if(/\/(login|register|account|my-applications)\/?$/.test(location.pathname))await import('./portal/main.js');
else await import('./main.js');
