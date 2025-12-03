const { initializeBot } = require("./bot");
const express = require("express"); // heartbeat server

async function main() {
  try {
    await initializeBot();

    // ---------------- TELEGRAM LONG POLLING CONTROL ----------------
    if (process.env.ENABLE_LONG_POLLING === "true") {
      console.log("📡 Long polling enabled for Telegram bot (Render safe mode)");
    } else {
      console.log("⚠️ Long polling flag not set. Add ENABLE_LONG_POLLING=true in Render env vars.");
    }
    // ----------------------------------------------------------------

    // ---------------- HEARTBEAT SERVER ----------------
    const app = express();
    const PORT = process.env.PORT || 3000;

    // Render uses this to check if container is alive
    app.get("/", (req, res) => {
      res.status(200).send("OK");
    });

    // UptimeRobot will ping this every 5 mins to keep bot awake
    app.get("/health", (req, res) => {
      res.json({
        status: "running",
        monitoring: process.env.ENABLE_LONG_POLLING === "true" ? "active" : "inactive",
        time: new Date().toISOString()
      });
    });

    app.listen(PORT, () => {
      console.log(`Heartbeat server running on port ${PORT}`);
    });
    // ---------------------------------------------------

  } catch (error) {
    console.log(`Error in the main function: ${error}`);
  }
}

main();
