const fs = require('fs');

// 1. Finance page date picker
let finance = fs.readFileSync('app/(dashboard)/finance/page.tsx', 'utf8');
finance = finance.replace(
  '<div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:border-gray-300 transition-colors cursor-pointer">',
  '<div onClick={() => showToast("Le filtrage par période est en cours de développement")} className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:border-gray-300 transition-colors cursor-pointer">'
);
fs.writeFileSync('app/(dashboard)/finance/page.tsx', finance, 'utf8');

// 2. BI page date picker and export button
let bi = fs.readFileSync('app/(dashboard)/bi/page.tsx', 'utf8');
bi = bi.replace(
  '<div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs cursor-pointer hover:border-gray-300 transition-colors">',
  '<div onClick={() => showToast("Le filtrage par période est en cours de développement")} className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs cursor-pointer hover:border-gray-300 transition-colors">'
);

const newExport = `  const exportReport = () => {
    // Generate dummy CSV
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Indicateur,Valeur\\n" +
      "Chiffre d'affaires," + totalRevenue + "\\n" +
      "Commandes Livrées," + deliveredOrdersCount + "\\n" +
      "Panier Moyen," + avgOrderValue;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "rapport_willshop.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Export du rapport généré (CSV) !");
  };`;
bi = bi.replace(
  /const exportReport = \(\) => \{\s*showToast\("Export du rapport PDF \/ Excel généré !"\);\s*\};/,
  newExport
);

fs.writeFileSync('app/(dashboard)/bi/page.tsx', bi, 'utf8');
