const { SuporrtedToken } = require("./interface");
const { v4: uuidv4 } = require("uuid");

const USDT_ADDRESS = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const USDC_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function getTokenSymbole(token) {
  try {
    if (token === USDC_ADDRESS) {
      return SuporrtedToken.USDC;
    } else if (token === USDT_ADDRESS) {
      return SuporrtedToken.USDT;
    }
    return SuporrtedToken.NOT_SUPPORTED;
  } catch (error) {
    console.log(`Error in getTokenSymbole: ${error}`);
    return SuporrtedToken.NOT_SUPPORTED;
  }
}

const formatAddress = (address) => {
  if (!address || address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const generateUUID = () => {
  return uuidv4();
};

module.exports = {
  getTokenSymbole,
  formatAddress,
  generateUUID,
};
