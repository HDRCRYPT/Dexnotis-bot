function homeButtons() {
  return {
    inline_keyboard: [
      [
        {
          text: "📥 Add new DEX",
          callback_data: "addNewDex",
        },
      ],
    ],
  };
}

function emptyButton() {
  return {
    inline_keyboard: [[]],
  };
}

function dexDetailsButtons(id, isActive) {
  return {
    inline_keyboard: [
      [
        {
          text: isActive ? "Deactivate" : "Activate",
          callback_data: `activateDex-${id}`,
        },
      ],
      [
        {
          text: "Rename",
          callback_data: `renameDex-${id}`,
        },
        {
          text: "Delete",
          callback_data: `deleteDex-${id}`,
        },
      ],
      [
        {
          text: "Edit Min",
          callback_data: `editMin-${id}`,
        },
        {
          text: "Edit Max",
          callback_data: `editMax-${id}`,
        },
      ],
      [
        {
          text: "Change Token Type",
          callback_data: `changeTokenType-${id}`,
        },
      ],
    ],
  };
}

module.exports = {
  homeButtons,
  emptyButton,
  dexDetailsButtons,
};
