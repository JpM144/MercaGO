import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getStoreReport,
  getStoreReportTimeseries,
  getStoreTopProducts,
} from '../../services/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatPrice } from '../../utils/format.js';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';

const PERIODS = [
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
];

const RANGE_PRESETS = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
];

const MONTH_OPTIONS = [3, 6, 12, 24];

const pad2 = (n) => String(n).padStart(2, '0');

function todayBogota() {
  const now = new Date(Date.now() - 5 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function shortDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

function BarsChart({ points }) {
  const max = Math.max(...points.map((p) => p.quantity), 1);
  const allZero = points.every((p) => p.quantity === 0);
  const labelStep = Math.max(1, Math.ceil(points.length / 12));

  if (allZero) {
    return (
      <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center text-sm text-ink-500">
        Sin ventas en el período seleccionado.
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-52 items-end gap-[2px] border-b border-ink-200">
        {points.map((p) => (
          <div
            key={p.date}
            className="group relative flex h-full flex-1 items-end"
            title={`${p.date}: ${p.quantity} unidad(es)`}
          >
            <div
              className="w-full rounded-t bg-brand-500 transition group-hover:bg-brand-600"
              style={{ height: `${(p.quantity / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px]">
        {points.map((p, index) => (
          <div key={p.date} className="flex-1 text-center">
            {index % labelStep === 0 && (
              <span className="text-[10px] text-ink-400">{shortDate(p.date)}</span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-400">Máximo: {max} unidad(es) por día</p>
    </div>
  );
}

export default function AdminReports() {
  const { token } = useAuth();
  const [period, setPeriod] = useState('daily');
  const [date, setDate] = useState(() => todayBogota());
  const [reportState, setReportState] = useState({ loading: true, error: null });
  const [report, setReport] = useState(null);

  const [from, setFrom] = useState(() => addDays(todayBogota(), -29));
  const [to, setTo] = useState(() => todayBogota());
  const [timeseriesState, setTimeseriesState] = useState({ loading: true, error: null });
  const [timeseries, setTimeseries] = useState(null);

  const [months, setMonths] = useState(6);
  const [topState, setTopState] = useState({ loading: true, error: null });
  const [top, setTop] = useState(null);
  const [topDesc, setTopDesc] = useState(true);

  const loadReport = useCallback(async () => {
    setReportState({ loading: true, error: null });
    try {
      const data = await getStoreReport(token, period, date);
      setReport(data);
      setReportState({ loading: false, error: null });
    } catch (error) {
      setReportState({ loading: false, error: error.message });
    }
  }, [token, period, date]);

  const loadTimeseries = useCallback(async () => {
    setTimeseriesState({ loading: true, error: null });
    try {
      const data = await getStoreReportTimeseries(token, from, to);
      setTimeseries(data);
      setTimeseriesState({ loading: false, error: null });
    } catch (error) {
      setTimeseriesState({ loading: false, error: error.message });
    }
  }, [token, from, to]);

  const loadTopProducts = useCallback(async () => {
    setTopState({ loading: true, error: null });
    try {
      const data = await getStoreTopProducts(token, months);
      setTop(data);
      setTopState({ loading: false, error: null });
    } catch (error) {
      setTopState({ loading: false, error: error.message });
    }
  }, [token, months]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    loadTimeseries();
  }, [loadTimeseries]);

  useEffect(() => {
    loadTopProducts();
  }, [loadTopProducts]);

  const rankedProducts = useMemo(() => {
    if (!top) return [];
    const sorted = [...top.products].sort((a, b) => {
      const diff = b.averageMonthlyQuantity - a.averageMonthlyQuantity;
      return topDesc ? diff : -diff;
    });
    return sorted;
  }, [top, topDesc]);

  const applyPreset = (days) => {
    setTo(todayBogota());
    setFrom(addDays(todayBogota(), -(days - 1)));
  };

  const today = todayBogota();
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;
  const rangeLabel =
    timeseries && timeseries.from && timeseries.to
      ? `${shortDate(timeseries.from)} → ${shortDate(timeseries.to)}`
      : `${shortDate(from)} → ${shortDate(to)}`;
  const totals = report?.totals;

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-2xl font-bold text-ink-900">Informes</h2>
        <p className="text-sm text-ink-500">
          Ventas de tu tienda.
        </p>
      </div>

      <section className="grid gap-4 rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink-900">Resumen de ventas</h3>
            <p className="text-sm text-ink-500">
              {periodLabel} · {shortDate(date)}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              {PERIODS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPeriod(item.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    period === item.value
                      ? 'bg-brand-600 text-white'
                      : 'border border-ink-200 bg-white text-ink-600 hover:bg-brand-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="grid gap-1 text-sm font-medium text-ink-700">
              Fecha del período
              <input
                type="date"
                value={date}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                className="rounded-lg border border-ink-200 px-3 py-2 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </label>
          </div>
        </div>

        {reportState.loading && <Spinner label="Cargando informe…" />}

        {!reportState.loading && reportState.error && (
          <ErrorBanner message={reportState.error} onRetry={loadReport} />
        )}

        {!reportState.loading && !reportState.error && report && (
          <>
            {report.products.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center text-ink-500">
                No hay ventas en el período seleccionado.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-ink-200">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-ink-100 text-xs uppercase tracking-wide text-ink-600">
                    <tr>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3 text-right">Cantidad vendida</th>
                      <th className="px-4 py-3 text-right">Ingresos</th>
                      <th className="px-4 py-3 text-right">Costo</th>
                      <th className="px-4 py-3 text-right">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {report.products.map((product) => (
                      <tr key={product.productId} className="transition hover:bg-brand-50/50">
                        <td className="px-4 py-3 font-medium text-ink-900">{product.name}</td>
                        <td className="px-4 py-3 text-right text-ink-700">{product.quantity}</td>
                        <td className="px-4 py-3 text-right text-ink-700">
                          {formatPrice(product.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-ink-700">
                          {formatPrice(product.cost)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-ink-900">
                          {formatPrice(product.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {totals && (
                    <tfoot className="border-t border-ink-200 bg-ink-50">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-ink-900">Total</td>
                        <td className="px-4 py-3 text-right font-semibold text-ink-900">
                          {totals.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-ink-900">
                          {formatPrice(totals.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-ink-900">
                          {formatPrice(totals.cost)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-brand-700">
                          {formatPrice(totals.profit)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
            {totals && (
              <p className="text-xs text-ink-400">
                {totals.orders} pedido(s) confirmado(s) · {totals.items} ítem(s) en total.
              </p>
            )}
          </>
        )}
      </section>

      <section className="grid gap-4 rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink-900">Evolución de ventas</h3>
            <p className="text-sm text-ink-500">Unidades vendidas por día · {rangeLabel}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              {RANGE_PRESETS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => applyPreset(item.value)}
                  className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-brand-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="grid gap-1 text-sm font-medium text-ink-700">
              Desde
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="rounded-lg border border-ink-200 px-3 py-2 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink-700">
              Hasta
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="rounded-lg border border-ink-200 px-3 py-2 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </label>
          </div>
        </div>

        {timeseriesState.loading && <Spinner label="Cargando evolución…" />}

        {!timeseriesState.loading && timeseriesState.error && (
          <ErrorBanner message={timeseriesState.error} onRetry={loadTimeseries} />
        )}

        {!timeseriesState.loading && !timeseriesState.error && timeseries && (
          <BarsChart points={timeseries.points} />
        )}
      </section>

      <section className="grid gap-4 rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink-900">
              Promedio de ventas mensuales por producto
            </h3>
            <p className="text-sm text-ink-500">
              Últimos {months} meses · ordenado de mayor a menor
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm font-medium text-ink-700">
              Cantidad de meses
              <select
                value={months}
                onChange={(event) => setMonths(Number(event.target.value))}
                className="rounded-lg border border-ink-200 px-3 py-2 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              >
                {MONTH_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setTopDesc((value) => !value)}
              className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
            >
              {topDesc ? '↓ Mayor a menor' : '↑ Menor a mayor'}
            </button>
          </div>
        </div>

        {topState.loading && <Spinner label="Cargando ranking…" />}

        {!topState.loading && topState.error && (
          <ErrorBanner message={topState.error} onRetry={loadTopProducts} />
        )}

        {!topState.loading && !topState.error && top && (
          <>
            {rankedProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center text-ink-500">
                No hay ventas en los últimos {months} meses.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-ink-200">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-ink-100 text-xs uppercase tracking-wide text-ink-600">
                    <tr>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3 text-right">Total vendido</th>
                      <th className="px-4 py-3 text-right">Promedio mensual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {rankedProducts.map((product) => (
                      <tr key={product.productId} className="transition hover:bg-brand-50/50">
                        <td className="px-4 py-3 font-medium text-ink-900">{product.name}</td>
                        <td className="px-4 py-3 text-right text-ink-700">
                          {product.totalQuantity}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-ink-900">
                          {product.averageMonthlyQuantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
