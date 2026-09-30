const fs = require('fs');

let bi = fs.readFileSync('app/(dashboard)/bi/page.tsx', 'utf8');

const badExport = `  const exportReport = () => {
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

const goodExport = `  const exportReport = () => {
    // Generate dummy CSV
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Indicateur,Valeur\\n" +
      "Chiffre d'affaires," + totalRevenue + "\\n" +
      "Commandes Livrées," + deliveredOrdersCount + "\\n" +
      "Nouveaux Clients," + newCustomersCount + "\\n" +
      "Taux de succès," + deliverySuccessRate + "%";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "rapport_willshop.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Export du rapport généré (CSV) !");
  };`;

bi = bi.replace(badExport, goodExport);

fs.writeFileSync('app/(dashboard)/bi/page.tsx', bi, 'utf8');
