---
# AID-11: Discord Webhook Integration for Reporting New Human Aid Centers

## Overview

Add a user-facing form to both the **Servicios** tab and the **dashboard view**. This allows visitors and maintainers to submit new *centros de acopio* (humanitarian aid centers) directly from the site. The form submission will POST the data to a Discord webhook, notifying maintainers/moderators in real time.

## Requirements

- **Frontend:** 
    - **Servicios Tab:** Add the reporting form in the sidebar/tab as described.
    - **Dashboard:** The same reporting widget (form and UX) must also be available in the admin/maintainer dashboard, to enable maintainers to rapidly report and test new center submissions.
    - Shared form features:
        - **Fields:**
            - **Location** (free text, or split into country, state, city, address)
            - **Country** (select or text; default: Venezuela)
            - **State** (text/select)
            - **City** (optional)
            - **Needed supplies** (textarea/list, e.g. "Agua, comida, medicinas…")
            - **Is urgent?** (yes/no, checkbox or select)
            - **Optional:** Contact info
            - **Notes**
        - **UX:** Explain that messages go to moderators via Discord—no guarantee of immediate listing.
        - **Submit button**
        - **Validation:** Basic required fields.
        - **Feedback:** Success/error message after submission.s
        - **Privacy:** Warn that info will be public; don’t collect emails unless necessary.

- **Backend:** *No real backend/server*; use the Discord webhook URL via a POST request (CORS-permitting, as Discord webhooks accept client POSTs).
    - Webhook (example provided):  
      `https://discord.com/api/webhooks/1520112883575296111/7E0d6uELwHoFcHXkPu-9JrY6nrC6wpW898JHEwiVyDaq8R9k_TUb4zgQaqnu2buS2C3z`
    - Body: Compose a message with the collected form data, e.g., in Discord's "embeds" for formatting.
    - If CORS is blocked for Discord's webhooks, document this for future workaround (proxy or Netlify function).

## Minimal Astro/React Example Snippet

```tsx
// In ServiciosTab.astro/.tsx and Dashboard.astro/.tsx
import { useState } from 'react';

function ReportAidCenterForm() {
  const [form, setForm] = useState({
    location: '',
    country: 'Venezuela',
    state: '',
    city: '',
    needs: '',
    urgent: false,
    contact: '',
    notes: ''
  });
  const [status, setStatus] = useState<'idle'|'sending'|'ok'|'error'>('idle');

  const webhookUrl = 'https://discord.com/api/webhooks/1520112883575296111/7E0d6uELwHoFcHXkPu-9JrY6nrC6wpW898JHEwiVyDaq8R9k_TUb4zgQaqnu2buS2C3z';

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    // Compose Discord webhook message. Use 'embeds' for richer formatting.
    const embed = {
      title: "Nuevo reporte de Centro de Acopio",
      fields: [
        { name: "País", value: form.country, inline: true },
        { name: "Estado", value: form.state || '-', inline: true },
        { name: "Ciudad", value: form.city || '-', inline: true },
        { name: "Dirección/Ubicación", value: form.location || '-', inline: false },
        { name: "Necesidades", value: form.needs || '-', inline: false },
        { name: "Urgente", value: form.urgent ? 'Sí' : 'No', inline: true },
        ...(form.contact ? [{ name: "Contacto", value: form.contact, inline: false }] : []),
        ...(form.notes ? [{ name: "Notas", value: form.notes, inline: false }] : [])
      ],
      color: form.urgent ? 0xff2222 : 0x00bcd4,
      timestamp: new Date().toISOString()
    };
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '', embeds: [embed] }),
      });
      if (res.ok) setStatus('ok');
      else throw new Error('Webhook request failed');
    } catch (err) {
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{border: '1px solid #eee', padding: '1em', borderRadius: '8px', marginTop: '1em'}}>
      <h3>Reportar un nuevo centro de acopio</h3>
      <p><small>Los datos serán enviados a los moderadores vía Discord para verificación.<br />No garantizamos la publicación automática. <b>Alerta:</b> Toda la información compartida será pública.</small></p>
      <label>
        País:
        <input name="country" value={form.country} onChange={handleChange} required />
      </label><br />
      <label>
        Estado:
        <input name="state" value={form.state} onChange={handleChange} required />
      </label><br />
      <label>
        Ciudad:
        <input name="city" value={form.city} onChange={handleChange} />
      </label><br />
      <label>
        Dirección o lugar:
        <input name="location" value={form.location} onChange={handleChange} required />
      </label><br />
      <label>
        ¿Qué se necesita?
        <textarea name="needs" value={form.needs} onChange={handleChange} required placeholder="Ej: Agua, alimentos, medicina" />
      </label><br />
      <label>
        Urgente
        <input type="checkbox" name="urgent" checked={form.urgent} onChange={handleChange} />
      </label><br />
      <label>
        Contacto (opcional)
        <input name="contact" value={form.contact} onChange={handleChange} />
      </label><br />
      <label>
        Notas (opcional)
        <textarea name="notes" value={form.notes} onChange={handleChange} />
      </label><br />
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Enviando...' : 'Reportar'}
      </button>
      {status === 'ok' && <div style={{color: 'green'}}>¡Enviado correctamente!</div>}
      {status === 'error' && <div style={{color: 'red'}}>Error al enviar. Intente de nuevo.</div>}
    </form>
  );
}

// RENDER in both locations:
//   - <ReportAidCenterForm /> in the Servicios tab
//   - <ReportAidCenterForm /> in the Dashboard view
```

**Security note:** Discord webhooks are public endpoints; avoid abuse by showing a CAPTCHA, or, if spam becomes a problem, move the webhook call behind a very simple Netlify serverless function.

---

## Acceptance Criteria

- [ ] A form appears in the Servicios sidebar **and in the dashboard** to report aid centers, with country, state, location, needs, urgent, (optional) contact, and notes fields.
- [ ] Submits data to the provided Discord webhook as a formatted embed.
- [ ] User receives confirmation or error feedback.
- [ ] Form includes a disclaimer about moderation/review and privacy.