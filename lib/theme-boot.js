/** Dijalankan di <head> sebelum render, supaya tidak ada kilatan putih saat mode gelap. */
export const themeBootScript = `(function(){try{var p=localStorage.getItem('kk-theme')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
