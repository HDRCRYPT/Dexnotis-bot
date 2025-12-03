const { logger } = require("./logger");
const { homeMessage, walletDetails } = require("./messages");
const { TokenTypes } = require("./interface");
const { homeButtons, dexDetailsButtons } = require("./buttons");
const { getWallets, saveWallets, deleteWalletCache } = require("./jsonStorage");
const { generateUUID } = require("./helper");
const { Listener } = require("./listener");
const { Connection } = require("@solana/web3.js");
const { HELUIS_RPC_URL } = require("./config");

const watchList = new Map();
const RPC = HELUIS_RPC_URL || "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC, "confirmed");

// ---- Utility: Restart monitoring if wallet is active ----
async function restartMonitoringIfActive(ctx, wallet) {
  const activeEntry = watchList.get(wallet.id);
  if (!activeEntry) return; // not active

  // stop existing listener
  try { activeEntry.listener.close(); } catch {}
  watchList.delete(wallet.id);

  // re-start with updated config
  const monitor = new Listener(connection, wallet);
  monitor.listen(ctx);
  watchList.set(wallet.id, { wallet, subId: monitor.subscriptionId || 0, listener: monitor });

  await ctx.reply(`⚡ Monitoring updated for ${wallet.label}`);
}

// ---------------------------------------------------------

async function messageSender(ctx, message, buttons) {
  try {
    await ctx.reply(message, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: buttons,
    });
  } catch (error) {
    logger.error("Error displaying home view", error);
  }
}

async function handleHome(ctx, wallets) {
  try {
    const message = homeMessage(wallets);
    const buttons = homeButtons();
    await messageSender(ctx, message, buttons);
  } catch (error) {
    logger.error(`Error in handleHome: ${error}`);
  }
}

async function handleAddressDetails(ctx, id) {
  try {
    const wallet = await getWallet(id);
    if (!wallet) return;

    const message = walletDetails(wallet);
    const buttons = dexDetailsButtons(wallet.id, wallet.active);
    await messageSender(ctx, message, buttons);
  } catch (error) {
    logger.error(`Error in handleAddressDetails: ${error}`);
  }
}

async function handleDexActivationDeactivation(ctx, id) {
  try {
    const wallet = await getWallet(id);
    if (!wallet) return;

    const wasActive = wallet.active;
    wallet.active = !wallet.active;
    await editWallet(wallet);

    if (wasActive) {
      await stopMonitoring(ctx, wallet);
    } else {
      await startMonitoring(ctx, wallet);
    }

    const message = walletDetails(wallet);
    const buttons = dexDetailsButtons(wallet.id, wallet.active);
    await messageSender(ctx, message, buttons);

  } catch (error) {
    logger.error(`Error in handleDexActivationDeactivation: ${error}`);
  }
}

async function handleRenameDex(ctx, id, newName) {
  try {
    const wallet = await getWallet(id);
    if (!wallet) return;

    wallet.label = newName;
    await editWallet(wallet);
    await restartMonitoringIfActive(ctx, wallet);

    const message = walletDetails(wallet);
    const buttons = dexDetailsButtons(wallet.id, wallet.active);
    await messageSender(ctx, message, buttons);
  } catch (error) {
    logger.error(`Error in handleRenameDex: ${error}`);
  }
}

async function editMin(ctx, id, newMin) {
  try {
    const wallet = await getWallet(id);
    if (!wallet) return;

    wallet.minBuy = Number(newMin);
    await editWallet(wallet);
    await restartMonitoringIfActive(ctx, wallet);

    const message = walletDetails(wallet);
    const buttons = dexDetailsButtons(wallet.id, wallet.active);
    await messageSender(ctx, message, buttons);

  } catch (error) {
    logger.error(`Error in editMin: ${error}`);
  }
}

async function editMax(ctx, id, newMax) {
  try {
    const wallet = await getWallet(id);
    if (!wallet) return;

    wallet.maxBuy = Number(newMax); // 0 is literal zero
    await editWallet(wallet);
    await restartMonitoringIfActive(ctx, wallet);

    const message = walletDetails(wallet);
    const buttons = dexDetailsButtons(wallet.id, wallet.active);
    await messageSender(ctx, message, buttons);

  } catch (error) {
    logger.error(`Error in editMax: ${error}`);
  }
}

async function changeTokenType(ctx, id, token) {
  try {
    const wallet = await getWallet(id);
    if (!wallet) return;

    wallet.token = token;
    await editWallet(wallet);
    await restartMonitoringIfActive(ctx, wallet);

    const message = walletDetails(wallet);
    const buttons = dexDetailsButtons(wallet.id, wallet.active);
    await messageSender(ctx, message, buttons);

  } catch (error) {
    logger.error(`Error in changeTokenType: ${error}`);
  }
}

