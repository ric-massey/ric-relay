(() => {
  'use strict';
  const form = document.getElementById('login-form');
  const nameInput = document.getElementById('login-name');
  const passwordInput = document.getElementById('login-password');
  const submit = document.getElementById('login-submit');
  const message = document.getElementById('login-message');

  // No database key here (the public website): the app is a demo on made-up
  // data. Getting in takes an account on Ric's site with HERMISCUS switched on
  // (the ATLAS account; asked for and approved at /account/). After that,
  // "signing in" is just saying which crew member to look through.
  if (window.HermiscusAuth.demo) {
    const sub = document.getElementById('login-sub');
    const panel = document.getElementById('demo-panel');
    const nameLabel = document.querySelector('label[for="login-name"]');
    const passLabel = document.querySelector('label[for="login-password"]');
    let mode = 'checking';

    const useAccountForm = () => {
      mode = 'account';
      sub.textContent = "sign in with your account on Ric's site";
      nameLabel.textContent = 'email';
      nameInput.type = 'email';
      nameInput.autocomplete = 'username';
      nameInput.autocapitalize = 'none';
      passLabel.hidden = false;
      passwordInput.hidden = false;
      passwordInput.required = true;
      form.hidden = false;
      panel.hidden = false;
      panel.innerHTML = '<p><a href="../../account/#request">no account? ask Ric for one →</a></p>';
    };
    const useNameForm = () => {
      mode = 'name';
      sub.textContent = 'demo · made-up race · who are you?';
      nameLabel.textContent = 'name';
      nameInput.type = 'text';
      nameInput.autocomplete = 'off';
      nameInput.autocapitalize = 'words';
      nameInput.value = '';
      passLabel.hidden = true;
      passwordInput.hidden = true;
      passwordInput.required = false;
      form.hidden = false;
      panel.hidden = false;
      panel.innerHTML = "<p><b>demo mode.</b> the crew app for Dad's race, running on a made-up race so it can be shown off without the real plan leaving the family. anything you change stays in this browser.</p>";
      document.getElementById('demo-list').hidden = false;
      nameInput.focus();
    };
    const useWaiting = (state) => {
      mode = 'waiting';
      form.hidden = true;
      sub.textContent = state === 'denied' ? 'no access' : 'waiting for Ric';
      panel.hidden = false;
      panel.innerHTML = state === 'denied'
        ? '<p>this account has not been given HERMISCUS.</p><p><a href="../../account/">your account →</a></p>'
        : '<p>your account is made; Ric decides who sees HERMISCUS. once he switches it on, this page opens.</p><p><a href="../../account/">your account →</a></p>';
    };
    const decide = async () => {
      form.hidden = true;
      sub.textContent = 'checking…';
      try {
        const access = await window.HermiscusAuth.demoAccess();
        if (access.state === 'ok') useNameForm();
        else if (access.state === 'signed-out') useAccountForm();
        else if (access.state === 'error') { useAccountForm(); message.textContent = 'could not check your access — try again in a moment.'; }
        else useWaiting(access.state);
      } catch (_) {
        useAccountForm();
        message.textContent = 'could not reach the account service.';
      }
    };

    form.addEventListener('submit', async event => {
      event.preventDefault();
      message.textContent = '';
      if (mode === 'name') {
        const url = window.HermiscusAuth.demoProfileUrl(nameInput.value);
        if (url) window.location.assign(url);
        else { message.textContent = 'Not on the crew list. Try Ric, Sydney, Victoria…'; nameInput.focus(); }
        return;
      }
      if (mode !== 'account') return;
      submit.disabled = true;
      submit.textContent = 'checking…';
      try {
        await (await window.HermiscusAuth.siteGate()).signIn(nameInput.value, passwordInput.value);
        passwordInput.value = '';
        await decide();
      } catch (_) {
        passwordInput.value = '';
        message.textContent = 'Email or password not recognized.';
      } finally {
        submit.disabled = false;
        submit.textContent = 'enter';
      }
    });
    decide();
    return;
  }

  if (window.HermiscusAuth.readSession()) {
    window.HermiscusAuth.freshSession()
      .then(() => window.location.replace(window.HermiscusAuth.profileUrl()))
      .catch(() => window.HermiscusAuth.clearPrivateState());
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    message.textContent = '';
    submit.disabled = true;
    submit.textContent = 'checking…';
    try {
      await window.HermiscusAuth.signIn(nameInput.value, passwordInput.value);
      passwordInput.value = '';
      window.location.replace(window.HermiscusAuth.profileUrl());
    } catch (_) {
      passwordInput.value = '';
      message.textContent = 'Name or password not recognized.';
      passwordInput.focus();
    } finally {
      submit.disabled = false;
      submit.textContent = 'enter';
    }
  });
})();
