const fs = require('fs');

// Add Automatisation to Sidebar
let sidebar = fs.readFileSync('components/layout/Sidebar.tsx', 'utf8');
sidebar = sidebar.replace(
  '{ name: "Paramètres", href: "/settings", icon: Settings },',
  '{ name: "Automatisations", href: "/automation", icon: Zap },\n    { name: "Paramètres", href: "/settings", icon: Settings },'
);
fs.writeFileSync('components/layout/Sidebar.tsx', sidebar, 'utf8');

// Add disconnect button to Whatsapp Page
let wa = fs.readFileSync('app/(dashboard)/whatsapp/page.tsx', 'utf8');
wa = wa.replace(
  '<span>⚡ QR Code WhatsApp</span>\n                  </button>\n                </div>',
  '<span>⚡ QR Code WhatsApp</span>\n                  </button>\n                  {connectionStatus === "CONNECTED" && (\n                    <button\n                      onClick={() => { if(confirm("Voulez-vous vraiment déconnecter l\'instance ?")) { setConnectionStatus("DISCONNECTED"); showToast("Instance déconnectée avec succès."); } }}\n                      className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"\n                    >\n                      <span>Déconnecter</span>\n                    </button>\n                  )}\n                </div>'
);
fs.writeFileSync('app/(dashboard)/whatsapp/page.tsx', wa, 'utf8');
