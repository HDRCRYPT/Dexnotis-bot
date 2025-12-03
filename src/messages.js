const { BOT_NAME } = require("./config");
const { formatAddress } = require("./helper");

const homeMessage = (wallets) => {
  if (!wallets) {
    return `
<b>👋 Welcome to the Dex Monitor Bot</b>

<i>No wallets currently monitored</i>
    `;
  }

  const walletsInfo = wallets
    .map(
      (wallet, index) => `
${index + 1}. <a href="https://t.me/${BOT_NAME}?start=w_${wallet.id}">${wallet.label}</a> ${wallet.active ? "🟢" : "⚫️"}
├ Address: <code>${formatAddress(wallet.address)}</code>
`
    )
    .join("\n");

  return `
<b>👋 Welcome to the Dex Monitor Bot</b>

<b>📊 Monitored Wallets:</b>
${wallets.length > 0 ? walletsInfo : "<i>No wallets currently monitored</i>"}

<i>Total Wallets: ${wallets.length}</i>
  `;
};

const walletDetails = (wallet) => {
  return `
<b>👋 Welcome to the Dex Monitor Bot</b>

<b>📊 Monitored Wallet:</b>
${wallet.label} ${wallet.active ? "🟢" : "⚫️"}
├ Address: <code>${wallet.address}</code>
├ Token: ${wallet.token}
└ Limits: Min ${wallet.minBuy} - Max ${wallet.maxBuy}
  `;
};

const formatNativeTransferMessage = (sender, amount, recipient, txHash) => {
  return `
<b>💰 Native SOL Transfer Detected</b>

<b>From:</b> <code>${sender}</code>
<b>Amount:</b> <code>${Number(amount).toFixed(5)} SOL</code>
<b>To:</b> <a href ="https://solscan.io/account/${recipient}">${recipient}</a>

<a href="https://solscan.io/tx/${txHash}">View Transaction ↗️</a>
`;
};

const formatTokenTransferMessage = (sender, tokenMint, amount, tokenType, txHash, receiver) => {
  return `
<b>🔄 Token Transfer Detected</b>

<b>From:</b> <code>${sender}</code>
<b>Token:</b> ${tokenType}
<b>Amount:</b> <code>${Number(amount).toFixed(4)}</code>
<b>Mint:</b> <code>${tokenMint}</code>
<b>To:</b> <a href ="https://solscan.io/account/${receiver}">${receiver}</a>

<a href="https://solscan.io/tx/${txHash}">View Transaction ↗️</a>
`;
};

module.exports = {
  homeMessage,
  walletDetails,
  formatNativeTransferMessage,
  formatTokenTransferMessage,
};
