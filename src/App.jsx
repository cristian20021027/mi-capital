import { useEffect, useRef, useState } from "react";
import { supabase } from "./SupabaseCliente";
import "./App.css";

const SEGUNDOS_PARA_DESHACER = 5;
const TEMA_KEY = "capital.tema";

const CATEGORIAS = {
  ganancia: ["Venta", "Pago de cliente", "Préstamo recibido", "Otro"],
  gasto: [
    "Mercado / insumos",
    "Arriendo",
    "Servicios",
    "Transporte",
    "Nómina",
    "Otro",
  ],
};

function useTema() {
  const [tema, setTema] = useState(() => {
    try {
      return localStorage.getItem(TEMA_KEY) || "sistema";
    } catch {
      return "sistema";
    }
  });

  useEffect(() => {
    const raiz = document.documentElement;
    if (tema === "sistema") {
      raiz.removeAttribute("data-theme");
    } else {
      raiz.setAttribute("data-theme", tema === "oscuro" ? "dark" : "light");
    }
    try {
      localStorage.setItem(TEMA_KEY, tema);
    } catch {
      /* sin preferencia guardada */
    }
  }, [tema]);

  const prefiereOscuro =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const esOscuroAhora =
    tema === "oscuro" || (tema === "sistema" && prefiereOscuro);

  function alternar() {
    setTema(esOscuroAhora ? "claro" : "oscuro");
  }

  return { esOscuroAhora, alternar };
}

