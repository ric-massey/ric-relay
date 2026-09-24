(() => {
  'use strict';
  const form = document.getElementById('login-form');
  const nameInput = document.getElementById('login-name');
  const passwordInput = document.getElementById('login-password');
  const submit = document.getElementById('login-submit');
  const message = document.getElementById('login-message');

  // No database key here (the public website): the app is a demo on made-up
  // data. Getting in takes an account on Ric's site with HERMISCUS switched on
  // (the ATLAS account; asked for and approved at /account/). Once that checks
  // out it opens straight onto the crew — nobody is asked who they are.
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
    const useWaiting = (state, asked) => {
      mode = 'waiting';
      form.hidden = true;
      panel.hidden = false;
      if (state === 'denied') {
        sub.textContent = 'no access';
        panel.innerHTML = '<p>this account has not been given HERMISCUS.</p><p><a href="../../account/">your account →</a></p>';
        return;
      }
      sub.textContent = asked ? 'waiting for Ric' : 'not switched on for you';
      panel.innerHTML = asked
        ? '<p>your request is with Ric. once he switches HERMISCUS on, this page opens.</p><p><a href="../../account/">your account →</a></p>'
        : '<p>your account does not have HERMISCUS yet.</p><button type="button" id="ask-access" style="width:100%;min-height:44px;margin-top:6px;border:1px solid var(--phosphor);background:var(--phosphor);color:#0a0a0a;font:700 14px/1 ui-monospace,monospace;letter-spacing:.12em;cursor:pointer">request permission</button><p class="message" id="ask-msg" role="alert"></p>';
      const ask = document.getElementById('ask-access');
      if (ask) ask.addEventListener('click', async () => {
        ask.disabled = true;
        try {
          await (await window.HermiscusAuth.siteGate()).requestAccess('hermiscus');
          useWaiting('waiting', true);
        } catch (_) {
          ask.disabled = false;
          document.getElementById('ask-msg').textContent = 'could not send that — try again in a moment.';
        }
      });
    };
    const decide = async () => {
      form.hidden = true;
      sub.textContent = 'checking…';
      try {
        const access = await window.HermiscusAuth.demoAccess();
        if (access.state === 'ok') window.location.replace(window.HermiscusAuth.directoryUrl());
        else if (access.state === 'signed-out') useAccountForm();
        else if (access.state === 'error') { useAccountForm(); message.textContent = 'could not check your access — try again in a moment.'; }
        else useWaiting(access.state, access.asked);
      } catch (_) {
        useAccountForm();
        message.textContent = 'could not reach the account service.';
      }
    };

    form.addEventListener('submit', async event => {
      event.preventDefault();
      message.textContent = '';
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
