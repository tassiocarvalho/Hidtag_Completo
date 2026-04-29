const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

process.on('uncaughtException', (err) => {
    if (err.code === 'ENOENT') return;
    console.error('Erro ignorado:', err.message);
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function pickFile(tmpPath) {
    try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

        spawn('termux-storage-get', [tmpPath], {
            detached: true,
            stdio: 'ignore'
        }).unref();

        console.log('📂 Selecione o arquivo na galeria e pressione ENTER quando terminar...');
        await question('');

        await new Promise(r => setTimeout(r, 1000));

        if (fs.existsSync(tmpPath)) return tmpPath;
        return null;
    } catch (e) {
        return null;
    }
}

function getRecentStickers() {
    const stickerDir = './stickers';
    if (!fs.existsSync(stickerDir)) {
        fs.mkdirSync(stickerDir);
        console.log('📁 Pasta ./stickers criada.');
        return [];
    }
    return fs.readdirSync(stickerDir)
        .filter(f => f.endsWith('.webp'))
        .map(f => ({ name: f, full: path.join(stickerDir, f), time: fs.statSync(path.join(stickerDir, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time)
        .slice(0, 3);
}

async function recordAudio() {
    const rawPath = './temp_audio.m4a';
    const oggPath = './temp_audio.ogg';

    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
    if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);

    spawn('termux-microphone-record', ['-f', rawPath, '-e', 'aac', '-b', '192', '-r', '44100'], {
        detached: true,
        stdio: 'ignore'
    }).unref();

    console.log('\n🎙 Gravando... Pressione ENTER para parar.');
    await question('');

    execSync('termux-microphone-record -q');
    console.log('⏹ Gravação encerrada.');

    await new Promise(r => setTimeout(r, 1500));

    if (!fs.existsSync(rawPath)) {
        console.log('❌ Arquivo de áudio não encontrado.');
        return null;
    }

    console.log('🔄 Convertendo áudio...');
    try {
        execSync(`ffmpeg -i ${rawPath} -c:a libopus -b:a 128k -ar 48000 -ac 1 ${oggPath} -y`);
        fs.unlinkSync(rawPath);
    } catch (e) {
        console.log('❌ Erro na conversão. pkg install ffmpeg');
        return null;
    }

    return oggPath;
}

async function menuFigurinha(sock, group) {
    const participants = group.participants.map(p => p.id);

    console.log('\nFigurinha — origem:\n  (1) Pasta ./stickers\n  (2) Galeria\n  (v) Voltar');
    const origem = await question('Escolha: ');

    if (origem.trim().toLowerCase() === 'v') return 'back';

    if (origem.trim() === '1') {
        const stickers = getRecentStickers();
        if (!stickers.length) {
            console.log('Nenhuma figurinha em ./stickers');
            return menuFigurinha(sock, group);
        }
        console.log('\n🗂 Figurinhas:');
        stickers.forEach((s, i) => console.log(`  [${i}] ${s.name}`));
        console.log('  (v) Voltar');

        const idx = await question('\nEscolha: ');
        if (idx.trim().toLowerCase() === 'v') return menuFigurinha(sock, group);

        const sticker = stickers[parseInt(idx)];
        if (!sticker) { console.log('Inválido.'); return menuFigurinha(sock, group); }

        const buffer = fs.readFileSync(sticker.full);
        await sock.sendMessage(group.id, { sticker: buffer, mentions: participants });
        console.log('✅ Figurinha enviada!');

    } else if (origem.trim() === '2') {
        const filePath = await pickFile('./temp_fig_input.jpg');

        if (!filePath) {
            console.log('❌ Nenhum arquivo selecionado.');
            return menuFigurinha(sock, group);
        }

        const outPath = './temp_sticker.webp';
        console.log('🔄 Convertendo para figurinha...');
        try {
            execSync(`ffmpeg -i "${filePath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -loop 0 "${outPath}" -y`);
        } catch (e) {
            console.log('❌ Erro ao converter imagem.');
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return menuFigurinha(sock, group);
        }

        const buffer = fs.readFileSync(outPath);
        await sock.sendMessage(group.id, { sticker: buffer, mentions: participants });
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
        console.log('✅ Figurinha enviada da galeria!');

    } else {
        console.log('Opção inválida.');
        return menuFigurinha(sock, group);
    }

    return null;
}

async function menuFotoVideo(sock, group) {
    const participants = group.participants.map(p => p.id);

    console.log('\nEnviar:\n  (1) Foto\n  (2) Vídeo\n  (v) Voltar');
    const tipo = await question('Escolha: ');

    if (tipo.trim().toLowerCase() === 'v') return 'back';

    if (tipo.trim() === '1') {
        const filePath = await pickFile('./temp_foto.jpg');

        if (!filePath) {
            console.log('❌ Nenhuma foto selecionada.');
            return menuFotoVideo(sock, group);
        }

        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        const buffer = fs.readFileSync(filePath);

        await sock.sendMessage(group.id, {
            image: buffer,
            mimetype: mime,
            mentions: participants
        });

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.log('✅ Foto enviada com hidetag!');

    } else if (tipo.trim() === '2') {
        const filePath = await pickFile('./temp_video.mp4');

        if (!filePath) {
            console.log('❌ Nenhum vídeo selecionado.');
            return menuFotoVideo(sock, group);
        }

        const buffer = fs.readFileSync(filePath);
        await sock.sendMessage(group.id, {
            video: buffer,
            mimetype: 'video/mp4',
            mentions: participants
        });

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.log('✅ Vídeo enviado com hidetag!');

    } else {
        console.log('Opção inválida.');
        return menuFotoVideo(sock, group);
    }

    return null;
}

async function menuTipo(sock, group) {
    const participants = group.participants.map(p => p.id);

    const tipo = await question('\nO que deseja enviar?\n  (1) Texto\n  (2) Figurinha\n  (3) Áudio\n  (4) Foto / Vídeo\n  (v) Voltar para grupos\nEscolha: ');

    if (tipo.trim().toLowerCase() === 'v') return 'back';

    if (tipo.trim() === '1') {
        const text = await question('\nDigite a mensagem (v para voltar): ');
        if (text.trim().toLowerCase() === 'v') return menuTipo(sock, group);
        if (!text.trim()) return menuTipo(sock, group);

        await sock.sendMessage(group.id, { text, mentions: participants });
        console.log('✅ Mensagem enviada com hidetag!');

    } else if (tipo.trim() === '2') {
        const result = await menuFigurinha(sock, group);
        if (result === 'back') return menuTipo(sock, group);

    } else if (tipo.trim() === '3') {
        const audioPath = await recordAudio();
        if (!audioPath) return menuTipo(sock, group);

        const confirma = await question('\nEnviar o áudio gravado? (s/n/v para voltar): ');
        if (confirma.trim().toLowerCase() === 'v') {
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            return menuTipo(sock, group);
        }
        if (confirma.toLowerCase() !== 's') {
            console.log('❌ Áudio cancelado.');
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        } else {
            const buffer = fs.readFileSync(audioPath);
            await sock.sendMessage(group.id, {
                audio: buffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true,
                mentions: participants
            });
            fs.unlinkSync(audioPath);
            console.log('✅ Áudio enviado com hidetag!');
        }

    } else if (tipo.trim() === '4') {
        const result = await menuFotoVideo(sock, group);
        if (result === 'back') return menuTipo(sock, group);

    } else {
        console.log('Opção inválida.');
        return menuTipo(sock, group);
    }

    const again = await question('\nEnviar outra? (s/n/v para parar): ');
    if (again.trim().toLowerCase() === 'v') {
        console.log('👋 Encerrando...');
        process.exit(0);
    } else if (again.toLowerCase() === 's') {
        return menuTipo(sock, group);
    } else {
        return menuTipo(sock, group);
    }
}

async function menuGrupos(sock) {
    const groups = await sock.groupFetchAllParticipating();
    const list = Object.values(groups);

    console.log('\n📋 Grupos disponíveis:');
    list.forEach((g, i) => console.log(`  [${i}] ${g.subject}`));
    console.log('  (v) Encerrar');

    const indexStr = await question('\nEscolha o número do grupo: ');

    if (indexStr.trim().toLowerCase() === 'v') {
        console.log('👋 Encerrando...');
        process.exit(0);
    }

    const group = list[parseInt(indexStr)];
    if (!group) {
        console.log('Grupo inválido.');
        return menuGrupos(sock);
    }

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
        } catch (e) {
            console.log("Erro ao gerar código:", e.message);
        }
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(startBot, 2000);
            else console.log('🔴 Deslogado. Rode novamente e conecte de novo.');
        } else if (connection === 'open') {
            console.log('🚀 BOT ATIVADO.');
            await menuGrupos(sock);
        }
    });
}

startBot();