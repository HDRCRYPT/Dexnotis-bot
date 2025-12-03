🚀 DexNotis Bot

A Telegram-based Solana wallet monitoring bot that alerts you when tracked wallets send transactions. Built for hands-free monitoring, simple configuration, and persistent storage without databases.

✨ Features

✔ Monitors Solana wallets for outgoing SOL / USDT / USDC transfers
✔ Sends Telegram notifications with transaction details
✔ Allows wallet management directly from Telegram
✔ Uses local JSON storage (no database required)
✔ Can import/export all wallets at any time
✔ Survivable across redeploys using /exportdata and /adddata
✔ Full control via Telegram — no code edits needed after deployment

📚 Commands
Command	Description
/start	Opens bot UI and resumes monitoring if stopped
/stop	Pauses monitoring and deactivates all wallets
/list	Lists all saved wallets with name, address & status
/adddata	Imports wallet configuration from JSON
/exportdata	Downloads current wallets as a JSON file
/commands	Shows full command list and available wallet actions
🧰 Wallet Actions (Button Controls)

These are available once a wallet is added:

Action	Purpose
Rename	Change wallet label
Delete	Remove wallet from the system
Activate / Deactivate	Start/stop monitoring this wallet
Edit Min / Max	Set alert thresholds
Change Token Type	Choose token filter: SOL / USDT / USDC
View Wallet Details	Shows configuration and actions

No slash commands are required for these — the UI handles them.

🔁 Import / Export Strategy
Feature	Why it exists
/exportdata	Creates wallets.json backup
/adddata	Restores wallets after redeploy
JSON storage	No need for Redis / DB / subscriptions

This makes the bot cheap to run forever on Render’s free tier.

🏗 Architecture Overview
index.js → initializeBot()
  bot.js → command handlers + sessions
  handler.js → wallet logic + monitoring
  listener.js → Solana RPC subscription
  jsonStorage.js → atomic writes + backup


State is stored in:

/data/wallets.json
/data/wallets.backup.json

🌐 Deployment Notes (Render)

Recommended free-tier workflow:

Deploy bot with BOT_TOKEN

Add wallets

Run /exportdata and save locally

After redeploy → /adddata to restore state

If you never update code, your config remains untouched.

To start run
node src/index.js