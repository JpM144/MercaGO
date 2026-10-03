import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FormField from '../components/FormField.jsx';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export default function RegisterPage() {
  const { token, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [token, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!name.trim()) {
      nextErrors.name = 'Ingresa tu nombre.';
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = 'Ingresa un email válido.';
    }
    if (password.length < 8) {
      nextErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setFormError('');
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-md gap-6 py-8">
      <div className="grid gap-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Crear cuenta</h1>
        <p className="text-ink-500">Regístrate y empieza a comprar.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-4 rounded-xl border border-ink-200 bg-white p-6 shadow-sm"
      >
        <FormField
          id="name"
          label="Nombre"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          placeholder="Tu nombre"
          autoComplete="name"
        />
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
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
        />
        <FormField
          id="confirmPassword"
          label="Confirmar contraseña"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errors.confirmPassword}
          placeholder="Repite tu contraseña"
          autoComplete="new-password"
        />

        {formError && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{formError}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
        >
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="text-center text-sm text-ink-600">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Ingresar
        </Link>
      </p>
    </div>
  );
}
