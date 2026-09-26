import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FormField from '../components/FormField.jsx';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export default function LoginPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from ?? '/';

  useEffect(() => {
    if (token) navigate(from, { replace: true });
  }, [token, from, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = 'Ingresá un email válido.';
    }
    if (!password) {
      nextErrors.password = 'Ingresá tu contraseña.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setFormError('');
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-md gap-6 py-8">
      <div className="grid gap-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Ingresar</h1>
        <p className="text-ink-500">Accedé para completar tu pedido.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-4 rounded-xl border border-ink-200 bg-white p-6 shadow-sm"
      >
        <FormField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          placeholder="tucorreo@ejemplo.com"
          autoComplete="email"
        />
        <FormField
          id="password"
          label="Contraseña"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        {formError && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{formError}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
        >
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <p className="text-center text-sm text-ink-600">
        ¿No tenés cuenta?{' '}
        <Link to="/register" className="font-medium text-brand-700 hover:text-brand-800">
          Creá una gratis
        </Link>
      </p>
    </div>
  );
}
