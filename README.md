# HideTag Bot Só para grupos

## O que é

Bot de WhatsApp que envia mensagens com **hidetag** (menciona todos do grupo sem exibir os @) via terminal. Suporta texto, figurinha, áudio gravado pelo microfone e foto/vídeo da galeria.

---

## Pré-requisitos

### Node.js
```bash
# Termux
pkg install nodejs

# Linux/Mac
# Baixe em https://nodejs.org
```

### Dependências do projeto
```bash
npm install @whiskeysockets/baileys pino
```

### Ferramentas extras (Termux)
```bash
pkg install termux-api ffmpeg
```

> Instale também o app **Termux:API** pelo F-Droid:
> https://f-droid.org/pt_BR/packages/com.termux.api/

### Permissões Android (Termux)
```bash
# Permissão de armazenamento
termux-setup-storage
```
Depois vá em: **Configurações > Apps > Termux:API > Permissões** e ative:
- ✅ Microfone
- ✅ Armazenamento

---

## Estrutura de arquivos

```
projeto/
├── index.js
├── stickers/        # coloque aqui seus .webp prontos
└── auth_info_baileys/  # gerado automaticamente ao conectar
```

---

## Como rodar

```bash
node index.js
```

### Primeira vez (pareamento)
1. Rode o bot
2. Digite seu número com DDD e código do país (ex: `5518981938689`)
3. O bot exibe um código de 8 dígitos
4. No WhatsApp: **Aparelhos conectados > Conectar com número de telefone**
5. Digite o código exibido no terminal
6. Pronto — da segunda vez em diante não pede mais

---

## Como usar

### 1. Escolha o grupo
O bot lista todos os grupos que você participa numerados. Digite o número do grupo desejado.

### 2. Escolha o tipo de envio

| Opção | Função |
|-------|--------|
| `1` | Digita uma mensagem de texto |
| `2` | Envia figurinha (.webp da pasta ou converte da galeria) |
| `3` | Grava áudio pelo microfone e envia como mensagem de voz |
| `4` | Seleciona foto ou vídeo da galeria |
| `v` | Volta ao menu anterior |

### Navegação
- Digite `v` em qualquer menu para voltar ao anterior
- Após enviar, escolha `s` para enviar outra, `n` para voltar ao menu ou `v` para encerrar

---

## Funcionalidades detalhadas

### 📝 Texto
Digite a mensagem normalmente. Será enviada mencionando todos do grupo sem exibir os @.

### 🗂 Figurinha
- **Opção 1 — Pasta ./stickers:** lista os 3 `.webp` modificados mais recentemente
- **Opção 2 — Galeria:** abre o seletor de arquivos do Android, converte automaticamente qualquer imagem para `.webp 512x512`

### 🎙 Áudio
1. O microfone inicia automaticamente
2. Pressione **ENTER** para parar
3. O bot converte para `.ogg` (formato de voz do WhatsApp) com qualidade 128k/48kHz
4. Confirme `s` para enviar ou `n`/`v` para cancelar

### 🖼 Foto / Vídeo
1. O seletor de arquivos do Android abre
2. Escolha a foto ou vídeo na galeria
3. Volte ao terminal e pressione **ENTER**
4. O arquivo é enviado sem perda de qualidade

---

## Dependências resumidas

| Pacote | Onde instalar | Para quê |
|--------|--------------|----------|
| `@whiskeysockets/baileys` | npm | Conexão com WhatsApp |
| `pino` | npm | Logger interno do Baileys |
| `termux-api` | pkg | Microfone e seletor de arquivos |
| `ffmpeg` | pkg | Converter áudio e figurinhas |
| App Termux:API | F-Droid | Necessário para o termux-api funcionar |

---

## Observações

- O bot reconecta automaticamente se cair, exceto se for deslogado manualmente
- Arquivos temporários de áudio, foto e figurinha são apagados automaticamente após o envio
- Para PC/Linux: as opções de áudio e galeria não funcionam (dependem do Termux:API). Texto e figurinhas da pasta `./stickers` funcionam normalmente
