import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyForStore } from '../services/stores.js';
import FormField from '../components/FormField.jsx';
import StoreDescriptionAssistant from '../components/StoreDescriptionAssistant.jsx';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function StoreApplyPage() {
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [description, setDescription] = useState('');
  const [appliedSuggestion, setAppliedSuggestion] = useState('');
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

  const handleApplySuggestion = (text) => {
    setDescription(text);
    setAppliedSuggestion(text);
  };

  if (confirmation) {
    return (
      <div className="mx-auto grid w-full max-w-lg gap-6 py-8">
        <div className="grid gap-3 rounded-xl border border-green-200 bg-green-50 p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">¡Solicitud enviada!</h1>
          <p className="text-sm leading-relaxed text-ink-700">{confirmation}</p>
          <p className="text-sm leading-relaxed text-ink-600">
            Cuando un administrador la apruebe, crearemos tu cuenta de tienda y te avisaremos por
            email para que puedas ingresar.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Volver al marketplace
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!storeName.trim()) {
      nextErrors.storeName = 'Ingresa el nombre de tu negocio.';
    }
    if (!slug.trim()) {
      nextErrors.slug = 'Ingresa un slug para tu tienda.';
    } else if (!SLUG_PATTERN.test(slug.trim())) {
      nextErrors.slug =
        'Usa minúsculas, números y guiones, sin espacios ni símbolos (ej.: mi-tienda).';
    }
    if (!whatsapp.trim()) {
      nextErrors.whatsapp = 'Ingresa un WhatsApp de contacto.';
    }
    if (!ownerName.trim()) {
      nextErrors.ownerName = 'Ingresa tu nombre.';
    }
    if (!EMAIL_PATTERN.test(ownerEmail.trim())) {
      nextErrors.ownerEmail = 'Ingresa un email válido.';
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
        slug: slug.trim(),
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
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Registra tu tienda</h1>
        <p className="text-ink-500">
          Completa los datos de tu negocio y los del dueño. Tu solicitud queda pendiente hasta que
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
            id="slug"
            label="Slug de la tienda (URL)"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            error={errors.slug}
            placeholder="mi-tienda"
            hint="Se usa en la URL: /tienda/mi-tienda. Minúsculas, números y guiones."
          />
          <FormField
            id="whatsapp"
            label="WhatsApp de contacto"
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value)}
            error={errors.whatsapp}
            placeholder="+57 *** *** ****"
            autoComplete="tel"
          />
          <StoreDescriptionAssistant
            onApply={handleApplySuggestion}
            applied={Boolean(appliedSuggestion) && appliedSuggestion === description}
          />

          <div className="grid gap-1.5">
            <label htmlFor="description" className="text-sm font-medium text-ink-700">
              Descripción
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setAppliedSuggestion('');
              }}
              placeholder="Cuentanos brevemente que vendes…"
              rows={3}
              className="w-full rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
            <p className="text-xs text-ink-400">
              {description.length}/500 caracteres. Puedes editarla libremente.
            </p>
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

        <div>
          <h2>
            Revisa bien tus datos ya que despúes no podrás editarlos 
          </h2>
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
        ¿Ya tienes una tienda en revisión?{' '}
        <Link to="/admin/login" className="font-medium text-brand-700 hover:text-brand-800">
          Consulta su estado
        </Link>
      </p>
    </div>
  );
}
