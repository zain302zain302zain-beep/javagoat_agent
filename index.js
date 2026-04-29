const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

const orderStates = {}; 

// 🔥 HARD CODED PLANS
async function getMenuFromApp() {
    return [
        {
            id: "1",
            name: "Website Purchase",
            price: 600,
            imageUrl: ""
        },
        {
            id: "2",
            name: "WhatsApp Group Join",
            price: 200,
            imageUrl: ""
        }
    ];
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["S", "K", "1"] 
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.clear(); 
            console.log('\nScan QR Code:\n');
            qrcode.generate(qr, { small: true }); 
        }

        if (connection === 'open') console.log('✅ BOT IS ONLINE!');
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;
        if (msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        console.log(`📩 ${text}`);

        // ✅ FINAL STEP (SAVE USER DETAILS)
        if (orderStates[sender]?.step === 'WAITING_FOR_DETAILS') {
            const details = text;
            const item = orderStates[sender].item;

            await sock.sendMessage(sender, { 
                text: `✅ *Request Submitted!*\n\nService: *${item.name}*\nPrice: ₹${item.price}\n\nDetails Received:\n${details}\n\nOur team will contact you soon.` 
            });

            delete orderStates[sender];
            return;
        }

        // 🚀 START SERVICE
        if (text.startsWith("buy ") || text.startsWith("join ")) {
            const productRequested = text.replace("buy ", "").replace("join ", "").trim();

            const plans = await getMenuFromApp();
            const matchedItem = plans.find(item => item.name.toLowerCase().includes(productRequested));

            if (!matchedItem) {
                await sock.sendMessage(sender, { 
                    text: `❌ Plan not found.\n\nType *menu* to see available services.` 
                });
                return;
            }

            orderStates[sender] = { step: 'WAITING_FOR_DETAILS', item: matchedItem };

            await sock.sendMessage(sender, { 
                text: `🚀 *Service Activated!*\n\nYou selected: *${matchedItem.name}*\nPrice: ₹${matchedItem.price}\n\nSend your *Name + Phone Number + Details* to continue.` 
            });
        }

        // 📋 MENU
        else if (text.includes("menu") || text.includes("plan")) {
            const plans = await getMenuFromApp();

            let menuMessage = "🔥 *TIKTOK VIRAL SERVICES* 🔥\n\n";
            plans.forEach(item => {
                menuMessage += `🔸 *${item.name}* - ₹${item.price}\n`;
            });

            menuMessage += "\n_To buy: type 'buy website'\n_To join group: type 'join group'_";

            await sock.sendMessage(sender, { text: menuMessage });
        }

        // 👋 GREETING
        else if (text.includes("hi") || text.includes("hello")) {
            await sock.sendMessage(sender, { 
                text: "👋 Welcome!\n\nType *menu* to see our services." 
            });
        }

        // ❓ DEFAULT
        else {
            await sock.sendMessage(sender, { 
                text: "🤔 سمجھ نہیں آیا\n\nType *menu* to see plans." 
            });
        }
    });
}

startBot().catch(err => console.log(err));
