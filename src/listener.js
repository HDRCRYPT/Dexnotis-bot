const { PublicKey } = require("@solana/web3.js");
const { newTxDetected } = require("./transactions-classifier");
const { logger } = require("./logger");

class Listener {
  constructor(connection, dex) {
    this.connection = connection;
    this.dex = dex;
  }

  listen(ctx) {
    try {
      console.log(`Listening to the dex address ${this.dex.address}`);
      this.subscriptionId = this.connection.onLogs(
        new PublicKey(this.dex.address),
        (data) => {
          newTxDetected(
            ctx,
            data,
            this.connection,
            this.dex.address,
            this.dex.label,
            this.dex.minBuy,
            this.dex.maxBuy,
            this.dex.token
          );
        },
        "confirmed"
      );
    } catch (error) {
      logger.error(`Error in the listen function: ${error}`);
    }
  }

  close() {
    console.log("Closing connection");
    try {
      if (this.subscriptionId !== undefined) {
        this.connection.removeOnLogsListener(this.subscriptionId);
        console.log("Successfully closed connection");
      } else {
        console.log("Connection already closed");
      }
    } catch (error) {
      logger.error(`Error closing connection: ${error}`);
    }
  }
}

module.exports = {
  Listener,
};
