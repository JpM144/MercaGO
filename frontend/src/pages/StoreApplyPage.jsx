import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyForStore } from '../services/stores.js';
import FormField from '../components/FormField.jsx';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export default function StoreApplyPage() {
  const [storeName, setStoreName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [description, setDescription] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [confirmation]);

  if (confirmation) {
    return (
      <div className="mx-auto grid w-full max-w-lg gap-6 py-8">
        <div className="grid gap-3 rounded-xl border border-green-200 bg-green-50 p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">¡Solicitud enviada!</h1>
          <p className="text-sm leading-relaxed text-ink-700">{confirmation}</p>
          <p className="text-sm leading-relaxed text-ink-600">
            La revisaremos y te notificaremos por email cuando tu tienda sea aprobada. Recordá que
            podés consultar el estado de tu solicitud iniciando sesión con tu cuenta de tienda.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Volver al marketplace
          </Link>
          <Link
            to="/admin/login"
            className="rounded-xl border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
          >
            Consultar estado de mi tienda
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!storeName.trim()) {
      nextErrors.storeName = 'Ingresá el nombre de tu negocio.';
    }
    if (!whatsapp.trim()) {
      nextErrors.whatsapp = 'Ingresá un WhatsApp de contacto.';
    }
    if (!ownerName.trim()) {
      nextErrors.ownerName = 'Ingresá tu nombre.';
    }
    if (!EMAIL_PATTERN.test(ownerEmail.trim())) {
      nextErrors.ownerEmail = 'Ingresá un email válido.';
    }
    if (!ownerPassword || ownerPassword.length < 6) {
      nextErrors.ownerPassword = 'La contraseña debe tener al menos 6 caracteres.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setFormError('');
    try {
      const data = await applyForStore({
        name: storeName.trim(),
        whatsapp_number: whatsapp.trim(),
        description: description.trim() || null,
        owner: {
          name: ownerName.trim(),
          email: ownerEmail.trim(),
          password: ownerPassword,
        },
      });
      setConfirmation(data.message);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-lg gap-6 py-8">
      <div className="grid gap-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Registrá tu tienda</h1>
        <p className="text-ink-500">
          Completá los datos de tu negocio y los del dueño. Tu solicitud queda pendiente hasta que
          la revisemos.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-4 rounded-xl border border-ink-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 border-b border-ink-100 pb-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-400">
            Datos del negocio
          </h2>
          <FormField
            id="storeName"
            label="Nombre de la tienda"
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            error={errors.storeName}
            placeholder="Mi Tienda"
            autoComplete="organization"
          />
          <FormField
            id="whatsapp"
            label="WhatsApp de contacto"
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value)}
            error={errors.whatsapp}
            placeholder="+54 9 11 1234-5678"
            autoComplete="tel"
          />
          <div className="grid gap-1.5">
            <label htmlFor="description" className="text-sm font-medium text-ink-700">
              Descripción
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Contanos brevemente qué vendés…"
              rows={3}
              className="w-full rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
        </div>

        <div className="grid gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-400">
            Datos del dueño
          </h2>
          <FormField
            id="ownerName"
            label="Nombre del dueño"
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
            error={errors.ownerName}
            placeholder="Tu nombre"
            autoComplete="name"
          />
          <FormField
            id="ownerEmail"
            label="Email del dueño"
            type="email"
            value={ownerEmail}
            onChange={(event) => setOwnerEmail(event.target.value)}
            error={errors.ownerEmail}
            placeholder="dueño@ejemplo.com"
            autoComplete="email"
          />
          <FormField
            id="ownerPassword"
            label="Contraseña"
            type="password"
            value={ownerPassword}
            onChange={(event) => setOwnerPassword(event.target.value)}
            error={errors.ownerPassword}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
        </div>

        {formError && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{formError}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
        >
          {submitting ? 'Enviando solicitud…' : 'Enviar solicitud'}
        </button>
      </form>

      <p className="text-center text-sm text-ink-600">
        ¿Ya tenés una tienda en revisión?{' '}
        <Link to="/admin/login" className="font-medium text-brand-700 hover:text-brand-800">
          Consultá su estado
        </Link>
      </p>
    </div>
  );
}
