// ============================================
// Capa de datos: Firebase (real) o modo prueba (localStorage).
// El resto de la app usa solo estas funciones, sin importar el modo.
// ============================================
import {
    firebaseConfig,
    DOMINIO_LOGIN,
    USUARIO_EQUIPO,
    PERSONAS,
    CLAVE_EQUIPO_PRUEBA,
    CLAVE_ADMIN_PRUEBA,
    INTENTOS_MAXIMOS,
    MINUTOS_BLOQUEO
} from "./config.js";

export const modoPrueba = !firebaseConfig.apiKey || firebaseConfig.apiKey === "PEGAR_AQUI";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
let fb = null; // módulos y referencias de Firebase, cargados solo si hay configuración

async function cargarFirebase() {
    if (fb) return fb;
    const [{ initializeApp }, authMod, fsMod] = await Promise.all([
        import(`${SDK}/firebase-app.js`),
        import(`${SDK}/firebase-auth.js`),
        import(`${SDK}/firebase-firestore.js`)
    ]);
    const app = initializeApp(firebaseConfig);
    fb = { auth: authMod.getAuth(app), db: fsMod.getFirestore(app), authMod, fsMod };
    await authMod.setPersistence(fb.auth, authMod.browserLocalPersistence);
    return fb;
}

const personaDeEmail = (email) => {
    const id = (email || "").split("@")[0].toLowerCase();
    return PERSONAS[id] ? id : null;
};

// ---------- Sesión ----------
// Carolina (dueña) entra con su usuario y contraseña.
// Las chicas comparten el usuario del equipo: la clave se pone una sola vez por celular (Firebase recuerda
// la sesión) y después cada una elige su nombre, que queda guardado en este celular.

const CLAVE_PERSONA = "cr-persona";
const CLAVE_INTENTOS = "cr-intentos";
const EMAIL_EQUIPO = `${USUARIO_EQUIPO}@${DOMINIO_LOGIN}`;
export const necesitaClave = (personaId) => ["admin_general", "encargado"].includes(PERSONAS[personaId]?.rol);

// ¿Este celular ya tiene la sesión del equipo? (entonces las chicas entran solo tocando su nombre)
let equipoLogueado = false;
export const equipoVerificado = () => (modoPrueba ? localStorage.getItem("cr-demo-equipo") === "ok" : equipoLogueado);

// ---------- Bloqueo por intentos fallidos (en este celular) ----------

function leerIntentos() {
    try { return JSON.parse(localStorage.getItem(CLAVE_INTENTOS)) || { fallos: 0, hasta: 0 }; } catch { return { fallos: 0, hasta: 0 }; }
}

/** Minutos que faltan si este celular está bloqueado por intentos fallidos (0 = no está bloqueado). */
export function minutosBloqueado() {
    const { hasta } = leerIntentos();
    return hasta > Date.now() ? Math.ceil((hasta - Date.now()) / 60000) : 0;
}

function registrarFallo() {
    const i = leerIntentos();
    i.fallos += 1;
    if (i.fallos >= INTENTOS_MAXIMOS) {
        i.fallos = 0;
        i.hasta = Date.now() + MINUTOS_BLOQUEO * 60000;
    }
    localStorage.setItem(CLAVE_INTENTOS, JSON.stringify(i));
    return INTENTOS_MAXIMOS - i.fallos; // intentos que quedan antes del bloqueo
}

const limpiarFallos = () => localStorage.removeItem(CLAVE_INTENTOS);

/**
 * Inicia sesión con usuario y clave. Errores: "bloqueado" (demasiados intentos, en este celular o según Firebase)
 * o "clave:<intentos que quedan>".
 */
async function iniciarSesion(email, clave) {
    if (minutosBloqueado()) throw new Error("bloqueado");
    if (modoPrueba) {
        // En la demo: el admin general con su código; todos los demás, con el del equipo.
        const esAdmin = PERSONAS[personaDeEmail(email)]?.rol === "admin_general";
        const correcta = clave === (esAdmin ? CLAVE_ADMIN_PRUEBA : CLAVE_EQUIPO_PRUEBA);
        if (!correcta) {
            const quedan = registrarFallo();
            throw new Error(minutosBloqueado() ? "bloqueado" : `clave:${quedan}`);
        }
        limpiarFallos();
        return;
    }
    const { auth, authMod } = await cargarFirebase();
    try {
        await authMod.signInWithEmailAndPassword(auth, email, clave);
        limpiarFallos();
    } catch (e) {
        // Firebase frena por su cuenta las ráfagas de intentos
        if (e?.code === "auth/too-many-requests") throw new Error("bloqueado");
        const quedan = registrarFallo();
        throw new Error(minutosBloqueado() ? "bloqueado" : `clave:${quedan}`);
    }
}

