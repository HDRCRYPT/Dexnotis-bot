const fs = require("fs");
const path = require("path");
const { logger } = require("./logger");

const DATA_DIR = path.join(__dirname, "data");
const WALLET_FILE = path.join(DATA_DIR, "wallets.json");
const BACKUP_FILE = path.join(DATA_DIR, "wallets.backup.json");
const TEMP_FILE = path.join(DATA_DIR, "wallets.tmp.json");

let isInitialized = false;

// Simple write queue so we never write concurrently
let writeQueue = Promise.resolve();

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      logger.info(`Created data directory at ${DATA_DIR}`);
    }
  } catch (error) {
    logger.error(`Error creating data directory: ${error}`);
  }
}

function readJsonFileSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) {
      return null;
    }

    return JSON.parse(raw);
  } catch (error) {
    logger.error(`Error reading/parsing JSON file ${filePath}: ${error}`);
    return null;
  }
}

function writeFileAtomic(targetPath, tmpPath, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(tmpPath, data, "utf8", (writeErr) => {
      if (writeErr) {
        return reject(writeErr);
      }

      fs.rename(tmpPath, targetPath, (renameErr) => {
        if (renameErr) {
          return reject(renameErr);
        }
        resolve();
      });
    });
  });
}

async function initStorage() {
  if (isInitialized) return;
  isInitialized = true;

  ensureDataDir();

  // Try primary file
  let wallets = readJsonFileSafe(WALLET_FILE);

  if (!wallets) {
    // Try backup if primary is missing/broken
    wallets = readJsonFileSafe(BACKUP_FILE);
    if (wallets) {
      logger.warn("Primary wallets.json invalid/missing, restoring from backup.");
    }
  }

  if (!Array.isArray(wallets)) {
    // Start fresh
    wallets = [];
  }

  try {
    const json = JSON.stringify(wallets, null, 2);
    // Write both primary and backup
    if (!fs.existsSync(WALLET_FILE)) {
      fs.writeFileSync(WALLET_FILE, json, "utf8");
    }
    if (!fs.existsSync(BACKUP_FILE)) {
      fs.writeFileSync(BACKUP_FILE, json, "utf8");
    }
    logger.info(`Wallet storage initialized with ${wallets.length} wallet(s).`);
  } catch (error) {
    logger.error(`Error initializing wallet storage: ${error}`);
  }
}

async function getWallets() {
  // Always ensure initialized
  await initStorage();

  const wallets = readJsonFileSafe(WALLET_FILE);
  if (!Array.isArray(wallets)) {
    return [];
  }
  return wallets;
}

function enqueueWrite(fn) {
  // Serialize writes to avoid concurrent corruption
  writeQueue = writeQueue
    .then(() => fn())
    .catch((error) => {
      logger.error(`Error in wallet write queue: ${error}`);
    });

  return writeQueue;
}

async function saveWallets(wallets) {
  if (!Array.isArray(wallets)) {
    logger.error("saveWallets called with non-array value. Aborting write.");
    return;
  }

  await initStorage();

  const json = JSON.stringify(wallets, null, 2);

  return enqueueWrite(async () => {
    try {
      // Atomic write primary
      await writeFileAtomic(WALLET_FILE, TEMP_FILE, json);

      // Best-effort backup (doesn't need to be atomic)
      fs.writeFile(BACKUP_FILE, json, "utf8", (err) => {
        if (err) {
          logger.error(`Error writing backup wallet file: ${err}`);
        }
      });

      logger.info(`Saved ${wallets.length} wallet(s) to wallets.json`);
    } catch (error) {
      logger.error(`Error saving wallets: ${error}`);
    }
  });
}

// For now, this is a no-op placeholder matching redisDel usage
async function deleteWalletCache(_address) {
  // You can extend this later if you add per-wallet JSON caches
  return;
}

module.exports = {
  initStorage,
  getWallets,
  saveWallets,
  deleteWalletCache,
};
