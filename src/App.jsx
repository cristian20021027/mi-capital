import { useEffect, useState } from "react";
import { supabase } from "./Supabasecliente";
import "./App.css";

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
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const valor = parseFloat(monto);
    if (!valor || valor <= 0) return;

    setEnviando(true);
    const guardado = await onAgregar({
      tipo,
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

/* ---------- Panel principal ---------- */
function Panel({ user }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [capitalInicial, setCapitalInicial] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [editandoInicial, setEditandoInicial] = useState(false);
  const [inicialTexto, setInicialTexto] = useState("");

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

  async function eliminar(id) {
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

  const salir = () => supabase.auth.signOut();

  if (cargando) {
    return (
      <main className="acceso">
        <p className="vacio">Cargando tus datos…</p>
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
      </section>

      <div className="formularios">
        <FormMovimiento tipo="ganancia" onAgregar={agregar} />
        <FormMovimiento tipo="gasto" onAgregar={agregar} />
      </div>

      <section className="historial" aria-label="Movimientos">
        <h2 className="historial__titulo">Movimientos</h2>
        {movimientos.length === 0 ? (
          <p className="vacio">
            Aún no hay movimientos. Registra tu primera ganancia o gasto.
          </p>
        ) : (
          <ul>
            {movimientos.map((m) => (
              <li key={m.id} className={`mov mov--${m.tipo}`}>
                <div>
                  <p className="mov__desc">{m.descripcion}</p>
                  <p className="mov__fecha">
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
      <main className="acceso">
        <p className="vacio">Cargando…</p>
      </main>
    );
  }

  return session ? <Panel key={session.user.id} user={session.user} /> : <Acceso />;
}