// cb(personaId | null) cada vez que cambia la sesión.
export async function escucharSesion(cb) {
    if (modoPrueba) {
        cb(localStorage.getItem("cr-demo-usuario"));
        return;
    }
    const { auth, authMod } = await cargarFirebase();
    authMod.onAuthStateChanged(auth, (user) => {
        equipoLogueado = user?.email === EMAIL_EQUIPO;
        if (!user) return cb(null);
        if (equipoLogueado) {
            const persona = localStorage.getItem(CLAVE_PERSONA);
            return cb(PERSONAS[persona] && !necesitaClave(persona) ? persona : null);
        }
        cb(personaDeEmail(user.email));
    });
}

// Chicas: entrar(persona) si el celular ya tiene la sesión del equipo, o entrar(persona, claveDelEquipo) la primera vez.
// Carolina: entrar("carolina", clave).
export async function entrar(persona, clave = "") {
    if (necesitaClave(persona)) {
        await iniciarSesion(`${persona}@${DOMINIO_LOGIN}`, clave);
        if (modoPrueba) localStorage.setItem("cr-demo-usuario", persona);
        return;
    }
    if (!equipoVerificado()) {
        await iniciarSesion(EMAIL_EQUIPO, clave);
        if (modoPrueba) localStorage.setItem("cr-demo-equipo", "ok");
    }
    if (modoPrueba) {
        localStorage.setItem("cr-demo-usuario", persona);
        return;
    }
    localStorage.setItem(CLAVE_PERSONA, persona);
    location.reload();
}

export async function salir() {
    if (modoPrueba) {
        localStorage.removeItem("cr-demo-usuario");
        return;
    }
    localStorage.removeItem(CLAVE_PERSONA);
    const { auth, authMod } = await cargarFirebase();
    // La sesión del equipo se conserva: la próxima chica entra tocando su nombre, sin volver a poner la clave.
    if (auth.currentUser && auth.currentUser.email !== EMAIL_EQUIPO) await authMod.signOut(auth);
}

export function uidActual() {
    return modoPrueba ? "demo-" + localStorage.getItem("cr-demo-usuario") : fb?.auth.currentUser?.uid;
}

// ---------- Registros (tareas hechas) ----------

const leerDemo = () => {
    try { return JSON.parse(localStorage.getItem("cr-demo-registros")) || {}; } catch { return {}; }
};
const guardarDemo = (regs) => localStorage.setItem("cr-demo-registros", JSON.stringify(regs));

