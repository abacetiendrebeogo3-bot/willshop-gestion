const fs = require('fs');
let content = fs.readFileSync('app/(dashboard)/whatsapp/page.tsx', 'utf8');

// Fix chips
content = content.replace(
  'className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full',
  'className={`flex items-center shrink-0 gap-1.5 px-3 py-1.5 rounded-full'
);

// Fix catch 1
content = content.replace(
  '} catch (_err) {\n      showToast("✓ Message enregistré");\n    } finally {\n      setIsSending(false);\n    }',
  '} catch (err: any) {\n      showToast(`Erreur d\\'envoi: ${err.message || "Erreur"}`);\n    } finally {\n      setIsSending(false);\n    }'
);

// Fix catch 2
content = content.replace(
  '} catch (_err: any) {\n      showToast(`✓ Membre ${memberPhone.trim()} invité !`);\n      setShowAddMemberModal(false);\n    } finally {\n      setIsSubmittingMember(false);\n    }',
  '} catch (err: any) {\n      showToast(`Erreur: ${err.message || "Impossible d\\'inviter"}`);\n    } finally {\n      setIsSubmittingMember(false);\n    }'
);

fs.writeFileSync('app/(dashboard)/whatsapp/page.tsx', content, 'utf8');