async function addNewDex(ctx, address, label, min, max) {
  try {
    const wallet = {
      id: generateUUID(),
      label,
      address,
      minBuy: Number(min),
      maxBuy: Number(max),
      token: TokenTypes.SOL,
      active: true, // auto-activate
    };

    let allDexs = await getWallets();
    allDexs.push(wallet);
    await saveWallets(allDexs);
    await startMonitoring(ctx, wallet);

    await handleHome(ctx, allDexs);
  } catch (error) {
    logger.error(`Error in addNewDex: ${error}`);
  }
}

async function deleteDex(ctx, id) {
  try {
    const wallet = await getWallet(id);
    if (!wallet) return await ctx.reply("Wallet not found");

    const allDexs = await getWallets();
    const index = allDexs.findIndex((dex) => dex.id === id);
    if (index === -1) return await ctx.reply("Wallet not found");

    allDexs.splice(index, 1);
    await saveWallets(allDexs);
    await deleteWalletCache(wallet.address);

    // stop monitoring
    const watch = watchList.get(id);
    if (watch) {
      try { watch.listener.close(); } catch {}
      watchList.delete(id);
    }

    await handleHome(ctx, allDexs);
  } catch (error) {
    logger.error(`Error in deleteDex: ${error}`);
  }
}

async function startMonitoring(ctx, wallet) {
  try {
    const monitor = new Listener(connection, wallet);
    monitor.listen(ctx);
    watchList.set(wallet.id, { wallet, listener: monitor });
    await ctx.reply(`🟢 Monitoring started for ${wallet.label}`);
  } catch (error) {
    logger.error(`Error in startMonitoring: ${error}`);
  }
}

async function stopMonitoring(ctx, wallet) {
  try {
    const watch = watchList.get(wallet.id);
    wallet.active = false;
    await editWallet(wallet);

    if (watch) {
      try { watch.listener.close(); } catch {}
      watchList.delete(wallet.id);
    }

    await ctx.reply(`🔴 Monitoring stopped for ${wallet.label}`);
  } catch (error) {
    logger.error(`Error in stopMonitoring: ${error}`);
  }
}

async function getWallet(id) {
  const all = await getWallets();
  return all.find((dex) => dex.id === id) || null;
}

async function editWallet(wallet) {
  const all = await getWallets();
  const index = all.findIndex((dex) => dex.id === wallet.id);
  if (index === -1) return;
  all[index] = wallet;
  await saveWallets(all);
}

// ---- UI PROMPTS ----

async function askToAddAddressForNewAddress(ctx) {
  ctx.session.isAddingWallet = true;
  ctx.session.step = "address";
  await ctx.reply("📥 Enter wallet address:");
}

async function askForNewNameToAddWallet(ctx) {
  ctx.session.step = "label";
  await ctx.reply("🏷️ Enter wallet name:");
}

async function askForMin(ctx) {
  ctx.session.step = "min";
  await ctx.reply("🔽 Enter MIN buy amount:");
}

async function askForMax(ctx) {
  ctx.session.step = "max";
  await ctx.reply("🔼 Enter MAX buy amount:");
}

async function askForNewName(ctx, walletId) {
  ctx.session.isWaitingForNewName = true;
  ctx.session.chosedAddress = walletId;
  await ctx.reply("Enter new wallet name:");
}

async function askForNewMinBuy(ctx, walletId) {
  ctx.session.isWaitingForMinBuy = true;
  ctx.session.chosedAddress = walletId;
  await ctx.reply("Enter new MIN value:");
}

async function askForNewMaxBuy(ctx, walletId) {
  ctx.session.isWaitingForMaxBuy = true;
  ctx.session.chosedAddress = walletId;
  await ctx.reply("Enter new MAX value:");
}

async function askToChangeToken(ctx, walletId) {
  ctx.session.isWaitingForNewToken = true;
  ctx.session.chosedAddress = walletId;
  await ctx.reply("Enter token type (SOL/USDC/USDT):");
}

module.exports = {
  // core
  handleHome,
  handleAddressDetails,
  handleDexActivationDeactivation,
  handleRenameDex,
  editMin,
  editMax,
  changeTokenType,
  addNewDex,
  deleteDex,
  stopMonitoring,
  startMonitoring,

  // UI prompts
  askToAddAddressForNewAddress,
  askForNewNameToAddWallet,
  askForMin,
  askForMax,
  askForNewName,
  askForNewMinBuy,
  askForNewMaxBuy,
  askToChangeToken,
};
