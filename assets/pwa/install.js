(() => {
  const button = document.querySelector(`[data-install-app]`);
  if (!button) return;

  const displayMode = window.matchMedia(`(display-mode: standalone), (display-mode: minimal-ui), (display-mode: window-controls-overlay), (display-mode: fullscreen)`);
  let installPrompt;
  let installed = false;
  let requestingInstall = false;
  let instructions;

  const updateButton = () => {
    button.hidden = Boolean(installed || displayMode.matches || navigator.standalone);
  };

  function showInstructions() {
    if (!instructions) {
      instructions = document.createElement(`dialog`);
      instructions.className = `app-install-dialog`;
      instructions.setAttribute(`aria-labelledby`, `app-install-title`);
      instructions.innerHTML = `
        <form method="dialog">
          <div class="app-install-dialog-heading">
            <span class="material-symbols-outlined app-install-icon" aria-hidden="true">install_desktop</span>
            <h2 id="app-install-title"></h2>
          </div>
          <p>Use the install icon in your browser’s address bar when it appears.</p>
          <ul>
            <li><strong>Chrome or Edge</strong> · Open the browser menu and look for <b>Install</b> or <b>Install this site as an app</b>.</li>
            <li><strong>Safari</strong> · On Mac, use <b>File → Add to Dock</b>. On iPhone or iPad, use <b>Share → Add to Home Screen</b>.</li>
          </ul>
          <button class="app-install-done" type="submit">Done</button>
        </form>`;
      instructions.querySelector(`#app-install-title`).textContent = `Install DAD ${button.dataset.installApp}`;
      document.body.append(instructions);
    }
    if (!instructions.open) instructions.showModal();
  }

  window.addEventListener(`beforeinstallprompt`, event => {
    event.preventDefault();
    installPrompt = event;
    updateButton();
  });

  window.addEventListener(`appinstalled`, () => {
    installed = true;
    installPrompt = undefined;
    if (instructions?.open) instructions.close();
    updateButton();
  });

  button.addEventListener(`click`, async () => {
    if (requestingInstall) return;
    if (!installPrompt) {
      showInstructions();
      return;
    }

    requestingInstall = true;
    const prompt = installPrompt;
    installPrompt = undefined;
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === `accepted`) {
        installed = true;
        updateButton();
      }
    } catch {
      showInstructions();
    } finally {
      requestingInstall = false;
    }
  });

  displayMode.addEventListener(`change`, updateButton);
  updateButton();
})();
