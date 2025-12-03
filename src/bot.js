const { Telegraf, session } = require("telegraf");
const { BOT_TOKEN } = require("./config");
const { logger } = require("./logger");
const {
  handleRenameDex,
  editMin,
  editMax,
  changeTokenType,
  addNewDex,
  handleAddressDetails,
  handleDexActivationDeactivation,
  deleteDex,
  handleHome,
  stopMonitoring,
  startMonitoring,
  askToAddAddressForNewAddress,
  askForNewNameToAddWallet,
  askForNewName,
  askForNewMinBuy,
  askForNewMaxBuy,
  askToChangeToken,
} = require("./handler");
const { getWallets, saveWallets } = require("./jsonStorage");
const { TokenTypes } = require("./interface");
const { Connection } = require("@solana/web3.js");

const BOT = new Telegraf(BOT_TOKEN || "");
let monitoringEnabled = true;

async function initializeBot() {
  try {
    BOT.use(session());

    BOT.launch(() => {
      logger.warn("Stopping the watch and cleaning Data... RESTARTING ...");
    });

    logger.info("BOT is running");
    registerCommands();
    registerSessions();
  } catch (error) {
    logger.error(`Error while starting the bot : ${error}`);
  }
}

/* -------------------------------------------------------------------------- */
/*                                TEXT SESSIONS                               */
/* -------------------------------------------------------------------------- */

