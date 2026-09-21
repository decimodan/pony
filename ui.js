export function createUI(document) {
  let toastTimer;
  const dialog = document.querySelector('#detailDialog');

  function toast(message) {
    const element = document.querySelector('#toast');
    if (!element) return;
    element.textContent = `✦ ${message}`;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 2400);
  }

  function showDialog(html) {
    const content = document.querySelector('#dialogContent');
    if (!dialog || !content || dialog.open) return;
    content.innerHTML = html;
    dialog.showModal();
  }

  function closeDialog() {
    if (dialog?.open) dialog.close();
  }

  document.querySelector('#closeDialog')?.addEventListener('click', closeDialog);
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) closeDialog();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-toast]');
    if (!button) return;
    event.preventDefault();
    toast(button.dataset.toast || 'Listo');
    closeDialog();
  });

  return { toast, showDialog, closeDialog };
}
