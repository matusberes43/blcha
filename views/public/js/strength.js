document.addEventListener('DOMContentLoaded', function () {
  const passwordInput = document.querySelector('input[name="password"]');
  const indicator = document.createElement('div');
  indicator.style.marginTop = '5px';

  passwordInput.parentNode.insertBefore(indicator, passwordInput.nextSibling);

  passwordInput.addEventListener('input', function () {
    const value = passwordInput.value;
    let strength = 0;

    if (value.length >= 8) strength++;
    if (/[a-z]/.test(value)) strength++;
    if (/[A-Z]/.test(value)) strength++;
    if (/[0-9]/.test(value)) strength++;
    if (/[^A-Za-z0-9]/.test(value)) strength++;

    let color = 'red';
    let text = 'Slabé heslo';
    if (strength >= 3) { color = 'orange'; text = 'Stredne silné'; }
    if (strength >= 4) { color = 'green'; text = 'Silné heslo'; }

    indicator.textContent = text;
    indicator.style.color = color;
  });
});
