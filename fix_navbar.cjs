const fs = require('fs');
let content = fs.readFileSync('components/layout/Navbar.tsx', 'utf8');

// 1. Search bar
content = content.replace(
  'onChange={(e) => setSearchQuery(e.target.value)}',
  'onChange={(e) => setSearchQuery(e.target.value)}\n            onKeyDown={(e) => { if (e.key === "Enter") { alert("Recherche globale: Fonctionnalité en cours de développement"); setSearchQuery(""); } }}'
);

// 2. Notifications
content = content.replace(
  'className="relative p-2 text-stone-600 hover:text-[#1F1917] hover:bg-[#EFEADF] rounded-xl transition-colors"',
  'className="relative p-2 text-stone-600 hover:text-[#1F1917] hover:bg-[#EFEADF] rounded-xl transition-colors"\n          onClick={() => alert("Notifications: Fonctionnalité en cours de développement")}'
);

// 3. Profile icon
content = content.replace(
  '<div className="flex items-center gap-3 pl-3 border-l border-[#EBE5DA]">',
  '<div className="flex items-center gap-3 pl-3 border-l border-[#EBE5DA] cursor-pointer hover:bg-stone-50 rounded-xl px-2 py-1 transition-colors" onClick={() => alert("Profil: Fonctionnalité en cours de développement")}>'
);

// Actually, clicking the profile div shouldn't trigger if they click the logout button inside it.
// Let's modify the profile div to not trigger on the logout button.
content = content.replace(
  'onClick={handleSignOut}',
  'onClick={(e) => { e.stopPropagation(); handleSignOut(); }}'
);

fs.writeFileSync('components/layout/Navbar.tsx', content, 'utf8');
