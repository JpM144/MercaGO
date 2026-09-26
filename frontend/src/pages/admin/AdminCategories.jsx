import { useCallback, useEffect, useState } from 'react';
import { fetchCategories } from '../../services/products.js';
import { createCategory, deleteCategory, updateCategory } from '../../services/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import Notice from '../../components/Notice.jsx';

const inputClass =
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200';

export default function AdminCategories() {
  const { token } = useAuth();
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setState({ loading: true, error: null });
    try {
      const data = await fetchCategories();
      setCategories(data.categories ?? []);
      setState({ loading: false, error: null });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setFormError('');
    try {
      await createCategory(token, { name: newName.trim() });
      setNewName('');
      setNotice({ type: 'success', text: 'Categoría creada.' });
      await load();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const handleUpdate = async (category) => {
    try {
      await updateCategory(token, category.id, { name: editingName.trim() });
      setEditingId(null);
      setNotice({ type: 'success', text: `"${editingName.trim()}" actualizada.` });
      await load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) return;
    try {
      await deleteCategory(token, category.id);
      setNotice({ type: 'success', text: `Categoría "${category.name}" eliminada.` });
      await load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  return (
    <div className="grid gap-5">
      <h2 className="text-2xl font-bold text-ink-900">Categorías</h2>

      {notice && <Notice type={notice.type}>{notice.text}</Notice>}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Nueva categoría (ej. Videojuegos)"
          className={`${inputClass} max-w-sm`}
          aria-label="Nombre de nueva categoría"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="shrink-0 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
        >
          {creating ? 'Creando…' : '+ Crear'}
        </button>
      </form>
      {formError && <Notice type="error">{formError}</Notice>}

      {state.loading && <Spinner label="Cargando categorías…" />}

      {!state.loading && state.error && <ErrorBanner message={state.error} onRetry={load} />}

      {!state.loading && !state.error && (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-ink-100 text-xs uppercase tracking-wide text-ink-600">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {categories.map((category) => (
                <tr key={category.id} className="transition hover:bg-brand-50/50">
                  <td className="px-4 py-3">
                    {editingId === category.id ? (
                      <input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        className={inputClass}
                        autoFocus
                        aria-label={`Editar nombre de ${category.name}`}
                      />
                    ) : (
                      <span className="font-medium text-ink-900">{category.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-400">/{category.slug}</td>
                  <td className="px-4 py-3">
                    {editingId === category.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdate(category)}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition hover:bg-ink-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(category)}
                          className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(category)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