function BotonTema() {
  const { esOscuroAhora, alternar } = useTema();
  return (
    <button
      className="boton-tema"
      onClick={alternar}
      aria-label={esOscuroAhora ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={esOscuroAhora ? "Modo claro" : "Modo oscuro"}
    >
      {esOscuroAhora ? "☀️" : "🌙"}
    </button>
  );
}

const formatoPesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const pesos = (n) => formatoPesos.format(n);

function traducirError(mensaje) {
  if (/invalid login credentials/i.test(mensaje))
    return "Correo o contraseña incorrectos.";
  if (/already registered/i.test(mensaje))
    return "Ese correo ya tiene una cuenta. Usa \"Ya tengo cuenta\".";
  if (/password should be at least/i.test(mensaje))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (/email not confirmed/i.test(mensaje))
    return "Falta confirmar tu correo. Revisa tu bandeja de entrada.";
  return mensaje;
}

/* ---------- Acceso: crear cuenta / entrar ---------- */
function Acceso() {
  const [modo, setModo] = useState("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  const creando = modo === "crear";

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setAviso("");

    if (!email.trim() || !password) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }
    if (creando && password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setEnviando(true);
    const credenciales = { email: email.trim(), password };
    const { data, error: fallo } = creando
      ? await supabase.auth.signUp(credenciales)
      : await supabase.auth.signInWithPassword(credenciales);
    setEnviando(false);

    if (fallo) {
      setError(traducirError(fallo.message));
    } else if (creando && !data.session) {
      // El proyecto exige confirmar el correo antes de entrar
      setAviso(
        "Te enviamos un correo para confirmar tu cuenta. Confírmalo y luego entra."
      );
      setModo("entrar");
      setPassword("");
      setConfirmar("");
    }
    // Si todo sale bien, App detecta la sesión y muestra el panel
  }

  return (
    <main className="acceso">
      <h1 className="acceso__titulo">Mi capital</h1>
      <p className="acceso__texto">
        Lleva la cuenta de lo que tienes, lo que ganas y lo que gastas, desde
        cualquier dispositivo.
      </p>

      <form className="tarjeta" onSubmit={enviar}>
        <h2 className="tarjeta__titulo">
          {creando ? "Crear cuenta" : "Entrar"}
        </h2>

        <label className="campo">
          <span>Correo</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="campo">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={creando ? "new-password" : "current-password"}
          />
        </label>

        {creando && (
          <label className="campo">
            <span>Repite la contraseña</span>
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {aviso && <p role="status">{aviso}</p>}

        <button className="boton" type="submit" disabled={enviando}>
          {enviando ? "Un momento…" : creando ? "Crear cuenta" : "Entrar"}
        </button>

        <button
          className="enlace"
          type="button"
          onClick={() => {
            setModo(creando ? "entrar" : "crear");
            setError("");
            setAviso("");
          }}
        >
          {creando ? "Ya tengo cuenta" : "No tengo cuenta, crear una"}
        </button>
      </form>
    </main>
  );
}

/* ---------- Formulario de ganancia / gasto ---------- */
function FormMovimiento({ tipo, onAgregar }) {
  const esGasto = tipo === "gasto";
  const categorias = CATEGORIAS[tipo];
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState(categorias[0]);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const valor = parseFloat(monto);
    if (!valor || valor <= 0) return;

    setEnviando(true);
    const guardado = await onAgregar({
      tipo,
      categoria,
      descripcion: descripcion.trim() || (esGasto ? "Gasto" : "Ganancia"),
      monto: valor,
    });
    setEnviando(false);

    if (guardado) {
      setDescripcion("");
      setMonto("");
    }
  }

  return (
    <form className={`tarjeta tarjeta--${tipo}`} onSubmit={enviar}>
      <h2 className="tarjeta__titulo">
        {esGasto ? "Registrar un gasto" : "Registrar una ganancia"}
      </h2>
      <label className="campo">
        <span>{esGasto ? "¿En qué gastaste?" : "¿De dónde vino?"}</span>
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder={esGasto ? "Ej: mercado, arriendo" : "Ej: venta, pago"}
        />
      </label>
      <label className="campo">
        <span>Categoría</span>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        <span>Monto</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0"
          required
        />
      </label>
      <button className={`boton boton--${tipo}`} type="submit" disabled={enviando}>
        {esGasto ? "Restar del capital" : "Sumar al capital"}
      </button>
    </form>
  );
}

/* ---------- Gráfico de capital ---------- */
function GraficoCapital({ capitalInicial, movimientos }) {
  const ordenados = [...movimientos].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  let acumulado = capitalInicial;
  const puntos = [{ fecha: null, capital: acumulado }];
  for (const m of ordenados) {
    acumulado += m.tipo === "ganancia" ? m.monto : -m.monto;
    puntos.push({ fecha: m.created_at, capital: acumulado });
  }

  if (puntos.length < 2) {
    return (
      <p className="vacio">
        Registra al menos un movimiento para ver cómo cambia tu capital en el
        tiempo.
      </p>
    );
  }

  const ANCHO = 600;
  const ALTO = 220;
  const MARGEN = 12;

  const valores = puntos.map((p) => p.capital);
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const rango = max - min || 1;

  const coords = puntos.map((p, i) => {
    const x = (i / (puntos.length - 1)) * (ANCHO - MARGEN * 2) + MARGEN;
    const y =
      ALTO -
      MARGEN -
      ((p.capital - min) / rango) * (ALTO - MARGEN * 2);
    return { x, y, capital: p.capital };
  });

  const linea = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const area = `${MARGEN},${ALTO - MARGEN} ${linea} ${ANCHO - MARGEN},${ALTO - MARGEN}`;

  const colorLinea = acumulado < 0 ? "var(--gasto)" : "var(--ganancia)";
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];

  return (
    <div className="grafico">
      <svg
        className="grafico__svg"
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Capital acumulado, de ${pesos(primero.capital)} a ${pesos(ultimo.capital)}`}
      >
        <polygon points={area} fill={colorLinea} opacity="0.12" />
        <polyline
          points={linea}
          fill="none"
          stroke={colorLinea}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 4 : 0} fill={colorLinea} />
        ))}
      </svg>
      <div className="grafico__pie">
        <span>{pesos(min)}</span>
        <span>{pesos(max)}</span>
      </div>
      <div className="grafico__fechas">
        <span>Capital inicial</span>
        <span>
          {new Date(ultimo.fecha).toLocaleDateString("es-CO", {
            dateStyle: "medium",
          })}
        </span>
      </div>
    </div>
  );
}

/* ---------- Resumen por categoría ---------- */
function PorCategoria({ titulo, datos, color }) {
  if (datos.length === 0) return null;
  const max = Math.max(...datos.map((d) => d.total));

  return (
    <div className="categorias">
      <p className="categorias__titulo">{titulo}</p>
      <ul className="categorias__lista">
        {datos.map((d) => (
          <li key={d.categoria} className="categorias__fila">
            <span className="categorias__nombre">{d.categoria}</span>
            <span className="categorias__barra-fondo">
              <span
                className="categorias__barra"
                style={{ width: `${(d.total / max) * 100}%`, background: color }}
              />
            </span>
            <span className="categorias__monto">{pesos(d.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Panel principal ---------- */
function Panel({ user }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [capitalInicial, setCapitalInicial] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [editandoInicial, setEditandoInicial] = useState(false);
  const [inicialTexto, setInicialTexto] = useState("");
  const [pendientes, setPendientes] = useState({}); // id -> movimiento en espera de borrarse
  const temporizadores = useRef({});
  const [filtroTipo, setFiltroTipo] = useState("todos"); // todos | ganancia | gasto
  const [busqueda, setBusqueda] = useState("");
  const [filtroMes, setFiltroMes] = useState("todos"); // "todos" o "YYYY-MM"

  // Si sales del panel con un borrado a medias, se confirma igual en la nube
  useEffect(() => {
    return () => {
      Object.values(temporizadores.current).forEach(clearTimeout);
    };
  }, []);

  // Carga los datos del usuario (las reglas RLS ya filtran por usuario)
  useEffect(() => {
    let activo = true;
    (async () => {
      const [perfil, movs] = await Promise.all([
        supabase.from("perfiles").select("capital_inicial").maybeSingle(),
        supabase
          .from("movimientos")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      if (!activo) return;

      if (perfil.error || movs.error) {
        setError("No pudimos cargar tus datos. Revisa tu conexión e intenta de nuevo.");
      } else {
        setCapitalInicial(
          perfil.data ? Number(perfil.data.capital_inicial) : null
        );
        setMovimientos(movs.data.map((m) => ({ ...m, monto: Number(m.monto) })));
      }
      setCargando(false);
    })();
    return () => {
      activo = false;
    };
  }, []);

  const ganancias = movimientos
    .filter((m) => m.tipo === "ganancia")
    .reduce((suma, m) => suma + m.monto, 0);
  const gastos = movimientos
    .filter((m) => m.tipo === "gasto")
    .reduce((suma, m) => suma + m.monto, 0);
  const capitalActual = (capitalInicial ?? 0) + ganancias - gastos;

  // El capital y los totales siempre usan TODOS los movimientos; solo la
  // lista de abajo se filtra, para que filtrar nunca altere las cifras.
  const meses = [
    ...new Set(movimientos.map((m) => m.created_at.slice(0, 7))),
  ].sort((a, b) => b.localeCompare(a));

  const textoBusqueda = busqueda.trim().toLowerCase();
  const movimientosVisibles = movimientos
    .filter((m) => !pendientes[m.id])
    .filter((m) => filtroTipo === "todos" || m.tipo === filtroTipo)
    .filter(
      (m) => filtroMes === "todos" || m.created_at.slice(0, 7) === filtroMes
    )
    .filter(
      (m) => !textoBusqueda || m.descripcion.toLowerCase().includes(textoBusqueda)
    );

  function porCategoria(tipoMovimiento) {
    const totales = {};
    for (const m of movimientos) {
      if (m.tipo !== tipoMovimiento) continue;
      const clave = m.categoria || "Otro";
      totales[clave] = (totales[clave] || 0) + m.monto;
    }
    return Object.entries(totales)
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);
  }

  const categoriasGasto = porCategoria("gasto");
  const categoriasGanancia = porCategoria("ganancia");

  function formatoMes(clave) {
    const [anio, mes] = clave.split("-");
    const nombre = new Date(Number(anio), Number(mes) - 1, 1).toLocaleDateString(
      "es-CO",
      { month: "long", year: "numeric" }
    );
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }

  async function fijarInicial(e) {
    e.preventDefault();
    const valor = parseFloat(inicialTexto);
    if (Number.isNaN(valor) || valor < 0) return;

    const { error: fallo } = await supabase
      .from("perfiles")
      .upsert({ user_id: user.id, capital_inicial: valor });
    if (fallo) {
      setError("No pudimos guardar el capital inicial. Intenta de nuevo.");
      return;
    }
    setError("");
    setCapitalInicial(valor);
    setEditandoInicial(false);
    setInicialTexto("");
  }

  async function agregar(nuevo) {
    const { data, error: fallo } = await supabase
      .from("movimientos")
      .insert(nuevo)
      .select()
      .single();
    if (fallo) {
      setError("No pudimos guardar el movimiento. Intenta de nuevo.");
      return false;
    }
    setError("");
    setMovimientos((lista) => [{ ...data, monto: Number(data.monto) }, ...lista]);
    return true;
  }

  function eliminar(id) {
    const movimiento = movimientos.find((m) => m.id === id);
    if (!movimiento || pendientes[id]) return;

    const temporizador = setTimeout(
      () => confirmarEliminar(id),
      SEGUNDOS_PARA_DESHACER * 1000
    );
    temporizadores.current[id] = temporizador;
    setPendientes((p) => ({ ...p, [id]: movimiento }));
  }

  async function confirmarEliminar(id) {
    delete temporizadores.current[id];
    setPendientes((p) => {
      const { [id]: _omitido, ...resto } = p;
      return resto;
    });

    const { error: fallo } = await supabase
      .from("movimientos")
      .delete()
      .eq("id", id);
    if (fallo) {
      setError("No pudimos eliminar el movimiento. Intenta de nuevo.");
      return;
    }
    setError("");
    setMovimientos((lista) => lista.filter((m) => m.id !== id));
  }

  function deshacerEliminar(id) {
    clearTimeout(temporizadores.current[id]);
    delete temporizadores.current[id];
    setPendientes((p) => {
      const { [id]: _omitido, ...resto } = p;
      return resto;
    });
  }

  const salir = () => supabase.auth.signOut();

  if (cargando) {
    return (
      <main className="panel">
        <header className="panel__barra">
          <span className="hueso hueso--usuario" />
          <span className="hueso hueso--enlace" />
        </header>
        <section className="resumen">
          <span className="hueso hueso--etiqueta" />
          <span className="hueso hueso--cifra" />
          <div className="cuenta">
            <div className="hueso hueso--bloque" />
            <div className="hueso hueso--bloque" />
            <div className="hueso hueso--bloque" />
          </div>
        </section>
        <div className="formularios">
          <span className="hueso hueso--tarjeta" />
          <span className="hueso hueso--tarjeta" />
        </div>
      </main>
    );
  }

  /* Paso 1: todavía no hay capital inicial */
  if (capitalInicial === null) {
    return (
      <main className="acceso">
        <h1 className="acceso__titulo">Bienvenido</h1>
        <p className="acceso__texto">
          Empecemos por lo básico: ¿con cuánto dinero cuentas hoy?
        </p>
        <form className="tarjeta" onSubmit={fijarInicial}>
          <label className="campo">
            <span>Capital inicial</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={inicialTexto}
              onChange={(e) => setInicialTexto(e.target.value)}
              placeholder="0"
              autoFocus
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="boton" type="submit">
            Guardar capital inicial
          </button>
        </form>
        <button className="enlace" onClick={salir}>
          Salir
        </button>
      </main>
    );
  }

  return (
    <main className="panel">
      <header className="panel__barra">
        <span className="panel__usuario">{user.email}</span>
        <button className="enlace" onClick={salir}>
          Salir
        </button>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="resumen" aria-label="Resumen de tu capital">
        <p className="resumen__etiqueta">Capital actual</p>
        <p
          className={`resumen__cifra ${capitalActual < 0 ? "resumen__cifra--negativa" : ""}`}
        >
          {pesos(capitalActual)}
        </p>

        <dl className="cuenta">
          <div>
            <dt>Capital inicial</dt>
            <dd>
              {editandoInicial ? (
                <form className="cuenta__editar" onSubmit={fijarInicial}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={inicialTexto}
                    onChange={(e) => setInicialTexto(e.target.value)}
                    aria-label="Nuevo capital inicial"
                    autoFocus
                  />
                  <button className="enlace" type="submit">
                    Guardar
                  </button>
                </form>
              ) : (
                <>
                  {pesos(capitalInicial)}
                  <button
                    className="enlace"
                    onClick={() => {
                      setInicialTexto(String(capitalInicial));
                      setEditandoInicial(true);
                    }}
                  >
                    Cambiar
                  </button>
                </>
              )}
            </dd>
          </div>
          <div className="cuenta__ganancia">
            <dt>Ganancias</dt>
            <dd>+ {pesos(ganancias)}</dd>
          </div>
          <div className="cuenta__gasto">
            <dt>Gastos</dt>
            <dd>− {pesos(gastos)}</dd>
          </div>
        </dl>

        <GraficoCapital capitalInicial={capitalInicial} movimientos={movimientos} />

        <div className="categorias-doble">
          <PorCategoria
            titulo="Gastos por categoría"
            datos={categoriasGasto}
            color="var(--gasto)"
          />
          <PorCategoria
            titulo="Ganancias por categoría"
            datos={categoriasGanancia}
            color="var(--ganancia)"
          />
        </div>
      </section>

      <div className="formularios">
        <FormMovimiento tipo="ganancia" onAgregar={agregar} />
        <FormMovimiento tipo="gasto" onAgregar={agregar} />
      </div>

      <section className="historial" aria-label="Movimientos">
        <h2 className="historial__titulo">Movimientos</h2>

        <div className="filtros">
          <div className="filtros__tipos" role="group" aria-label="Filtrar por tipo">
            <button
              className={`chip ${filtroTipo === "todos" ? "chip--activo" : ""}`}
              onClick={() => setFiltroTipo("todos")}
            >
              Todos
            </button>
            <button
              className={`chip chip--ganancia ${filtroTipo === "ganancia" ? "chip--activo" : ""}`}
              onClick={() => setFiltroTipo("ganancia")}
            >
              Ganancias
            </button>
            <button
              className={`chip chip--gasto ${filtroTipo === "gasto" ? "chip--activo" : ""}`}
              onClick={() => setFiltroTipo("gasto")}
            >
              Gastos
            </button>
          </div>

          <div className="filtros__campos">
            <input
              className="filtros__buscar"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por descripción"
              aria-label="Buscar por descripción"
            />
            {meses.length > 0 && (
              <select
                className="filtros__mes"
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
                aria-label="Filtrar por mes"
              >
                <option value="todos">Todos los meses</option>
                {meses.map((clave) => (
                  <option key={clave} value={clave}>
                    {formatoMes(clave)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {movimientosVisibles.length === 0 ? (
          <p className="vacio">
            {movimientos.length === 0
              ? "Aún no hay movimientos. Registra tu primera ganancia o gasto."
              : "Ningún movimiento coincide con el filtro."}
          </p>
        ) : (
          <ul>
            {movimientosVisibles.map((m) => (
              <li key={m.id} className={`mov mov--${m.tipo}`}>
                <div>
                  <p className="mov__desc">{m.descripcion}</p>
                  <p className="mov__fecha">
                    {m.categoria && <span className="mov__categoria">{m.categoria}</span>}
                    {new Date(m.created_at).toLocaleString("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <p className="mov__monto">
                  {m.tipo === "gasto" ? "−" : "+"} {pesos(m.monto)}
                </p>
                <button
                  className="enlace"
                  onClick={() => eliminar(m.id)}
                  aria-label={`Eliminar ${m.descripcion}`}
                >
                  Eliminar
                </button>
              </li>
              ))}
          </ul>
        )}
      </section>

      {Object.entries(pendientes).length > 0 && (
        <div className="avisos" role="status">
          {Object.entries(pendientes).map(([id, movimiento]) => (
            <div key={id} className="aviso">
              <span>“{movimiento.descripcion}” eliminado</span>
              <button className="aviso__boton" onClick={() => deshacerEliminar(id)}>
                Deshacer
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

/* ---------- App ---------- */
export default function App() {
  // undefined = todavía comprobando si hay sesión; null = sin sesión
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    // Mantener este callback síncrono: nada de llamadas a Supabase aquí adentro
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <>
        <BotonTema />
        <main className="pantalla-carga" aria-label="Cargando">
          <span className="spinner" />
        </main>
      </>
    );
  }

  return (
    <>
      <BotonTema />
      {session ? <Panel key={session.user.id} user={session.user} /> : <Acceso />}
    </>
  );
}