const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, generateMessageID } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');

process.on('uncaughtException', (err) => {
    if (err.code === 'ENOENT') return;
    console.error('Erro ignorado:', err.message);
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function menuAlvo(group) {
    const todos = group.participants;
    const admins = todos.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    const membros = todos.filter(p => !p.admin);

    console.log('\nQuem deseja marcar?');
    console.log(`  (1) Todos — ${todos.length} pessoas`);
    console.log(`  (2) Somente admins — ${admins.length} pessoas`);
    console.log(`  (3) Somente membros — ${membros.length} pessoas`);
    console.log('  (v) Voltar');

    const op = await question('Escolha: ');
    if (op.trim().toLowerCase() === 'v') return null;
    if (op.trim() === '1') return todos.map(p => p.id);
    if (op.trim() === '2') {
        if (!admins.length) { console.log('❌ Nenhum admin.'); return menuAlvo(group); }
        return admins.map(p => p.id);
    }
    if (op.trim() === '3') {
        if (!membros.length) { console.log('❌ Nenhum membro.'); return menuAlvo(group); }
        return membros.map(p => p.id);
    }
    console.log('Inválido.');
    return menuAlvo(group);
}

async function enviarPay(sock, group, participants, text, vezes) {
    const message = {
        requestPaymentMessage: {
            noteMessage: {
                extendedTextMessage: {
                    text: text,
                    contextInfo: { mentionedJid: participants }
                }
            },
            currencyCodeIso4217: "BRL",
            amount1000: 1000,
            requestFrom: sock.user.id,
            expiryTimestamp: Math.floor(Date.now() / 1000) + 86400
        }
    };

    for (let i = 0; i < vezes; i++) {
        try {
            await sock.relayMessage(group.id, message, { messageId: generateMessageID() });
            console.log(`✅ ${i + 1}/${vezes} enviado`);
        } catch (e) {
            console.log(`❌ Erro no envio ${i + 1}:`, e.message);
        }
        if (vezes > 1) await new Promise(r => setTimeout(r, 500));
    }
}

async function menuTipo(sock, group) {
    const participants = await menuAlvo(group);
    if (!participants) return 'back';

    console.log(`\n✅ ${participants.length} pessoa(s) serão marcadas.`);

    const text = await question('\nDigite a mensagem (v para voltar): ');
    if (text.trim().toLowerCase() === 'v') return menuTipo(sock, group);
    if (!text.trim()) return menuTipo(sock, group);

    const vezesStr = await question('Quantas vezes enviar? (1 para envio único): ');
    const vezes = parseInt(vezesStr) || 1;

    await enviarPay(sock, group, participants, text.trim(), vezes);

    const again = await question('\nEnviar outra? (s/n): ');
    if (again.toLowerCase() === 's') return menuTipo(sock, group);
    return 'back';
}

async function menuGrupos(sock) {
    const groups = await sock.groupFetchAllParticipating();
    const list = Object.values(groups);

    console.log('\n📋 Grupos:');
    list.forEach((g, i) => console.log(`  [${i}] ${g.subject}`));
    console.log('  (v) Encerrar');

    const idx = await question('\nEscolha o grupo: ');
    if (idx.trim().toLowerCase() === 'v') { console.log('👋'); process.exit(0); }

    const group = list[parseInt(idx)];
    if (!group) { console.log('Inválido.'); return menuGrupos(sock); }

    const result = await menuTipo(sock, group);
    if (result === 'back') return menuGrupos(sock);
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    console.log(`\nVersão WA Web: ${version.join('.')}`);

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true,
    });

    sock.ev.on('creds.update', saveCreds);

    if (!state.creds.registered) {
        const phoneNumber = await question('\nDigite seu número (ex: 5518981938689): ');
        const codeNumber = phoneNumber.replace(/[^0-9]/g, '');
        try {
            const code = await sock.requestPairingCode(codeNumber);
            console.log(`\n🔑 CODE: ${code}`);
            console.log("Entre no WhatsApp > Aparelhos conectados > Conectar com número de telefone\n");
        } catch (e) { console.log("Erro ao gerar código:", e.message); }
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(startBot, 2000);
            else console.log('🔴 Deslogado.');
        } else if (connection === 'open') {
            console.log('🚀 BOT ATIVADO.');
            await menuGrupos(sock);
        }
    });
}

startBot();