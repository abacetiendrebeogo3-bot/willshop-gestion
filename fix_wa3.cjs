const fs = require('fs');
let content = fs.readFileSync('app/(dashboard)/whatsapp/page.tsx', 'utf8');

// 1. Remove Assistant states
content = content.replace(/\s*\/\/ Assistant state\s*const \[showAssistant.*?\];\s*/s, '\n\n');

// 2. Remove handleAssistantSend
content = content.replace(/\s*\/\/ ── 7\. AI Assistant Handler.*?const handleAssistantSend =.*?};\s*/s, '\n\n  // ── 7. Removed (Handled Globally) ────────────────────────────────────────────────\n\n');

// 3. Fix handleSend fake success
content = content.replace(/\} catch \(_err\) \{\s*showToast\("✓ Message enregistré"\);\s*\} finally \{/g, 
  `} catch (err: any) {\n      showToast(\`Erreur d'envoi: \${err.message || "Erreur"}\`);\n    } finally {`);

// 4. Fix handleInviteMember fake success
content = content.replace(/\} catch \(_err: any\) \{\s*showToast\(\`✓ Membre \$\{memberPhone\.trim\(\)\} invité !`\);\s*setShowAddMemberModal\(false\);\s*\} finally \{/g, 
  `} catch (err: any) {\n      showToast(\`Erreur: \${err.message || "Impossible d'inviter le membre"}\`);\n    } finally {`);

fs.writeFileSync('app/(dashboard)/whatsapp/page.tsx', content, 'utf8');
