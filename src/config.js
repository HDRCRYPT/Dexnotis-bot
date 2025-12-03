const dotenv = require("dotenv");
dotenv.config();

const HELUIS_RPC_URL = process.env.HELUIS_RPC_URL;
const HELUIS_WS_URL = process.env.HELUIS_WS_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_NAME = process.env.BOT_NAME;

module.exports = {
  HELUIS_RPC_URL,
  HELUIS_WS_URL,
  BOT_TOKEN,
  BOT_NAME,
};