function registerSessions() {
  BOT.on("text", async (ctx) => {
    const msg = ctx.message.text.trim();

    /* -------------------------- JSON IMPORT HANDLER ------------------------- */
    if (ctx.session.isWaitingForImportJson) {
      try {
        let wallets = JSON.parse(msg);
        if (!Array.isArray(wallets)) return await ctx.reply("❌ JSON must be an array.");

        await saveWallets(wallets);
        ctx.session.isWaitingForImportJson = false;
        return await ctx.reply(`✅ Imported ${wallets.length} wallet(s).`);
      } catch {
        return await ctx.reply("❌ Invalid JSON. Try again.");
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                   NEW WALLET CREATION 4-STEP FLOW                      */
    /* ---------------------------------------------------------------------- */

    if (ctx.session.addWalletStep === "address") {
      ctx.session.newWalletAddress = msg;
      ctx.session.addWalletStep = "label";
      return await askForNewNameToAddWallet(ctx);
    }

    if (ctx.session.addWalletStep === "label") {
      ctx.session.newWalletLabel = msg;
      ctx.session.addWalletStep = "min";
      return await ctx.reply("🔽 Enter MIN buy amount:");
    }

    if (ctx.session.addWalletStep === "min") {
      ctx.session.newWalletMin = msg;
      ctx.session.addWalletStep = "max";
      return await ctx.reply("🔼 Enter MAX buy amount:");
    }

    if (ctx.session.addWalletStep === "max") {
      ctx.session.addWalletStep = null;
      await addNewDex(
        ctx,
        ctx.session.newWalletAddress,
        ctx.session.newWalletLabel,
        ctx.session.newWalletMin,
        msg // maxBuy
      );

      delete ctx.session.newWalletAddress;
      delete ctx.session.newWalletLabel;
      delete ctx.session.newWalletMin;
      return;
    }

    /* ---------------------------------------------------------------------- */
    /*                   EXISTING WALLET EDIT HANDLERS                        */
    /* ---------------------------------------------------------------------- */

    if (ctx.session.isWaitingForNewName) {
      ctx.session.isWaitingForNewName = false;
      return await handleRenameDex(ctx, ctx.session.chosedAddress, msg);
    }

    if (ctx.session.isWaitingForMinBuy) {
      ctx.session.isWaitingForMinBuy = false;
      return await editMin(ctx, ctx.session.chosedAddress, msg);
    }

    if (ctx.session.isWaitingForMaxBuy) {
      ctx.session.isWaitingForMaxBuy = false;
      return await editMax(ctx, ctx.session.chosedAddress, msg);
    }

    if (ctx.session.isWaitingForNewToken) {
      ctx.session.isWaitingForNewToken = false;
      if ([TokenTypes.USDC, TokenTypes.USDT, TokenTypes.SOL].includes(msg)) {
        return await changeTokenType(ctx, ctx.session.chosedAddress, msg);
      }
    }

    if (ctx.session.isWaitingForNewAddress) {
      ctx.session.isWaitingForNewAddress = false;
      ctx.session.addWalletStep = "address";
      ctx.session.newWalletAddress = msg;
      return await askForNewNameToAddWallet(ctx);
    }
  });
}

/* -------------------------------------------------------------------------- */
/*                                COMMANDS                                   */
/* -------------------------------------------------------------------------- */

function registerCommands() {
  BOT.command("start", async (ctx) => {
    try {
      const startParam = ctx.payload;
      if (startParam) {
        const [action, tokenId] = startParam.split("_");
        if (action === "w") return await handleAddressDetails(ctx, tokenId);
      }

      if (!monitoringEnabled) {
        monitoringEnabled = true;
        await ctx.reply("🟢 Monitoring resumed.");
      }

      await handleStartCommand(ctx);
    } catch (error) {
      logger.error(`Error in /start: ${error}`);
    }
  });

  BOT.command("commands", async (ctx) => {
    await ctx.replyWithHTML(
`📌 <b>Available Commands</b>

/start — Open home screen & resume monitoring
/stop — Pause monitoring
/list — Show wallets
/adddata — Import wallets JSON
/exportdata — Export wallets
/health — Check bot + RPC status
/commands — Show this menu`
    );
  });

  BOT.command("stop", async (ctx) => {
    if (!monitoringEnabled) return ctx.reply("⛔ Already stopped.");

    monitoringEnabled = false;
    const wallets = await getWallets();
    let count = 0;

    for (const w of wallets) {
      if (w.active) {
        count++;
        await stopMonitoring(ctx, w);
      }
    }

    await ctx.reply(`⛔ Stopped ${count} wallet(s). Use /start to resume.`);
  });

  BOT.command("list", async (ctx) => {
    const wallets = await getWallets();
    if (!wallets.length) return ctx.reply("📝 No wallets saved.");

    let msg = "<b>📋 Wallets:</b>\n\n";
    wallets.forEach((w, i) => {
      msg += `${i + 1}. <b>${w.label}</b>\n<code>${w.address}</code>\n${
        w.active ? "🟢 Active" : "🔴 Inactive"
      }\n\n`;
    });
    await ctx.replyWithHTML(msg);
  });

  BOT.command("exportdata", async (ctx) => {
    const wallets = await getWallets();
    const buffer = Buffer.from(JSON.stringify(wallets, null, 2));
    await ctx.replyWithDocument(
      { source: buffer, filename: "wallets.json" },
      { caption: "💾 Wallet backup" }
    );
  });

  BOT.command("adddata", async (ctx) => {
    ctx.session.isWaitingForImportJson = true;
    await ctx.reply("📥 Send JSON array. Use /exportdata for format.");
  });

  BOT.command("health", async (ctx) => {
    try {
      const start = Date.now();
      const connection = new Connection(
        process.env.HELUIS_RPC_URL || "https://api.mainnet-beta.solana.com",
        "confirmed"
      );
      await connection.getEpochInfo();

      await ctx.replyWithHTML(
        `🤖 <b>DexNotis Health</b>
<b>Status:</b> 🟢 Running
<b>Monitoring:</b> ${monitoringEnabled ? "🟢 ON" : "🔴 OFF"}
<b>Latency:</b> ${Date.now() - start}ms`
      );
    } catch {
      await ctx.reply("🔴 RPC Offline");
    }
  });

  /* ---------------------- INLINE BUTTON ACTIONS ---------------------- */

  BOT.action("addNewDex", async (ctx) => {
    ctx.session.addWalletStep = "address";
    await askToAddAddressForNewAddress(ctx);
  });

  BOT.action(/^activateDex-(.+)$/, async (ctx) =>
    await handleDexActivationDeactivation(ctx, ctx.match[1])
  );

  BOT.action(/^renameDex-(.+)$/, async (ctx) =>
    await askForNewName(ctx, ctx.match[1])
  );

  BOT.action(/^deleteDex-(.+)$/, async (ctx) =>
    await deleteDex(ctx, ctx.match[1])
  );

  BOT.action(/^editMin-(.+)$/, async (ctx) =>
    await askForNewMinBuy(ctx, ctx.match[1])
  );

  BOT.action(/^editMax-(.+)$/, async (ctx) =>
    await askForNewMaxBuy(ctx, ctx.match[1])
  );

  BOT.action(/^changeTokenType-(.+)$/, async (ctx) =>
    await askToChangeToken(ctx, ctx.match[1])
  );
}

/* -------------------------------------------------------------------------- */

async function handleStartCommand(ctx) {
  try {
    ctx.session = {};
    const wallets = await getWallets();
    await handleHome(ctx, wallets ?? undefined);

    // 🔁 Restore monitoring for any wallets that were active before restart
    if (Array.isArray(wallets)) {
      for (const wallet of wallets) {
        if (wallet.active) {
          try {
            await startMonitoring(ctx, wallet);
          } catch (err) {
            logger.error(`Failed to restore monitoring for ${wallet.label}: ${err}`);
          }
        }
      }
    }
  } catch (error) {
    logger.error(`Error in handleStartCommand: ${error}`);
  }
}

module.exports = { initializeBot };
