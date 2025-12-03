const chalk = require("chalk");

const logger = {
  success: (msg) => console.log(chalk.green.bold(`✔ ${msg}`)),
  warn: (msg) => console.log(chalk.yellow.bold(`⚠ ${msg}`)),
  error: (msg) => console.log(chalk.red.bold(`✖ ${msg}`)),
  info: (msg) => console.log(chalk.blue.bold(`ℹ ${msg}`)),
};

module.exports = {
  logger,
};
