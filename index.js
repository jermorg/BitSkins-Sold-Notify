const fs = require('fs').promises;
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const { TELEGRAM_TOKEN, TELEGRAM_CHAT_ID } = require( path.join(__dirname, 'config.json'));

const bot = new TelegramBot(TELEGRAM_TOKEN);
const DATA_FILE = path.join(__dirname, 'data.json');
let tokens = [];
let balances = {};

async function loadBalances() {
	try {
		const json = await fs.readFile(DATA_FILE, 'utf8');
		balances = JSON.parse(json);
	} catch {
		balances = {};
	}
}

async function saveBalances() {
	await fs.writeFile(DATA_FILE, JSON.stringify(balances, null, 2));
}

async function getAccauntData(token) {
	const res = await axios.get("https://api.bitskins.com/account/profile/me", {
		"headers": {
		  "content-type": "application/json",
		   "x-apikey": token,
		},
	})
	return res.data;
}

async function getAccauntLastSell(token){
	const res = await axios.post("https://api.bitskins.com/market/history/list", { "type": "seller"}, {
		"headers": {
		  "content-type": "application/json",
		   "x-apikey": token,
		},
	})
	return res.data;
}


async function checkBalance(token) {
	try {
		const response = await axios.post(
			"https://api.bitskins.com/account/profile/balance", {},
			{
				headers: {
					"content-type": "application/json",
					"x-apikey": token,
				},
			}
		);
        
		const newBalance = (response.data?.balance ?? 0) / 1000;
                            
		if (balances[token] !== undefined && balances[token] !== newBalance) {
			const accaunt = await getAccauntData(token)
			const lastTransaction = await getAccauntLastSell(token)
			const old = balances[token];
			const diff = newBalance - old;
			const sign = diff > 0 ? '+' : '';
            
            	const message = 
`💸 Balance update for ${accaunt.steam_username}

🔄 $${old.toFixed(2)} → $${newBalance.toFixed(2)} (${sign}$${diff.toFixed(2)})


📦 LastTransaction:
${lastTransaction.list[0].name}
Buyer country: ${lastTransaction.list[0].buyer_country || "none"}
Received: ${(lastTransaction.list[0].price - lastTransaction.list[0].fee_amount) / lastTransaction.list[0].fee}
- Sold: ${lastTransaction.list[0].price / lastTransaction.list[0].fee}
- Fee amount: ${lastTransaction.list[0].fee_amount / lastTransaction.list[0].fee}
`;
            
			await bot.sendMessage(TELEGRAM_CHAT_ID, message);
            
            balances[token] = newBalance;
			await saveBalances();
		}

	} catch (error) {
		console.error('❌ Request failed', error.response?.data || error.message);
	}
}

async function startListAccount(token) {
	await checkBalance(token);
	setInterval(() => checkBalance(token), 3 * 60 * 1000);//5 *
}

async function start() {
	await loadBalances();

	try {
		const data = await fs.readFile( path.join(__dirname, 'tokens.txt'), 'utf8');
		tokens = data.trim().split(/\s+/);
		console.log('Loaded tokens:', tokens.length);

		for (let i = 0; i < tokens.length; i++) {
			startListAccount(tokens[i]);
		}
	} catch (err) {
		console.error('Error read tokens.txt:', err);
	}
}

start();
