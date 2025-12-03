const { initializeBot } = require("./bot");
const express = require("express"); // ⬅ added

async function main() {
  try {
    await initializeBot();

    // ---------------- HEARTBEAT SERVER ----------------
    const app = express();
    const PORT = process.env.PORT || 3000;

    app.get("/", (req, res) => {
      res.status(200).send("OK");
    });

    app.get("/status", (req, res) => {
      res.json({
        status: "running",
        timestamp: Date.now()
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

