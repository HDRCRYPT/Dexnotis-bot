const { getTokenSymbole } = require("./helper");
const { SuporrtedToken, TokenTypes } = require("./interface");
const { formatNativeTransferMessage, formatTokenTransferMessage } = require("./messages");
const { emptyButton } = require("./buttons");

function solAnalyzeTransfer(tx, watchedAddress) {
  const accountsObj = tx.transaction.message.getAccountKeys();
  const accounts = accountsObj.staticAccountKeys;
  const preBalances = tx.meta?.preBalances ?? [];
  const postBalances = tx.meta?.postBalances ?? [];

  const senderIndex = accounts.findIndex((acc) => acc.toBase58() === watchedAddress);
  if (senderIndex === -1) return null;

  const senderLoss = preBalances[senderIndex] - postBalances[senderIndex];
  const fee = tx.meta?.fee ?? 0;
  const netTransferAmount = senderLoss - fee;

  let recipientIndex = -1;
  for (let i = 0; i < postBalances.length; i++) {
    if (i === senderIndex) continue;
    const gain = postBalances[i] - preBalances[i];
    const matchRatio = gain / netTransferAmount;
    if (matchRatio >= 0.9 && matchRatio <= 1.1) {
      recipientIndex = i;
      break;
    }
  }

  if (recipientIndex !== -1) {
    return {
      sender: watchedAddress,
      recipient: accounts[recipientIndex],
      amount: netTransferAmount,
      confirmed: true,
    };
  }

  return null;
}

function splAnalyzeTransfer(tx, watchedAddress) {
  const accountsObj = tx.transaction.message.getAccountKeys();
  const accounts = accountsObj.staticAccountKeys;
  const preTokenBalance = tx.meta?.preTokenBalances ?? [];
  const postTokenBalances = tx.meta?.postTokenBalances ?? [];

  const senderIndex = accounts.findIndex((acc) => acc.toBase58() === watchedAddress);
  if (senderIndex === -1) return null;

  const senderPre  = preTokenBalance?.[senderIndex]?.uiTokenAmount?.uiAmount ?? 0;
  const senderPost = postTokenBalances?.[senderIndex]?.uiTokenAmount?.uiAmount ?? 0;
  const senderLoss = senderPre - senderPost;

  let recipientIndex = -1;
  for (let i = 0; i < postTokenBalances.length; i++) {
    if (i === senderIndex) continue;
    const recipientPre  = preTokenBalance?.[i]?.uiTokenAmount?.uiAmount ?? 0;
    const recipientPost = postTokenBalances?.[i]?.uiTokenAmount?.uiAmount ?? 0;
    const gain = recipientPost - recipientPre;
    const matchRatio = Math.abs(gain / senderLoss);
    if (matchRatio >= 0.9 && matchRatio <= 1.1) {
      recipientIndex = i;
      break;
    }
  }

  if (recipientIndex !== -1) {
    return {
      sender: watchedAddress,
      recipient: accounts[recipientIndex],
      amount: senderLoss,
      mint: postTokenBalances[recipientIndex]?.mint,
      confirmed: true,
    };
  }

  return null;
}

async function newTxDetected(ctx, data, connection, dex_address, dex_label, minBuy, maxBuy, dex_token) {
  try {
    const tx = await connection.getTransaction(data.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx?.meta) return null;

    const transaction = tx.transaction;
    const meta = tx.meta;

    console.log(`###################################`);
    console.log(`Transaction detected : https://solscan.io/tx/${data.signature}`);

    // Native SOL transfer branch
    if ((meta.postTokenBalances?.length ?? 0) === 0) {
      if (dex_token === TokenTypes.SOL) {
        console.log("Native Token Transfer Detected");
        const accounts = transaction.message.getAccountKeys();
        const isSender = accounts.get(0)?.toBase58() === dex_address;

        if (isSender) {
          const analyzerData = solAnalyzeTransfer(tx, dex_address);

        // If parsing failed or amount is invalid, skip it
        if (
          !analyzerData ||
          isNaN(analyzerData.amount) ||
          !analyzerData.recipient ||
          typeof analyzerData.recipient.toBase58 !== "function"
) {
  console.log("⚠ Skipping malformed SOL transfer alert", analyzerData);
  return;
}

const amountInSol = Number(analyzerData.amount) * 1e-9;


          if (amountInSol < minBuy || amountInSol > maxBuy) {
            console.log(`Amount ${amountInSol} is not in range ${minBuy} - ${maxBuy}`);
            return;
          }

          console.log(`Sender: ${dex_label}`);
          console.log(`Native Token Amount: ${analyzerData?.amount}`);
          console.log(`Recipient: ${analyzerData?.recipient}`);
          console.log(`Transaction: https://solscan.io/tx/${data.signature}`);

          const message = formatNativeTransferMessage(
            dex_label,
            String(amountInSol),
            String(analyzerData?.recipient),
            data.signature
          );

          await ctx.reply(message, {
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
            reply_markup: emptyButton(),
          });
          return;
        }

        return;
      }

      console.log("Settings Is SOL But Token Transfer Detected");
      return;
    }

    // SPL token transfer branch
    console.log("Token Transfer Detected");
    const postTokenBalances = meta.postTokenBalances ?? [];
    const isSender = postTokenBalances?.[0]?.owner === dex_address;

    if (isSender) {
      const splData = splAnalyzeTransfer(tx, dex_address);
      const tokenType = getTokenSymbole(String(splData?.mint));

      if (tokenType === SuporrtedToken.NOT_SUPPORTED || tokenType.toString() !== dex_token) {
        console.log("Token Not Supported Or Not Matched");
        return;
      }

      const totalAmount = splData?.amount ?? 0;
      if (totalAmount < minBuy || totalAmount > maxBuy) {
        console.log(`Amount ${totalAmount} is not in range ${minBuy} - ${maxBuy}`);
        return;
      }

      console.log(`Sender: ${dex_label}`);
      console.log(`Token Mint: ${splData?.mint}`);
      console.log(`Token Amount: ${totalAmount}`);
      console.log(`Token Type: ${tokenType}`);
      console.log(`Transaction: https://solscan.io/tx/${data.signature}`);

      const message = formatTokenTransferMessage(
        dex_label,
        String(splData?.mint),
        String(totalAmount),
        tokenType,
        data.signature,
        String(splData?.recipient)
      );

      await ctx.reply(message, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: emptyButton(),
      });
    } else {
      console.log("The watcher wallet is the receiver — SKIPPING");
    }

    console.log(`###################################\n`);
  } catch (error) {
    console.log(`Error in newTxDetected: ${error}`);
  }
}

module.exports = {
  newTxDetected,
};