// cb(registros[]) en tiempo real. desdeFecha: "YYYY-MM-DD" (trae de esa fecha en adelante).
export async function escucharRegistros(desdeFecha, cb) {
    if (modoPrueba) {
        const emitir = () => cb(Object.values(leerDemo()).filter((r) => r.fecha >= desdeFecha));
        emitir();
        window.addEventListener("storage", (e) => e.key === "cr-demo-registros" && emitir());
        window.addEventListener("cr-demo-cambio", emitir);
        return;
    }
    const { db, fsMod } = await cargarFirebase();
    const q = fsMod.query(fsMod.collection(db, "registros"), fsMod.where("fecha", ">=", desdeFecha));
    fsMod.onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function marcar(registro) {
    const datos = { ...registro, uid: uidActual() };
    if (modoPrueba) {
        const regs = leerDemo();
        regs[registro.id] = datos;
        guardarDemo(regs);
        window.dispatchEvent(new Event("cr-demo-cambio"));
        return;
    }
    const { db, fsMod } = await cargarFirebase();
    const { id, ...resto } = datos;
    await fsMod.setDoc(fsMod.doc(db, "registros", id), { ...resto, creado: fsMod.serverTimestamp() });
}

export async function desmarcar(id) {
    if (modoPrueba) {
        const regs = leerDemo();
        delete regs[id];
        guardarDemo(regs);
        window.dispatchEvent(new Event("cr-demo-cambio"));
        return;
    }
    const { db, fsMod } = await cargarFirebase();
    await fsMod.deleteDoc(fsMod.doc(db, "registros", id));
}

// ---------- Tareas agregadas por Carolina ----------

const leerTareasDemo = () => {
    try { return JSON.parse(localStorage.getItem("cr-demo-tareas")) || {}; } catch { return {}; }
};

// cb(tareas[]) en tiempo real.
export async function escucharTareasExtra(cb) {
    if (modoPrueba) {
        const emitir = () => cb(Object.values(leerTareasDemo()));
        emitir();
        window.addEventListener("storage", (e) => e.key === "cr-demo-tareas" && emitir());
        window.addEventListener("cr-demo-tareas", emitir);
        return;
    }
    const { db, fsMod } = await cargarFirebase();
    fsMod.onSnapshot(fsMod.collection(db, "tareas"), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function guardarTareaExtra(tarea) {
    if (modoPrueba) {
        const todas = leerTareasDemo();
        todas[tarea.id] = tarea;
        localStorage.setItem("cr-demo-tareas", JSON.stringify(todas));
        window.dispatchEvent(new Event("cr-demo-tareas"));
        return;
    }
    const { db, fsMod } = await cargarFirebase();
    const { id, ...resto } = tarea;
    await fsMod.setDoc(fsMod.doc(db, "tareas", id), resto);
}

export async function borrarTareaExtra(id) {
    if (modoPrueba) {
        const todas = leerTareasDemo();
        delete todas[id];
        localStorage.setItem("cr-demo-tareas", JSON.stringify(todas));
        window.dispatchEvent(new Event("cr-demo-tareas"));
        return;
    }
    const { db, fsMod } = await cargarFirebase();
    await fsMod.deleteDoc(fsMod.doc(db, "tareas", id));
}

// ---------- Colecciones simples ----------
// "notasTurno"  → notas de cambio de turno (las escribe cualquiera del equipo)
// "agenda"      → cosas que Carolina agrega al calendario de cada una
// "notasDuena"  → bloc de notas privado de Carolina
// "pedidosClientes" → pedidos que hacen los clientes en el local (todas cargan y modifican)
// "pedidosDia"  → lo que Carolina cambió de los pedidos de un día (id = fecha); si no hay, vale el calendario fijo
// "notasEquipo" → notas compartidas (texto o lista con ítems): todas las escriben, editan y borran
// "recordatorios" → recordatorios de cada una: todas los ven, solo la autora los edita o borra
// "stock", "produccion", "cajas" → funciones traídas de Restix (ver js/extras.js)
// "mesas", "comandas", "salonMapa" → salón, mapa de mesas y cocina, también de Restix (ver js/salon.js)
// "usuarios", "permisos" → equipo, roles y permisos (ver js/equipo.js)
// "checklists"  → lo tildado de cada checklist por día (id = <checklist>_<fecha>); los ítems están en config.js
// Mismo manejo en los dos modos: en prueba se guardan en localStorage (cr-demo-<coleccion>).

export const COLECCIONES = ["notasTurno", "agenda", "notasDuena", "pedidosClientes", "pedidosDia", "notasEquipo", "recordatorios", "checklists", "stock", "produccion", "cajas", "mesas", "comandas", "salonMapa", "usuarios", "permisos"];
const claveDemo = (col) => `cr-demo-${col}`;
const leerColDemo = (col) => {
    try { return JSON.parse(localStorage.getItem(claveDemo(col))) || {}; } catch { return {}; }
};
const avisarColDemo = (col) => window.dispatchEvent(new Event(claveDemo(col)));

// cb(docs[]) en tiempo real.
export async function escucharColeccion(col, cb) {
    if (modoPrueba) {
        const emitir = () => cb(Object.values(leerColDemo(col)));
        emitir();
        window.addEventListener("storage", (e) => e.key === claveDemo(col) && emitir());
        window.addEventListener(claveDemo(col), emitir);
        return;
    }
    const { db, fsMod } = await cargarFirebase();
    fsMod.onSnapshot(
        fsMod.collection(db, col),
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        // Si Firebase no deja leer (ej. reglas sin publicar), la app lo avisa (ver "cr-error-lectura" en app.js).
        (error) => {
            console.error(`No se pudo leer "${col}"`, error);
            window.dispatchEvent(new CustomEvent("cr-error-lectura", { detail: { coleccion: col, codigo: error.code } }));
        }
    );
}

export async function guardarEn(col, docu) {
    const datos = { ...docu, uid: uidActual() };
    if (modoPrueba) {
        const todos = leerColDemo(col);
        todos[docu.id] = datos;
        localStorage.setItem(claveDemo(col), JSON.stringify(todos));
        avisarColDemo(col);
        return;
    }
    const { db, fsMod } = await cargarFirebase();
    const { id, ...resto } = datos;
    await fsMod.setDoc(fsMod.doc(db, col, id), resto);
}

export async function borrarDe(col, id) {
    if (modoPrueba) {
        const todos = leerColDemo(col);
        delete todos[id];
        localStorage.setItem(claveDemo(col), JSON.stringify(todos));
        avisarColDemo(col);
        return;
    }
    const { db, fsMod } = await cargarFirebase();
    await fsMod.deleteDoc(fsMod.doc(db, col, id));
}

// ---------- Solo modo prueba ----------

// Borra lo marcado, las tareas agregadas y las notas de este navegador (no toca la sesión ni el disclaimer).
export function borrarDatosPrueba() {
    if (!modoPrueba) return;
    localStorage.removeItem("cr-demo-registros");
    localStorage.removeItem("cr-demo-tareas");
    COLECCIONES.forEach((col) => localStorage.removeItem(claveDemo(col)));
    window.dispatchEvent(new Event("cr-demo-cambio"));
    window.dispatchEvent(new Event("cr-demo-tareas"));
    COLECCIONES.forEach(avisarColDemo);
}
