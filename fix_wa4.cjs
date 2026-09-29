const fs = require('fs');
let content = fs.readFileSync('app/(dashboard)/whatsapp/page.tsx', 'utf8');

// 1. Fix handleSend fake success
const fakeSend = `} catch (_err) {
      showToast("✓ Message enregistré");
    } finally {
      setIsSending(false);
    }`;
const realSend = `} catch (err: any) {
      showToast(\`Erreur: \${err.message || "Erreur réseau"}\`);
    } finally {
      setIsSending(false);
    }`;
content = content.replace(fakeSend.replace(/\r\n/g, '\n'), realSend);
content = content.replace(fakeSend, realSend); // try both

// 2. Fix handleInviteMember fake success
const fakeInvite = `} catch (_err: any) {
      showToast(\`✓ Membre \${memberPhone.trim()} invité !\`);
      setShowAddMemberModal(false);
    } finally {
      setIsSubmittingMember(false);
    }`;
const realInvite = `} catch (err: any) {
      showToast(\`Erreur: \${err.message || "Impossible d'inviter le membre"}\`);
    } finally {
      setIsSubmittingMember(false);
    }`;
content = content.replace(fakeInvite.replace(/\r\n/g, '\n'), realInvite);
content = content.replace(fakeInvite, realInvite);

fs.writeFileSync('app/(dashboard)/whatsapp/page.tsx', content, 'utf8');
