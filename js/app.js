// ============================================
// Interfaz: login, bienvenida, hoy (3 momentos), cambio de turno, calendario por semanas,
// glosario, locales y, para Carolina, actividad, informes, tareas y bloc de notas.
// ============================================
import { PERSONAS, LOCALES, CLAVE_EQUIPO_PRUEBA, MINUTOS_BLOQUEO, PEDIDOS, FORMAS_PAGO, CHECKLISTS } from "./config.js";
import * as cal from "./calendario.js";
import * as datos from "./datos.js";
import { sembrarDemo } from "./demo.js";
import * as extras from "./extras.js";

const $app = document.getElementById("app");
const estado = {
    persona: null,
    registros: {},
    vista: "hoy",
    mesInforme: null,
    mesCalendario: null,      // Date: primer día del mes que se ve en el calendario
    diaSeleccionado: null,    // "YYYY-MM-DD"
    notas: {},                // borradores de notas por asignación
    notaAbierta: {},
    formTarea: { nombre: "", local: "centro", tipo: "semanal", s1: "", s2: "", s3: "", s4: "", persona: "" },
    notasTurno: [],           // notas de cambio de turno
    agenda: [],               // cosas que Carolina agrega al calendario
    notasDuena: [],           // bloc de notas de Carolina
    formTurno: { local: null, texto: "" },
    formAgenda: { texto: "", local: "centro", para: "todas", fecha: "" },
    textoNotaDuena: "",
    editandoNota: null,       // { col, id, texto } mientras se edita una nota
    buscarGlosario: "",
    modoGlosario: "local",
    filtroCal: { local: "todos", estado: "todas" }, // calendario: local y estado    // glosario: local | persona | semana
    filtroMuro: "todos",      // muro de actividad de Carolina: todos | centro | plaza
    animar: true,             // animación de entrada: solo al cambiar de pantalla
    recien: null,             // tarea recién marcada (animación del tilde)
    pedidosClientes: [],      // pedidos que hacen los clientes en el local
    pedidosDia: [],           // cambios de Carolina a los pedidos de un día
    formPedidos: null,        // { fecha, pide, llega, nota } mientras Carolina cambia un día
    filtroPedidos: null,
    buscarPedidos: "",
    formPedido: { cliente: "", telefono: "", producto: "", cantidad: "1", pago: "", pagoEstado: "nada", sena: "", total: "", nota: "", local: "" },
    filtroHistorial: "entregado", // historial de pedidos (Carolina): entregado | cancelado
    buscarHistorial: "",
    pedidoEditando: null,
    edicionPedido: {},
    notasEquipo: [],          // notas compartidas: todas las ven, escriben, editan y borran
    formNotaEquipo: null,     // nota nueva (modo texto o lista)
    edicionNotaEquipo: null,  // nota que se está editando (mismos campos + id)
    recordatorios: [],        // recordatorios De / Para (todas los ven; a cada una le aparecen los suyos en Hoy)
    formRecordatorio: null,   // recordatorio nuevo
    edicionRecordatorio: null, // recordatorio que se está editando (mismos campos + id)
    checklists: [],           // lo tildado de cada checklist por día (id = <checklist>_<fecha>)
    fechaChecklist: null,     // día que se ve en la pantalla Checklist ("YYYY-MM-DD"; null = hoy)
    escuchando: false
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nombre = (id) => PERSONAS[id]?.nombre || id;
const hora = (isoStr) => new Date(isoStr).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const diaCorto = (isoStr) => cal.fechaLarga(new Date(isoStr));
const esDuena = () => PERSONAS[estado.persona]?.rol === "duena";
const personasDe = (localId) => [...new Set(Object.values(LOCALES[localId].turnos))];
const nombreTurno = (t) => (t === "manana" ? "mañana" : "tarde");
const nuevoId = (prefijo) => `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const masNuevoPrimero = (a, b) => b.cuando.localeCompare(a.cuando);
const empleadas = () => Object.keys(PERSONAS).filter((id) => PERSONAS[id].rol === "empleada");
const paraQuien = (para) => (para === "todas" ? "todo el equipo" : nombre(para));
// Tareas puntuales de Carolina ("agenda"). "todas" = todas las del local (o todas si no tiene local).
const agendaPara = (a, persona) => a.para === persona || (a.para === "todas" && (!a.local || personasDe(a.local).includes(persona)));
const agendaDe = (fecha, persona = null) => estado.agenda.filter((a) => a.fecha === fecha && (!persona || agendaPara(a, persona)));
const idHechaAgenda = (a) => `${a.id}_hecha`;
const registroAgenda = (a) => estado.registros[idHechaAgenda(a)];
// Nombre de una tarea fija, semanal o puntual a partir de su id.
const nombreDeTarea = (id) => cal.todasLasTareas().find((t) => t.id === id)?.nombre || estado.agenda.find((a) => a.id === id)?.texto || id;

// ---------- Arranque (se llama al final del archivo) ----------

const iniciar = () => datos.escucharSesion((persona) => {
    estado.persona = persona;
    if (!persona) return pantallaLogin();
    if (!estado.escuchando) {
        estado.escuchando = true;
        const desde = cal.iso(cal.sumarDias(cal.ahora(), -120));
        datos.escucharRegistros(desde, (lista) => {
            estado.registros = Object.fromEntries(lista.map((r) => [r.id, r]));
            render();
        });
        datos.escucharTareasExtra((lista) => {
            cal.setTareasExtra(lista);
            render();
        });
        datos.escucharColeccion("notasTurno", (lista) => { estado.notasTurno = lista; render(); });
        datos.escucharColeccion("agenda", (lista) => { estado.agenda = lista; render(); });
        datos.escucharColeccion("pedidosClientes", (lista) => { estado.pedidosClientes = lista; render(); });
        datos.escucharColeccion("pedidosDia", (lista) => { estado.pedidosDia = lista; render(); });
        datos.escucharColeccion("notasEquipo", (lista) => { estado.notasEquipo = lista; render(); });
        datos.escucharColeccion("recordatorios", (lista) => { estado.recordatorios = lista; render(); });
        datos.escucharColeccion("checklists", (lista) => { estado.checklists = lista; render(); });
        extras.escucharExtras();
        // El bloc de notas es privado: solo Carolina lo lee.
        if (PERSONAS[persona]?.rol === "duena") {
            datos.escucharColeccion("notasDuena", (lista) => { estado.notasDuena = lista; render(); });
        }
    }
    if (!localStorage.getItem(`cr-bienvenida-${persona}`)) return pantallaBienvenida();
    estado.vista = esDuena() ? "actividad" : "hoy";
    render();
});

// Lo que marcó o escribió esta persona. Las chicas comparten la sesión del equipo (mismo uid),
// así que además se compara la persona guardada en el registro o la nota.
const esMio = (docu) => !!docu && docu.uid === datos.uidActual() && (!docu.persona || docu.persona === estado.persona);

// ---------- Login ----------

// Estado del login (se conserva si la pantalla se vuelve a dibujar a mitad del proceso).
const login = { elegida: null, error: "" };

function pantallaLogin() {
    const elegida = login.elegida;
    let cuerpo;

    const bloqueo = datos.minutosBloqueado();
    if (elegida && bloqueo) {
        // Demasiados intentos fallidos en este celular
        cuerpo = `
        <div class="login__form">
            <p class="login__pregunta">Demasiados intentos 🔒</p>
            <p class="login__error">Por seguridad, este celular quedó bloqueado. Probá de nuevo en ${bloqueo} ${bloqueo === 1 ? "minuto" : "minutos"}.</p>
            <button class="boton boton--suave" type="button" data-volver>Volver</button>
        </div>`;
    } else if (elegida) {
        // Chica en un celular nuevo: clave del equipo (una sola vez). Carolina: su contraseña.
        const esEquipo = !datos.necesitaClave(elegida);
        cuerpo = `
        <form class="login__form" id="form-clave">
            <p class="login__pregunta">Hola, ${esc(nombre(elegida))} 👋</p>
            ${esEquipo ? `<p class="login__ayuda">Poné la <strong>clave del equipo</strong>. Te la pide solo esta vez en este celular.</p>` : ""}
            <label>${esEquipo ? "Clave del equipo" : "Contraseña"}
                <input name="clave" type="password" autocomplete="current-password" required autofocus>
            </label>
            ${login.error ? `<p class="login__error">${esc(login.error)}</p>` : ""}
            <button class="boton boton--grande" type="submit">Entrar</button>
            <button class="boton boton--suave" type="button" data-volver>Volver</button>
        </form>`;
    } else {
        cuerpo = `
        <div class="login__personas">
            <p class="login__pregunta">¿Quién sos?</p>
            ${Object.entries(PERSONAS).filter(([id]) => !datos.necesitaClave(id)).map(([id, p]) =>
                `<button class="boton boton--grande" data-elegir="${id}">${esc(p.nombre)}${p.puesto ? ` <small class="login__puesto">· ${esc(p.puesto)}</small>` : ""}</button>`).join("")}
        </div>
        ${Object.entries(PERSONAS).filter(([id]) => datos.necesitaClave(id)).map(([id, p]) =>
            `<button class="login__duena" data-elegir="${id}">Soy ${esc(p.nombre)}${p.puesto ? ` (${esc(p.puesto)})` : ""}</button>`).join("")}`;
    }

    $app.innerHTML = `
    <main class="login">
        <div class="login__marca">
            <img class="login__logo" src="assets/img/logo.svg" alt="Cremona" onerror="this.replaceWith(Object.assign(document.createElement('span'), { className: 'login__logo login__logo--emoji', textContent: '🧁' }))">
            <h1>Cremona</h1>
            <p>Tareas de los locales Centro y Plaza</p>
        </div>
        ${datos.modoPrueba ? `
        <div class="aviso aviso--prueba">
            <strong>Demo · datos de prueba.</strong> Lo que cargues queda solo en este navegador.
            Clave del equipo: <strong>${esc(CLAVE_EQUIPO_PRUEBA)}</strong> · la de Carolina puede ser cualquiera.
        </div>` : ""}
        ${cuerpo}
    </main>`;

    const entrar = async (boton, ...args) => {
        boton.disabled = true;
        boton.textContent = "Entrando…";
        try {
            await datos.entrar(...args);
            login.elegida = null;
            login.error = "";
            if (datos.modoPrueba) location.reload();
        } catch (e) {
            const quedan = Number(e.message.split(":")[1]);
            // "bloqueado" sin bloqueo en este celular = lo frenó Firebase (muchos intentos desde varios lados)
            login.error =
                e.message === "bloqueado"
                    ? "Demasiados intentos. Esperá unos minutos y probá de nuevo."
                    : `Clave incorrecta.${quedan && quedan <= 3 ? ` Te ${quedan === 1 ? "queda 1 intento" : `quedan ${quedan} intentos`} antes de que se bloquee ${MINUTOS_BLOQUEO} minutos.` : ""}`;
            pantallaLogin();
        }
    };

    $app.querySelectorAll("[data-elegir]").forEach((b) => b.addEventListener("click", () => {
        const persona = b.dataset.elegir;
        login.error = "";
        // Si este celular ya tiene la sesión del equipo, la chica entra directo.
        if (!datos.necesitaClave(persona) && datos.equipoVerificado()) return entrar(b, persona);
        login.elegida = persona;
        pantallaLogin();
    }));
    $app.querySelector("[data-volver]")?.addEventListener("click", () => {
        login.elegida = null;
        login.error = "";
        pantallaLogin();
    });
    const formClave = document.getElementById("form-clave");
    formClave?.addEventListener("submit", (e) => {
        e.preventDefault();
        entrar(formClave.querySelector("[type=submit]"), elegida, new FormData(formClave).get("clave"));
    });
}

// ---------- Bienvenida (disclaimer) ----------

const TEXTO_BIENVENIDA = `
    <h2>¿Para qué es esta app? 🧁</h2>
    <p>Esta app es para <strong>organizar el trabajo entre turnos</strong> de forma simple y efectiva. 🍓</p>${datos.modoPrueba ? `
    <p><strong>Es una demo:</strong> probá marcar tareas, dejar una nota de turno o un recordatorio para otra persona.
    Para ver lo que ve la dueña, tocá Salir y entrá como <strong>Carolina</strong>. Todo es inventado y queda solo en este celular.</p>` : ""}`;

function pantallaBienvenida() {
    $app.innerHTML = `
    <main class="bienvenida">
        <div class="bienvenida__tarjeta">
            <img class="bienvenida__logo" src="assets/img/logo.svg" alt="Cremona" onerror="this.remove()">
            <p class="bienvenida__hola">Hola, ${esc(nombre(estado.persona))} 👋</p>
            ${TEXTO_BIENVENIDA}
            <button class="boton boton--grande" id="entendido">Entendido</button>
        </div>
    </main>`;
    document.getElementById("entendido").addEventListener("click", () => {
        localStorage.setItem(`cr-bienvenida-${estado.persona}`, "1");
        estado.vista = esDuena() ? "actividad" : "hoy";
        render();
    });
}

function modalInfo() {
    const fondo = document.createElement("div");
    fondo.className = "modal";
    fondo.innerHTML = `<div class="modal__caja">${TEXTO_BIENVENIDA}<button class="boton">Cerrar</button></div>`;
    fondo.addEventListener("click", (e) => (e.target === fondo || e.target.tagName === "BUTTON") && fondo.remove());
    document.body.appendChild(fondo);
}

// tipo: "" (normal) | "ok" (verde) | "aplazada" (ámbar)
function aviso(texto, tipo = "") {
    document.querySelector(".toast")?.remove();
    const t = document.createElement("div");
    t.className = tipo ? `toast toast--${tipo}` : "toast";
    t.textContent = texto;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ---------- Tema claro / oscuro ----------
// Por defecto sigue al celular; el botón 🌙/☀️ lo fija y se recuerda en este dispositivo.

const temaActual = () =>
    document.documentElement.dataset.tema || (matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro");

function alternarTema() {
    const nuevo = temaActual() === "oscuro" ? "claro" : "oscuro";
    document.documentElement.dataset.tema = nuevo;
    try { localStorage.setItem("cr-tema", nuevo); } catch { /* sin almacenamiento: vale solo para esta visita */ }
    render();
}

// ---------- Navegación (barra de abajo en el celular) ----------

// [vista, ícono (Tabler), texto]
// "Recorda­torios" lleva un guion opcional: si no entra, se parte en dos renglones.
const NAV_EMPLEADA = [["hoy", "sun", "Hoy"], ["turno", "arrows-exchange", "Turno"], ["calendario", "calendar", "Calendario"], ["pedidos", "truck", "Pedidos"], ["notas", "notes", "Notas"], ["recordatorios", "bell", "Recorda­torios"], ["mas", "dots", "Más"]];
const NAV_DUENA = [["actividad", "activity", "Actividad"], ["tareas", "clipboard-plus", "Tareas"], ["calendario", "calendar", "Calendario"], ["notas", "notes", "Notas"], ["mas", "dots", "Más"]];
const MAS_DUENA = [["informes", "chart-bar", "Informes"], ["turno", "arrows-exchange", "Cambio de turno"], ["locales", "building-store", "Locales"], ["glosario", "book", "Glosario"], ["pedidos", "truck", "Pedidos"], ["historialPedidos", "archive", "Pedidos entregados"], ["recordatorios", "bell", "Recordatorios"], ["checklist", "list-check", "Checklist"], ["bloc", "lock", "Mi bloc privado"]];
const MAS_EMPLEADA = [["glosario", "book", "Glosario"], ["locales", "building-store", "Locales"]];
// "Checklist" aparece solo a quien tiene alguno (por ahora, Mica).
// Producción, Stock y Cierre de caja (traídas de Restix) están en js/extras.js.
const menuMas = () => (esDuena() ? [...extras.menuExtras(), ...MAS_DUENA]
    : [...extras.menuExtras(), ...MAS_EMPLEADA, ...(CHECKLISTS.some((c) => c.persona === estado.persona) ? [["checklist", "list-check", "Checklist"]] : [])]);

function irA(vista) {
    estado.vista = vista;
    estado.animar = true;
    render();
    window.scrollTo(0, 0);
}

// ---------- Estructura general ----------

function render() {
    if (!estado.persona || !localStorage.getItem(`cr-bienvenida-${estado.persona}`)) return;
    const nav = esDuena() ? NAV_DUENA : NAV_EMPLEADA;
    // Las pantallas del menú "Más" marcan el botón "Más" como activo.
    const activa = menuMas().some(([id]) => id === estado.vista) ? "mas" : estado.vista;

    const vistas = {
        hoy: vistaHoy, turno: vistaTurno, calendario: vistaCalendario, locales: vistaLocales,
        informes: vistaInformes, tareas: vistaTareas, notas: vistaNotasEquipo, bloc: vistaNotas, glosario: vistaGlosario,
        actividad: vistaActividad, mas: vistaMas, pedidos: vistaPedidos, historialPedidos: vistaHistorialPedidos,
        recordatorios: vistaRecordatorios, checklist: vistaChecklist,
        stock: extras.vistaStock, produccion: extras.vistaProduccion, caja: extras.vistaCaja
    };
    const contenido = (vistas[estado.vista] || vistaHoy)();

    // Conserva el foco y el cursor si se estaba escribiendo (los datos llegan en tiempo real).
    const activo = document.activeElement;
    const foco = activo?.dataset?.foco;
    const cursor = foco ? [activo.selectionStart, activo.selectionEnd] : null;

    $app.innerHTML = `
    <header class="cabecera">
        <button class="cabecera__marca" data-vista="${esDuena() ? "actividad" : "hoy"}" aria-label="Ir al inicio">
            <img class="cabecera__logo" src="assets/img/logo.svg" alt="Cremona" onerror="this.remove()">
            <span>Cremona</span>
        </button>
        <div class="cabecera__acciones">
            <button class="tema" id="btn-tema" aria-label="Cambiar a modo ${temaActual() === "oscuro" ? "claro" : "oscuro"}">
                <span class="tema__opcion ${temaActual() === "claro" ? "is-activa" : ""}">☀️ <span class="tema__texto">Claro</span></span>
                <span class="tema__opcion ${temaActual() === "oscuro" ? "is-activa" : ""}">🌙 <span class="tema__texto">Oscuro</span></span>
            </button>
            <button class="icono" id="btn-info" title="¿Para qué es esta app?">ℹ️</button>
            <div class="usuario" title="Estás usando la app como ${esc(nombre(estado.persona))}">
                <span class="evento__avatar evento__avatar--${estado.persona} usuario__avatar" aria-hidden="true">${esc(nombre(estado.persona).slice(0, 2).toUpperCase())}</span>
                <span class="usuario__nombre">${esc(nombre(estado.persona))}</span>
                <button class="usuario__salir" id="btn-salir" aria-label="Salir"><i class="ti ti-logout" aria-hidden="true"></i><span class="usuario__salir-texto">Salir</span></button>
            </div>
        </div>
    </header>
    ${datos.modoPrueba ? `<div class="aviso aviso--prueba aviso--fino">Demo · datos de prueba (quedan solo en este navegador)
        <button class="aviso__boton" id="btn-borrar-prueba">🧹 Borrar datos de prueba</button></div>` : ""}
    <nav class="nav-app">
        ${nav.map(([id, icono, txt]) => `
        <button class="nav-app__item ${activa === id ? "is-activa" : ""}" data-vista="${id}">
            <i class="ti ti-${icono} nav-app__icono" aria-hidden="true"></i>${txt}
        </button>`).join("")}
    </nav>
    <main class="contenido ${estado.animar ? "entrando" : ""}">${contenido}</main>`;
    estado.animar = false;

    if (foco) {
        const el = $app.querySelector(`[data-foco="${foco}"]`);
        if (el) { el.focus(); if (cursor && el.setSelectionRange) el.setSelectionRange(...cursor); }
    }
    conectarEventos();
}

function conectarEventos() {
    const on = (sel, ev, fn) => $app.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, (e) => fn(el, e)));
    document.getElementById("btn-info").addEventListener("click", modalInfo);
    document.getElementById("btn-tema").addEventListener("click", alternarTema);
    document.getElementById("btn-borrar-prueba")?.addEventListener("click", () => {
        if (!confirm("¿Borrar todas las tareas marcadas, las tareas agregadas y las notas de este navegador?")) return;
        datos.borrarDatosPrueba();
        aviso("Datos de prueba borrados 🧹");
    });
    document.getElementById("btn-salir").addEventListener("click", async () => { await datos.salir(); location.reload(); });

    on("[data-vista]", "click", (el) => irA(el.dataset.vista));
    on("[data-filtro-muro]", "click", (el) => { estado.filtroMuro = el.dataset.filtroMuro; render(); });
    on("[data-marcar]", "click", (el) => marcarTarea(el.dataset.marcar, el));
    on("[data-posponer]", "click", (el) => posponerTarea(el.dataset.posponer, el));
    on("[data-desmarcar]", "click", (el) => desmarcarTarea(el.dataset.desmarcar));
    on("[data-libre]", "click", (el) => marcarLibre(el.dataset.libre, el));
    on("[data-abrir-nota]", "click", (el) => { estado.notaAbierta[el.dataset.abrirNota] = !estado.notaAbierta[el.dataset.abrirNota]; render(); });
    on("[data-marcar-agenda]", "click", (el) => marcarAgenda(el.dataset.marcarAgenda, el));
    on("[data-nota]", "input", (el) => { estado.notas[el.dataset.nota] = el.value; });
    on("[data-mes]", "change", (el) => { estado.mesInforme = el.value; render(); });
    on("[data-cal-mover]", "click", (el) => {
        const m = estado.mesCalendario;
        estado.mesCalendario = new Date(m.getFullYear(), m.getMonth() + Number(el.dataset.calMover), 1);
        estado.diaSeleccionado = null;
        render();
    });
    on("[data-filtro-cal]", "click", (el) => { estado.filtroCal[el.dataset.filtroCal] = el.dataset.valor; render(); });
    on("[data-dia]", "click", (el) => { estado.diaSeleccionado = el.dataset.dia; render(); });

    // Formulario de nueva tarea (Carolina)
    on("[data-campo]", "input", (el) => { estado.formTarea[el.dataset.campo] = el.value; });
    on("[data-campo]", "change", (el) => {
        estado.formTarea[el.dataset.campo] = el.value;
        if (["local", "tipo"].includes(el.dataset.campo)) render();
    });
    on("[data-borrar-tarea]", "click", (el) => borrarTarea(el.dataset.borrarTarea));

    // Notas de cambio de turno
    on("[data-turno-campo]", "input", (el) => { estado.formTurno[el.dataset.turnoCampo] = el.value; });
    on("#form-turno", "submit", (el, e) => { e.preventDefault(); guardarNotaTurno(); });
    on("[data-borrar-turno]", "click", (el) => borrarConConfirmacion("notasTurno", el.dataset.borrarTurno, "¿Borrar esta nota de turno?"));
    on("[data-ir]", "click", (el) => irA(el.dataset.ir));

    // Agenda del calendario (Carolina)
    on("[data-agenda-campo]", "input", (el) => { estado.formAgenda[el.dataset.agendaCampo] = el.value; });
    on("#form-agenda", "submit", (el, e) => { e.preventDefault(); guardarAgenda(estado.vista === "calendario" ? estado.diaSeleccionado : null); });
    on("[data-agenda-campo=local]", "change", () => render());
    on("[data-borrar-agenda]", "click", (el) => borrarConConfirmacion("agenda", el.dataset.borrarAgenda, "¿Quitar esto del calendario?"));

    // Pedidos de clientes
    on("[data-pedido-campo]", "input", (el) => { estado.formPedido[el.dataset.pedidoCampo] = el.value; });
    on("[data-pedido-campo]", "change", (el) => { estado.formPedido[el.dataset.pedidoCampo] = el.value; });
    on("[data-edicion-pedido-campo]", "input", (el) => { estado.edicionPedido[el.dataset.edicionPedidoCampo] = el.value; });
    on("[data-edicion-pedido-campo]", "change", (el) => { estado.edicionPedido[el.dataset.edicionPedidoCampo] = el.value; });
    on("#form-pedido", "submit", (el, e) => { e.preventDefault(); agregarPedido(); });
    on("#form-editar-pedido", "submit", (el, e) => { e.preventDefault(); guardarEdicionPedido(); });
    on("[data-pedido-editar]", "click", (el) => editarPedido(el.dataset.pedidoEditar));
    on("[data-pedido-cancelar]", "click", () => { estado.pedidoEditando = null; render(); });
    on("[data-pedido-borrar]", "click", (el) => borrarPedido(el.dataset.pedidoBorrar));
    on("[data-pedido-estado]", "click", (el) => cambiarEstadoPedido(el.dataset.pedidoEstado, el.dataset.valor));
    on("[data-filtro-pedidos]", "click", (el) => { estado.filtroPedidos = el.dataset.filtroPedidos; render(); });
    on("[data-buscar-pedidos]", "input", (el) => { estado.buscarPedidos = el.value; render(); });
    // "¿Pagó algo?" muestra u oculta el monto de la seña
    on("[data-pedido-campo=pagoEstado], [data-edicion-pedido-campo=pagoEstado]", "change", () => render()); // muestra el monto de la seña o del total
    on("[data-filtro-historial]", "click", (el) => { estado.filtroHistorial = el.dataset.filtroHistorial; render(); });
    on("[data-buscar-historial]", "input", (el) => { estado.buscarHistorial = el.value; render(); });

    // Pedidos del día (Carolina)
    on("[data-pedidos-editar]", "click", (el) => abrirFormPedidos(el.dataset.pedidosEditar));
    on("[data-pedidos-fecha]", "change", (el) => el.value && abrirFormPedidos(el.value));
    on("[data-pedidos-campo]", "input", (el) => { estado.formPedidos[el.dataset.pedidosCampo] = el.value; });
    on("[data-pedidos-cancelar]", "click", () => { estado.formPedidos = null; render(); });
    on("[data-pedidos-restaurar]", "click", () => restaurarPedidos());
    on("#form-pedidos", "submit", (el, e) => { e.preventDefault(); guardarPedidos(); });

    // Glosario: buscador
    on("[data-buscar-glosario]", "input", (el) => { estado.buscarGlosario = el.value; render(); });
    on("[data-modo-glosario]", "click", (el) => { estado.modoGlosario = el.dataset.modoGlosario; estado.animar = true; render(); });

    // Editar notas
    on("[data-editar-nota]", "click", (el) => empezarEdicionNota(el.dataset.editarNota, el.dataset.id));
    on("[data-texto-edicion]", "input", (el) => { estado.editandoNota.texto = el.value; });
    on("[data-cancelar-nota]", "click", () => { estado.editandoNota = null; render(); });
    on("#form-editar-nota", "submit", (el, e) => { e.preventDefault(); guardarEdicionNota(); });

    // Bloc de notas (Carolina)
    on("[data-nota-duena]", "input", (el) => { estado.textoNotaDuena = el.value; });
    on("#form-notas", "submit", (el, e) => { e.preventDefault(); guardarNotaDuena(); });
    on("[data-borrar-nota-duena]", "click", (el) => borrarConConfirmacion("notasDuena", el.dataset.borrarNotaDuena, "¿Borrar esta nota?"));

    // Notas del equipo (data-nq-form = "nueva" | "edicion" dice a qué formulario pertenece cada campo)
    const formNq = (el) => formularioNota(el.closest("[data-nq-form]").dataset.nqForm);
    on("[data-nq-tipo]", "click", (el) => { formNq(el).tipo = el.dataset.nqTipo; render(); });
    on("[data-nq-campo]", "input", (el) => { formNq(el)[el.dataset.nqCampo] = el.value; });
    on("[data-nq-campo=duracion]", "change", () => render());
    on("[data-nq-item]", "input", (el) => { formNq(el).items[el.dataset.nqItem].texto = el.value; });
    // Enter en un ítem agrega otro abajo (como en cualquier lista del celular)
    on("[data-nq-item]", "keydown", (el, e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        agregarItemForm(el.closest("[data-nq-form]").dataset.nqForm, Number(el.dataset.nqItem) + 1);
    });
    on("[data-nq-agregar-item]", "click", (el) => agregarItemForm(el.closest("[data-nq-form]").dataset.nqForm));
    on("[data-nq-quitar-item]", "click", (el) => { formNq(el).items.splice(Number(el.dataset.nqQuitarItem), 1); render(); });
    on("#form-nota-equipo", "submit", (el, e) => { e.preventDefault(); agregarNotaEquipo(); });
    on("#form-editar-nota-equipo", "submit", (el, e) => { e.preventDefault(); guardarEdicionNotaEquipo(); });
    on("[data-nq-editar]", "click", (el) => editarNotaEquipo(el.dataset.nqEditar));
    on("[data-nq-cancelar]", "click", () => { estado.edicionNotaEquipo = null; render(); });
    on("[data-nq-borrar]", "click", (el) => borrarNotaEquipo(el.dataset.nqBorrar));
    on("[data-nq-tildar]", "click", (el) => tildarItem(el.dataset.nqTildar, el.dataset.item));

    // Recordatorios (data-rec-form = "nuevo" | "edicion")
    const formRec = (el) => formularioRec(el.closest("[data-rec-form]").dataset.recForm);
    on("[data-rec-campo]", "input", (el) => { formRec(el)[el.dataset.recCampo] = el.value; });
    on("[data-rec-campo=duracion]", "change", (el) => { formRec(el).duracion = el.value; render(); });
    on("[data-rec-campo=fecha]", "change", (el) => { formRec(el).fecha = el.value; });
    on("#form-recordatorio", "submit", (el, e) => { e.preventDefault(); agregarRecordatorio(); });
    on("#form-editar-recordatorio", "submit", (el, e) => { e.preventDefault(); guardarEdicionRecordatorio(); });
    on("[data-rec-editar]", "click", (el) => editarRecordatorio(el.dataset.recEditar));
    on("[data-rec-cancelar]", "click", () => { estado.edicionRecordatorio = null; render(); });
    on("[data-rec-borrar]", "click", (el) => borrarRecordatorio(el.dataset.recBorrar));

    // Checklists
    on("[data-check-tildar]", "click", (el) => tildarChecklist(el.dataset.checkTildar, el.dataset.item));
    on("[data-check-fecha]", "change", (el) => { estado.fechaChecklist = el.value || null; render(); });

    // Producción, Stock y Cierre de caja (js/extras.js)
    extras.conectarExtras(on);
}

// ---------- Acciones sobre tareas ----------

let asignacionesVisibles = {}; // id -> asignación renderizada

function datosBase(a, hoy) {
    return {
        tareaId: a.tarea.id, local: a.tarea.local, persona: estado.persona, asignadaA: a.persona,
        asignacionId: a.id, fecha: cal.iso(hoy), cuando: hoy.toISOString(),
        turno: cal.turnoActual(a.tarea.local, hoy), nota: (estado.notas[a.id] || "").trim()
    };
}

function limpiarNota(id) {
    delete estado.notas[id];
    delete estado.notaAbierta[id];
}

async function marcarTarea(id, boton) {
    const a = asignacionesVisibles[id];
    if (!a) return;
    boton.disabled = true;
    const datosReg = datosBase(a, cal.ahora());
    limpiarNota(id);
    estado.recien = id;
    setTimeout(() => { if (estado.recien === id) estado.recien = null; }, 1500);
    await datos.marcar({ id, tipo: "hecha", ...datosReg });
    aviso("¡Listo! Tarea registrada ✓", "ok");
}

// "No lo hice": pasa al próximo día hábil (con la nota, si escribió una).
async function posponerTarea(id, boton) {
    const a = asignacionesVisibles[id];
    if (!a) return;
    boton.disabled = true;
    const hoy = cal.ahora();
    const manana = cal.proximoDiaHabil(hoy);
    const datosReg = datosBase(a, hoy);
    limpiarNota(id);
    await datos.marcar({ id: `${id}_pos`, tipo: "pospuesta", paraFecha: cal.iso(manana), ...datosReg });
    aviso(`Tarea aplazada para el ${cal.fechaLarga(manana)}`, "aplazada");
}

async function desmarcarTarea(id) {
    if (confirm("¿Desmarcar esta tarea?")) await datos.desmarcar(id);
}

async function marcarLibre(tareaId, boton) {
    const t = cal.todasLasTareas().find((x) => x.id === tareaId);
    boton.disabled = true;
    const hoy = cal.ahora();
    await datos.marcar({
        id: `${tareaId}_${cal.iso(hoy)}`, tipo: "hecha", tareaId, local: t.local, persona: estado.persona,
        asignadaA: null, fecha: cal.iso(hoy), cuando: hoy.toISOString(), turno: cal.turnoActual(t.local, hoy), nota: ""
    });
}

// ---------- Estado de una asignación ----------
// "hecha" | "pospuesta" (pasada para un día futuro) | "de-ayer" (se pospuso y ya llegó el día) | "pendiente"

function estadoDe(a) {
    const r = estado.registros[a.id];
    if (r) return { tipo: "hecha", r };
    const p = estado.registros[`${a.id}_pos`];
    if (p) return { tipo: p.paraFecha > cal.iso(cal.ahora()) ? "pospuesta" : "de-ayer", p };
    return { tipo: "pendiente" };
}

// ---------- Tarjeta de tarea ----------

// Tarea en formato lista: círculo para tildar ("Lo hice"), nombre y, a la derecha,
// 📝 nota, "No lo hice" o "Deshacer". Hecha = verde y tachada; pasada a otro día = ámbar.
// Si no se toca nada, sigue pendiente toda la semana y después aparece como "Quedó de la semana pasada".
function tarjetaTarea(a, { mostrarPersona = false, mostrarLocal = true, atrasada = false, permitirNo = true, tablero = false } = {}) {
    asignacionesVisibles[a.id] = a;
    const { tipo, r, p } = estadoDe(a);
    const hoy = cal.ahora();
    const esHoyLunes = a.lunes && cal.iso(a.lunes) === cal.iso(hoy);
    const propio = (reg) => esMio(reg);

    let etiqueta = a.periodo;
    if (a.lunes) etiqueta = esHoyLunes ? "☕ Hoy" : `☕ Lunes ${a.lunes.getDate()}`;

    let detalle = `hasta el ${cal.nombreDia(a.hasta).slice(0, 3)} ${a.hasta.getDate()}`;
    if (atrasada) detalle = "quedó pendiente";
    if (tipo === "hecha") detalle = `hecha ${diaCorto(r.cuando)} ${hora(r.cuando)}${r.persona !== estado.persona ? ` por ${esc(nombre(r.persona))}` : ""}`;
    if (tipo === "pospuesta") detalle = `pasada para el ${cal.fechaLarga(cal.desdeIso(p.paraFecha))}`;
    if (tipo === "de-ayer") detalle = `quedó del ${diaCorto(p.cuando)}`;
    const notaGuardada = (r || p)?.nota;

    const clases = ["tarea"];
    if (tipo === "hecha") clases.push("is-hecha");
    if (tipo === "hecha" && estado.recien === a.id) clases.push("is-recien");
    else if (tipo === "pospuesta" || tipo === "de-ayer") clases.push("is-pospuesta");
    else if (atrasada) clases.push("is-atrasada");
    if (esHoyLunes && tipo !== "hecha") clases.push("is-hoy");

    const pendiente = tipo !== "hecha" && tipo !== "pospuesta";
    const conNota = estado.notaAbierta[a.id];

    // Izquierda: círculo (tildar si está pendiente; estado si no). En el tablero de Locales solo muestra el estado.
    let check = tablero
        ? `<span class="check is-vacio" aria-label="Pendiente"></span>`
        : `<button class="check" data-marcar="${a.id}" aria-label="Lo hice"></button>`;
    if (tipo === "hecha") check = `<span class="check is-ok" aria-label="Hecha"><i class="ti ti-check" aria-hidden="true"></i></span>`;
    if (tipo === "pospuesta") check = `<span class="check is-pos" aria-label="Pasada a otro día"><i class="ti ti-player-skip-forward" aria-hidden="true"></i></span>`;

    // Derecha: una sola acción
    let accion = "";
    const esMia = a.persona === estado.persona;
    if (tablero) {
        // Locales es solo para mirar: ningún botón.
        if (esMia && pendiente) accion = `<span class="chip chip--tuya">Tuya</span>`;
    } else if (pendiente) {
        accion = `
            <button class="tarea__icono ${conNota ? "is-activo" : ""}" data-abrir-nota="${a.id}" aria-label="Agregar nota">📝</button>
            ${permitirNo ? `<button class="pildora pildora--no" data-posponer="${a.id}">No lo hice</button>` : ""}`;
    } else if (tipo === "hecha" && propio(r) && !esDuena()) {
        accion = `<button class="pildora" data-desmarcar="${a.id}">Deshacer</button>`;
    } else if (tipo === "pospuesta" && propio(p)) {
        accion = `<button class="pildora" data-desmarcar="${a.id}_pos">Deshacer</button>`;
    }

    return `
    <article class="${clases.join(" ")}">
        <div class="tarea__fila">
            ${check}
            <div class="tarea__info">
                <h3 class="tarea__nombre">${esc(a.tarea.nombre)}</h3>
                <p class="tarea__detalle">
                    ${mostrarLocal ? `<span class="chip chip--${a.tarea.local}">${LOCALES[a.tarea.local].nombre}</span>` : ""}
                    ${mostrarPersona ? `<span class="chip chip--persona">${esc(nombre(a.persona))}</span>` : ""}
                    <span>${esc(etiqueta)} · ${detalle}</span>
                </p>
                ${notaGuardada ? `<p class="tarea__nota">📝 ${esc(notaGuardada)}</p>` : ""}
            </div>
            <div class="tarea__acciones">${accion}</div>
        </div>
        ${pendiente && conNota ? `
        <textarea class="tarea__campo-nota" rows="2" maxlength="300" data-nota="${a.id}" data-foco="nota-${a.id}"
            placeholder="Nota opcional: se guarda al tocar el círculo o &quot;No lo hice&quot;">${esc(estado.notas[a.id] || "")}</textarea>` : ""}
    </article>`;
}

// ---------- Encabezado "Hoy es…" ----------

// Anillo que se llena según las tareas hechas de la semana.
function anillo(hechas, total) {
    const r = 30;
    const largo = 2 * Math.PI * r;
    const resto = largo * (1 - (total ? hechas / total : 0));
    return `
    <svg class="anillo" viewBox="0 0 72 72" role="img" aria-label="${hechas} de ${total} tareas hechas">
        <circle class="anillo__fondo" cx="36" cy="36" r="${r}"/>
        <circle class="anillo__relleno" cx="36" cy="36" r="${r}" style="--largo:${largo.toFixed(1)};--resto:${resto.toFixed(1)}"/>
        <text x="36" y="41" text-anchor="middle">${hechas}/${total}</text>
    </svg>`;
}

function heroHoy({ hechas = 0, total = 0, extra = "" } = {}) {
    const hoy = cal.ahora();
    const b = cal.bloqueDe(hoy);
    const domingo = hoy.getDay() === 0;
    const donde = !esDuena() && !domingo ? cal.dondeEsta(estado.persona, hoy) : null;
    const lunes = hoy.getDay() === 1;
    const pct = total ? Math.round((hechas / total) * 100) : 0;
    const mes = cal.nombreMes(hoy.getMonth());

    return `
    <section class="hoy">
        <p class="hoy__saludo">Hola, ${esc(nombre(estado.persona))} 👋</p>
        <div class="hoy__fecha">
            <span class="hoy__numero">${hoy.getDate()}</span>
            <div class="hoy__textos">
                <span class="hoy__dia">${cal.nombreDia(hoy)}</span>
                <span class="hoy__mes">${mes} ${hoy.getFullYear()}</span>
            </div>
        </div>
        <div class="hoy__chips">
            <span class="hoy__chip">📅 Semana ${b.semana} del mes</span>
            ${domingo ? `<span class="hoy__chip">😴 Hoy los locales están cerrados</span>` : ""}
            ${donde ? `<span class="hoy__chip">🏪 ${LOCALES[donde.local].nombre} · turno ${nombreTurno(donde.turno)}</span>` : ""}
            ${lunes ? `<span class="hoy__chip">☕ Hoy es día de cafetera</span>` : ""}
            ${extra}
        </div>
        ${total ? `
        <div class="hoy__progreso">
            ${anillo(hechas, total)}
            <p>${hechas} de ${total} tareas de esta semana ${pct === 100 ? "· ¡completo! 🎉" : ""}</p>
        </div>` : ""}
    </section>`;
}

// ---------- Vista: Mis tareas ----------

// Encabezado compacto de "Hoy": dónde está, saludo y anillo de progreso.
function cabeceraHoy(hechas, total) {
    const hoy = cal.ahora();
    const b = cal.bloqueDe(hoy);
    const donde = hoy.getDay() !== 0 ? cal.dondeEsta(estado.persona, hoy) : null;
    return `
    <section class="saludo">
        <div class="saludo__textos">
            <p class="saludo__donde">${PERSONAS[estado.persona]?.puesto ? `${esc(PERSONAS[estado.persona].puesto.replace(/^./, (l) => l.toUpperCase()))} · ` : ""}${donde ? `${LOCALES[donde.local].nombre} · turno ${nombreTurno(donde.turno)}` : "Hoy los locales están cerrados"}</p>
            <h1 class="saludo__hola">Hola, ${esc(nombre(estado.persona))}</h1>
        </div>
        <div class="saludo__fecha saludo__fecha--s${b.semana}">
            <span class="saludo__dia">${cal.nombreDia(hoy)} ${hoy.getDate()}</span>
            <span class="saludo__mes">
                de ${cal.nombreMes(hoy.getMonth())} · <span class="sigla-semana sigla-semana--s${b.semana}">S${b.semana}</span>${hoy.getDay() === 1 ? " · ☕ día de cafetera" : ""}
            </span>
        </div>
        ${total ? anillo(hechas, total) : ""}
    </section>`;
}

// "Hoy" de la empleada: novedades arriba y la lista de tareas.
function vistaHoy() {
    asignacionesVisibles = {};
    const hoy = cal.ahora();
    const hoyIso = cal.iso(hoy);
    const yo = estado.persona;
    const tipo = (a) => estadoDe(a).tipo;
    const mias = cal.asignacionesActuales(hoy).filter((a) => a.persona === yo);
    const anteriores = cal.asignacionesAnteriores(hoy).filter((a) => a.persona === yo && tipo(a) !== "hecha");

    const deAyer = [...anteriores, ...mias].filter((a) => tipo(a) === "de-ayer");
    const atrasadas = anteriores.filter((a) => tipo(a) === "pendiente");
    const pendientes = mias.filter((a) => tipo(a) === "pendiente");
    const pospuestas = [...anteriores, ...mias].filter((a) => tipo(a) === "pospuesta");
    const hechas = mias.filter((a) => tipo(a) === "hecha");

    // Arriba: tareas puntuales de Carolina (las de hoy y las que quedaron sin hacer)
    // y las notas del turno anterior de su local.
    const hace7 = cal.iso(cal.sumarDias(hoy, -7));
    // Tareas de Carolina: las que quedaron sin hacer (últimos 7 días), las de hoy y las próximas 7 días.
    const en7 = cal.iso(cal.sumarDias(hoy, 7));
    const agendaHoy = estado.agenda
        .filter((a) => agendaPara(a, yo) && a.fecha >= hace7 && a.fecha <= en7)
        .filter((a) => !registroAgenda(a) || registroAgenda(a).fecha === hoyIso)
        .sort((x, y) => x.fecha.localeCompare(y.fecha));
    const donde = cal.dondeEsta(yo, hoy);
    const notasTurno = estado.notasTurno
        .filter((n) => donde && n.local === donde.local && n.persona !== yo && cal.diasEntre(new Date(n.cuando), hoy) <= 1)
        .sort(masNuevoPrimero).slice(0, 2);
    const porHacer = deAyer.length + atrasadas.length + pendientes.length;


    const grupo = (titulo, lista, opts = {}) => lista.length ? `
    <div class="bloque">
        ${titulo ? `<h3 class="bloque__titulo">${titulo}</h3>` : ""}
        ${lista.map((a) => tarjetaTarea(a, opts)).join("")}
    </div>` : "";

    return `
    ${cabeceraHoy(hechas.length, mias.length)}
    ${agendaHoy.length ? `
    <section class="momento">
        <h2 class="momento__titulo">📌 Tareas de Carolina</h2>
        ${agendaHoy.map((a) => tarjetaAgenda(a, { marcable: true, mostrarFecha: false })).join("")}
    </section>` : ""}
    ${notasTurno.length ? `
    <section class="momento">
        <h2 class="momento__titulo">🔄 Del turno anterior</h2>
        ${notasTurno.map((n) => tarjetaNotaTurno(n)).join("")}
    </section>` : ""}
    ${checklistsHoy()}
    ${extras.avisosExtrasHoy()}
    <section class="momento">
        <h2 class="momento__titulo">Tareas de hoy${porHacer ? ` · ${porHacer} por hacer` : ""}</h2>
        ${grupo("⏭️ Quedó de ayer", deAyer)}
        ${grupo("⚠️ Quedó de la semana pasada", atrasadas, { atrasada: true })}
        ${pendientes.length ? grupo("", pendientes) : porHacer ? "" : `<p class="momento__vacio momento__vacio--ok">🎉 ¡Todo listo por ahora!</p>`}
        ${grupo("Pasadas para otro día", pospuestas)}
        ${grupo("Hechas", hechas)}
    </section>
    ${avisoPedidosHoy(hoy)}
    ${recordatoriosHoy()}
    ${notasEquipoHoy()}
    <button class="boton boton--suave boton--grande" data-ir="turno">🔄 Dejar nota de turno</button>`;
}

// ---------- Vista: Calendario ----------

// ---------- Filtros del calendario ----------
// Local: todos | centro | plaza.  Estado: todas | hechas | por-hacer | no-hechas.
// "No hechas" = de semanas que ya terminaron sin tildar, o pasadas a otro día.

const FILTRO_ESTADOS = [["todas", "Todas"], ["hechas", "✅ Hechas"], ["por-hacer", "⏳ Por hacer"], ["no-hechas", "❌ No hechas"]];

// Estado de una tarea fija en términos del filtro.
function estadoFiltro(a) {
    const t = estadoDe(a).tipo;
    if (t === "hecha") return "hechas";
    if (t === "pospuesta" || t === "de-ayer") return "no-hechas";
    return cal.iso(a.hasta) < cal.iso(cal.ahora()) ? "no-hechas" : "por-hacer";
}

// Estado de una tarea puntual de Carolina en términos del filtro.
const estadoFiltroAgenda = (a) =>
    registroAgenda(a) ? "hechas" : a.fecha < cal.iso(cal.ahora()) ? "no-hechas" : "por-hacer";

const pasaLocal = (local) => estado.filtroCal.local === "todos" || local === estado.filtroCal.local;
const pasaEstado = (e) => estado.filtroCal.estado === "todas" || e === estado.filtroCal.estado;
// Registro (tarea hecha o pasada) visible con el filtro actual
const registroPasaFiltro = (r) => pasaLocal(r.local)
    && pasaEstado(r.tipo === "hecha" ? "hechas" : "no-hechas");

function barraFiltrosCalendario() {
    const f = estado.filtroCal;
    const locales = [["todos", "Todos"], ...Object.entries(LOCALES).map(([id, l]) => [id, l.nombre])];
    return `
    <div class="filtros-cal">
        <div class="filtros">
            <span class="filtros__titulo"><i class="ti ti-building-store" aria-hidden="true"></i> Local</span>
            ${locales.map(([id, txt]) => `<button class="filtros__item ${f.local === id ? "is-activo" : ""}" data-filtro-cal="local" data-valor="${id}">${txt}</button>`).join("")}
        </div>
        <div class="filtros">
            <span class="filtros__titulo"><i class="ti ti-filter" aria-hidden="true"></i> Estado</span>
            ${FILTRO_ESTADOS.map(([id, txt]) => `<button class="filtros__item ${f.estado === id ? "is-activo" : ""}" data-filtro-cal="estado" data-valor="${id}">${txt}</button>`).join("")}
        </div>
    </div>`;
}

// Lista del mes con los filtros aplicados, agrupada por semana.
function listaFiltradaMes(anio, mes, soloMio) {
    const yo = estado.persona;
    const iconos = { hechas: "✅", "por-hacer": "⏳", "no-hechas": "❌" };
    const grupos = [1, 2, 3, 4].map((s) => {
        const b = cal.bloque(anio, mes, s);
        const fijas = cal.asignacionesDelBloque(b)
            .filter((a) => cal.despuesDelInicio(a) && (!soloMio || a.persona === yo) && pasaLocal(a.tarea.local))
            .map((a) => ({ nombre: a.tarea.nombre, local: a.tarea.local, persona: a.persona, estado: estadoFiltro(a), extra: a.lunes ? `☕ lunes ${a.lunes.getDate()}` : "" }));
        const puntuales = estado.agenda
            .filter((a) => {
                const d = cal.desdeIso(a.fecha);
                return d >= b.inicio && d <= b.fin && (!soloMio || agendaPara(a, yo)) && pasaLocal(a.local);
            })
            .map((a) => ({ nombre: a.texto, local: a.local, persona: a.para, estado: estadoFiltroAgenda(a), extra: `📌 ${cal.desdeIso(a.fecha).getDate()}/${mes + 1}` }));
        const items = [...fijas, ...puntuales].filter((x) => pasaEstado(x.estado));
        return { s, b, items };
    });
    const total = grupos.reduce((n, g) => n + g.items.length, 0);

    return `
    <section class="bloque lista-cal">
        <h2 class="bloque__titulo">${soloMio ? "Tus tareas" : "Tareas"} de ${cal.nombreMes(mes)}<span class="bloque__meta">${total} con este filtro</span></h2>
        ${grupos.map(({ s, b, items }) => items.length ? `
        <div class="lista-cal__semana">
            <h3><span class="sigla-semana sigla-semana--s${s}">S${s}</span> del ${b.inicio.getDate()} al ${b.fin.getDate()}</h3>
            <ul>
                ${items.map((x) => `
                <li class="lista-cal__item lista-cal__item--${x.estado}">
                    <span aria-hidden="true">${iconos[x.estado]}</span>
                    <span class="lista-cal__nombre">${esc(x.nombre)}</span>
                    ${x.extra ? `<small>${x.extra}</small>` : ""}
                    ${x.local ? `<span class="chip chip--${x.local}">${LOCALES[x.local].nombre}</span>` : ""}
                    ${soloMio ? "" : `<span class="persona persona--${x.persona}">${esc(paraQuien(x.persona))}</span>`}
                </li>`).join("")}
            </ul>
        </div>` : "").join("")}
        ${total ? "" : `<p class="vacio">No hay tareas con este filtro.</p>`}
    </section>`;
}

// Calendario compacto: grilla del mes con cada día en el color de su semana (S1 a S4).
function vistaCalendario() {
    const hoy = cal.ahora();
    if (!estado.mesCalendario) estado.mesCalendario = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const m = estado.mesCalendario;
    const anio = m.getFullYear(), mes = m.getMonth();
    const yo = estado.persona;
    const soloMio = !esDuena();

    // Registros por día (de la persona, o de todas si es Carolina)
    const porDia = {};
    for (const r of Object.values(estado.registros)) {
        if (soloMio && r.persona !== yo) continue;
        if (!registroPasaFiltro(r)) continue;
        (porDia[r.fecha] ||= []).push(r);
    }

    const celdaDia = (fecha) => {
        const f = cal.iso(fecha);
        const regs = porDia[f] || [];
        const hechas = regs.filter((r) => r.tipo === "hecha").length;
        const pos = regs.filter((r) => r.tipo === "pospuesta").length;
        const miCafetera = fecha.getDay() === 1 && cal.asignacionesDelBloque(cal.bloqueDe(fecha))
            .some((a) => a.lunes && cal.iso(a.lunes) === f && (!soloMio || a.persona === yo));
        const agendado = agendaDe(f, soloMio ? yo : null).filter((a) => pasaLocal(a.local) && pasaEstado(estadoFiltroAgenda(a))).length;
        const clases = ["dia", `dia--s${cal.semanaDelMes(fecha)}`];
        if (fecha.getDay() === 0) clases.push("is-domingo");
        if (f === cal.iso(hoy)) clases.push("is-hoy");
        if (f === estado.diaSeleccionado) clases.push("is-seleccionado");
        return `
        <button class="${clases.join(" ")}" data-dia="${f}" aria-label="${cal.fechaLarga(fecha)}">
            <span class="dia__numero">${fecha.getDate()}</span>
            <span class="dia__marcas">
                ${miCafetera ? `<span title="Día de limpieza de la cafetera">☕</span>` : ""}
                ${agendado ? `<span title="Agenda">📌</span>` : ""}
                ${hechas ? `<span class="punto punto--ok">${hechas}</span>` : ""}
                ${pos ? `<span class="punto punto--pos">${pos}</span>` : ""}
            </span>
        </button>`;
    };

    const claveHoy = cal.bloqueDe(hoy).clave;
    const etiquetasSemanas = [1, 2, 3, 4].map((s) => {
        const b = cal.bloque(anio, mes, s);
        const asigs = cal.asignacionesDelBloque(b).filter((a) => cal.despuesDelInicio(a) && (!soloMio || a.persona === yo) && pasaLocal(a.tarea.local));
        const hechasSemana = asigs.filter((a) => estadoDe(a).tipo === "hecha").length;
        return `
        <span class="calendario__semana ${b.clave === claveHoy ? "is-actual" : ""}" title="${soloMio ? "Tus tareas de esa semana" : "Tareas de esa semana"}">
            <span class="sigla-semana sigla-semana--s${s}">S${s}</span>${b.inicio.getDate()}–${b.fin.getDate()}${asigs.length ? ` · ${hechasSemana}/${asigs.length} ✓` : ""}
        </span>`;
    }).join("");

    // Grilla del mes: arranca en lunes; los huecos del principio quedan vacíos.
    const celdas = [];
    const ultimo = new Date(anio, mes + 1, 0).getDate();
    const huecos = (new Date(anio, mes, 1).getDay() + 6) % 7;
    for (let i = 0; i < huecos; i++) celdas.push(`<span class="dia is-vacio"></span>`);
    for (let d = 1; d <= ultimo; d++) celdas.push(celdaDia(new Date(anio, mes, d)));

    // Filtros al costado (en el celular, pegados arriba) y el calendario al lado.
    return `
    <div class="cal-layout">
    <aside class="cal-layout__filtros">${barraFiltrosCalendario()}</aside>
    <div class="cal-layout__principal">
    <section class="calendario">
        <div class="calendario__cabecera">
            <button class="icono" data-cal-mover="-1" aria-label="Mes anterior">‹</button>
            <h2>${cal.nombreMes(mes)} ${anio}</h2>
            <button class="icono" data-cal-mover="1" aria-label="Mes siguiente">›</button>
        </div>
        <div class="calendario__semanas">${etiquetasSemanas}</div>
        <div class="calendario__grilla">
            ${["L", "M", "M", "J", "V", "S", "D"].map((x) => `<span class="calendario__nombre">${x}</span>`).join("")}
            ${celdas.join("")}
        </div>
        <div class="calendario__leyenda">
            <span><span class="punto punto--ok">n</span> ${soloMio ? "hiciste" : "hechas"}</span>
            <span><span class="punto punto--pos">n</span> pasadas a otro día</span>
            <span>☕ ${soloMio ? "te toca la cafetera" : "Limpieza de cafetera"}</span>
            <span>📌 ${soloMio ? "algo agendado para vos" : "agenda"}</span>
        </div>
    </section>
    ${estado.diaSeleccionado ? detalleDia(cal.desdeIso(estado.diaSeleccionado)) : `<p class="vacio">Tocá un día para ver el detalle.</p>`}
    ${listaFiltradaMes(anio, mes, soloMio)}
    </div>
    </div>`;
}

function detalleDia(fecha) {
    asignacionesVisibles = {};
    const f = cal.iso(fecha);
    const yo = estado.persona;
    const soloMio = !esDuena();
    const b = cal.bloqueDe(fecha);
    const regs = Object.values(estado.registros).filter((r) => r.fecha === f && (!soloMio || r.persona === yo) && registroPasaFiltro(r));
    const semana = cal.asignacionesDelBloque(b).filter((a) => cal.despuesDelInicio(a) && (!soloMio || a.persona === yo) && !a.lunes
        && pasaLocal(a.tarea.local) && pasaEstado(estadoFiltro(a)));
    const cafeteraDelDia = cal.asignacionesDelBloque(b).filter((a) => a.lunes && cal.iso(a.lunes) === f && (!soloMio || a.persona === yo));
    const nombreTarea = nombreDeTarea;
    const icono = (a) => ({ hecha: "✅", pospuesta: "⏭️", "de-ayer": "⏭️", pendiente: "⬜" }[estadoDe(a).tipo]);
    const agendaDia = agendaDe(f, soloMio ? yo : null);

    return `
    <section class="bloque detalle-dia">
        <h2 class="bloque__titulo">${cal.fechaLarga(fecha)}<span class="bloque__meta">Semana ${b.semana}</span></h2>
        ${fecha.getDay() === 0 ? `<p class="vacio">Domingo: los locales están cerrados.</p>` : ""}
        ${agendaDia.length || esDuena() ? `
        <div class="detalle-dia__grupo">
            <h3>📌 Agenda</h3>
            ${agendaDia.length ? agendaDia.map((a) => tarjetaAgenda(a, { borrable: esDuena(), mostrarFecha: false })).join("") : `<p class="vacio">Nada agendado.</p>`}
            ${esDuena() ? formTareaPuntual({ conFecha: false, compacto: true }) : ""}
        </div>` : ""}
        ${cafeteraDelDia.length ? `<div class="detalle-dia__grupo"><h3>☕ Limpieza de cafetera</h3><ul>${cafeteraDelDia.map((a) =>
            `<li>${icono(a)} ${LOCALES[a.tarea.local].nombre} · ${esc(nombre(a.persona))}</li>`).join("")}</ul></div>` : ""}
        <div class="detalle-dia__grupo">
            <h3>Ese día se registró</h3>
            ${regs.length ? `<ul>${regs.map((r) => `
                <li>${r.tipo === "hecha" ? "✅" : "⏭️"} ${esc(nombreTarea(r.tareaId))}
                    <small>${LOCALES[r.local]?.nombre} · ${hora(r.cuando)}${soloMio ? "" : ` · ${esc(nombre(r.persona))}`}${r.tipo === "pospuesta" ? ` · pasada al ${cal.fechaLarga(cal.desdeIso(r.paraFecha))}` : ""}</small>
                    ${r.nota ? `<small class="detalle-dia__nota">📝 ${esc(r.nota)}</small>` : ""}
                </li>`).join("")}</ul>` : `<p class="vacio">Nada registrado.</p>`}
        </div>
        <div class="detalle-dia__grupo">
            <h3>${soloMio ? "Tus tareas de esa semana" : "Tareas de esa semana"}</h3>
            ${semana.length ? `<ul>${semana.map((a) => `
                <li>${icono(a)} ${esc(a.tarea.nombre)}
                    <small>${LOCALES[a.tarea.local].nombre}${soloMio ? "" : ` · ${esc(nombre(a.persona))}`}</small></li>`).join("")}</ul>`
                : `<p class="vacio">Sin tareas asignadas.</p>`}
        </div>
    </section>`;
}

// ---------- Vista: Locales (tablero de la semana, cualquiera puede cubrir) ----------

function vistaLocales() {
    asignacionesVisibles = {};
    const hoy = cal.ahora();
    const b = cal.bloqueDe(hoy);
    const actuales = cal.asignacionesActuales(hoy);

    return `
    <section class="encabezado">
        <h1>Locales</h1>
        <p>Semana ${b.semana} del mes · del ${b.inicio.getDate()} al ${b.fin.getDate()} de ${cal.nombreMes(b.mes)}</p>
        <p>${esDuena() ? "Cómo va cada local esta semana." : "Cómo va cada local esta semana. Es solo para mirar: tus tareas se tildan en Hoy."}</p>
    </section>
    <div class="locales">
    ${Object.entries(LOCALES).map(([id, l]) => {
        const orden = { "de-ayer": 0, pendiente: 0, pospuesta: 1, hecha: 2 };
        const lista = actuales.filter((a) => a.tarea.local === id)
            .sort((x, y) => orden[estadoDe(x).tipo] - orden[estadoDe(y).tipo]);
        const faltan = lista.filter((a) => estadoDe(a).tipo !== "hecha").length;
        const turno = cal.turnoActual(id, hoy);
        const libres = cal.tareasLibres().filter((t) => t.local === id);
        return `
        <section class="local local--${id}">
            <header class="local__cabecera">
                <h2>🏪 ${l.nombre}</h2>
                <p>${faltan ? `${faltan} pendiente${faltan > 1 ? "s" : ""}` : "al día ✓"} · ahora: turno ${nombreTurno(turno)} (${esc(nombre(l.turnos[turno]))})</p>
            </header>
            <div class="local__cuerpo">
                ${lista.map((a) => tarjetaTarea(a, { mostrarPersona: true, mostrarLocal: false, tablero: true })).join("")}
                ${libres.map(tarjetaLibre).join("")}
            </div>
        </section>`;
    }).join("")}
    </div>`;
}

function tarjetaLibre(t) {
    const hechos = Object.values(estado.registros).filter((r) => r.tareaId === t.id && r.tipo !== "pospuesta").sort((a, b) => b.cuando.localeCompare(a.cuando));
    const ultimo = hechos[0];
    const hoy = cal.ahora();
    const dias = ultimo ? cal.diasEntre(new Date(ultimo.cuando), hoy) : null;
    const vencida = dias === null || dias >= t.cadaDias;
    const hechaHoy = ultimo && ultimo.fecha === cal.iso(hoy);
    return `
    <article class="tarea ${vencida ? "is-atrasada" : "is-hecha"}">
        <div class="tarea__info">
            <div class="tarea__chips"><span class="chip">Cada ~${t.cadaDias} días</span><span class="chip chip--persona">Sin asignar</span></div>
            <h3 class="tarea__nombre">${esc(t.nombre)}</h3>
            <p class="tarea__detalle">${ultimo ? `Última vez: hace ${dias} día${dias === 1 ? "" : "s"} (${esc(nombre(ultimo.persona))})` : "Todavía no se registró"}</p>
        </div>
        ${hechaHoy ? "" : `<div class="tarea__botones"><button class="boton ${vencida ? "" : "boton--suave"}" data-libre="${t.id}">Lo hice ✓</button></div>`}
    </article>`;
}

// ---------- Vista: Informes (Carolina) ----------

function vistaInformes() {
    const hoy = cal.ahora();
    const meses = [];
    for (let i = 0; i < 4; i++) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        meses.push(`${d.getFullYear()}-${d.getMonth()}`);
    }
    const sel = estado.mesInforme || meses[0];
    const [anio, mes] = sel.split("-").map(Number);
    const bloques = [1, 2, 3, 4].map((s) => cal.bloque(anio, mes, s));

    const pendientesAhora = Object.keys(LOCALES).map((id) => {
        const n = cal.asignacionesActuales(hoy).filter((a) => a.tarea.local === id && estadoDe(a).tipo !== "hecha").length;
        return `<span class="hoy__chip">🏪 ${LOCALES[id].nombre}: ${n ? `${n} pendiente${n > 1 ? "s" : ""}` : "al día ✓"}</span>`;
    }).join("");

    const tablas = Object.entries(LOCALES).map(([id, l]) => {
        let total = 0, hechas = 0;
        const filas = cal.todasLasTareas().filter((t) => t.local === id && t.tipo !== "libre").map((t) => {
            const celdas = bloques.map((b) => {
                const asigs = cal.asignacionesDelBloque(b).filter((a) => a.tarea.id === t.id && cal.despuesDelInicio(a));
                if (!asigs.length) return `<td class="celda celda--vacia">—</td>`;
                return `<td class="celda">${asigs.map((a) => {
                    const { r, p } = estadoDe(a);
                    const futura = cal.iso(a.desde) > cal.iso(hoy);
                    const vencida = !r && cal.iso(a.hasta) < cal.iso(hoy);
                    if (!futura) { total++; if (r) hechas++; }
                    let clase = r ? "ok" : futura ? "futura" : vencida ? "falta" : "curso";
                    let titulo = r ? `Hecha el ${diaCorto(r.cuando)} por ${nombre(r.persona)}` : futura ? "Todavía no empezó" : vencida ? "No se registró" : "En curso";
                    if (!r && p) { clase = "pospuesta"; titulo = `Pasada para el ${p.paraFecha}`; }
                    const nota = (r || p)?.nota ? ` · Nota: ${(r || p).nota}` : "";
                    return `<span class="estado estado--${clase}" title="${esc(titulo + nota)}">${esc(nombre(a.persona).slice(0, 2))}${r ? " ✓" : p ? " ⏭" : ""}${nota ? " 📝" : ""}</span>`;
                }).join("")}</td>`;
            }).join("");
            return `<tr><th scope="row">${esc(t.nombre)}</th>${celdas}</tr>`;
        }).join("");
        const pct = total ? Math.round((hechas / total) * 100) : 0;
        return `
        <section class="local local--${id}">
            <header class="local__cabecera">
                <h2>🏪 ${l.nombre}</h2>
                <p>${hechas} de ${total} tareas del mes hechas (${pct}%)</p>
            </header>
            <div class="local__cuerpo">
                <div class="barra"><span class="barra__relleno" style="width:${pct}%"></span></div>
                <div class="tabla-scroll">
                    <table class="informe">
                        <thead><tr><th>Tarea</th>${bloques.map((b) => `<th class="col-s${b.semana}">S${b.semana}<small>${b.inicio.getDate()}–${b.fin.getDate()}</small></th>`).join("")}</tr></thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
            </div>
        </section>`;
    }).join("");

    const historial = Object.values(estado.registros)
        .filter((r) => { const d = new Date(r.cuando); return d.getFullYear() === anio && d.getMonth() === mes; })
        .sort((a, b) => b.cuando.localeCompare(a.cuando));
    const nombreTarea = nombreDeTarea;

    return `
    ${heroHoy({ extra: pendientesAhora })}
    <section class="encabezado">
        <h1>Informes</h1>
        <label class="selector">Mes
            <select data-mes>
                ${meses.map((m) => { const [a, mm] = m.split("-").map(Number); return `<option value="${m}" ${m === sel ? "selected" : ""}>${cal.nombreMes(mm)} ${a}</option>`; }).join("")}
            </select>
        </label>
        <p class="leyenda">
            <span class="estado estado--ok">✓</span> hecha
            <span class="estado estado--curso">··</span> en curso
            <span class="estado estado--pospuesta">⏭</span> pasada a otro día
            <span class="estado estado--falta">··</span> no se registró
            <span class="estado estado--futura">··</span> próximamente
            <span>📝 tiene nota (tocá para verla)</span>
        </p>
    </section>
    ${tablas}
    <section class="bloque">
        <h2 class="bloque__titulo">Historial del mes</h2>
        ${historial.length ? `<ul class="historial">${historial.map((r) => `
            <li><span class="historial__cuando">${diaCorto(r.cuando)} · ${hora(r.cuando)}</span>
                <span>${r.tipo === "pospuesta" ? "⏭️ " : "✅ "}${esc(nombreTarea(r.tareaId))}</span>
                ${r.tipo === "pospuesta" ? `<span class="historial__pospuesta">Pasada para el ${cal.fechaLarga(cal.desdeIso(r.paraFecha))}</span>` : ""}
                ${r.nota ? `<span class="historial__nota">📝 ${esc(r.nota)}</span>` : ""}
                <span class="historial__meta">${LOCALES[r.local]?.nombre} · turno ${nombreTurno(r.turno)} · ${esc(nombre(r.persona))}</span></li>`).join("")}</ul>`
            : `<p class="vacio">Todavía no hay registros este mes.</p>`}
    </section>`;
}

// ---------- Tareas puntuales de Carolina ----------
// Cada una tiene nombre, local, para quién (una chica o todas las del local) y fecha.
// Ese día le aparece en "Hoy" para tildarla; si no se hace, le sigue apareciendo.

function tarjetaAgenda(a, { borrable = false, mostrarFecha = true, marcable = false } = {}) {
    const r = registroAgenda(a);
    const atrasada = !r && a.fecha < cal.iso(cal.ahora());
    let check = "";
    if (marcable) {
        check = r
            ? `<span class="check is-ok" aria-label="Hecha"><i class="ti ti-check" aria-hidden="true"></i></span>`
            : `<button class="check" data-marcar-agenda="${a.id}" aria-label="Lo hice"></button>`;
    }
    const estadoTexto = r
        ? `✅ Hecha por ${esc(nombre(r.persona))} · ${diaCorto(r.cuando)} ${hora(r.cuando)}`
        : atrasada ? `⏭️ Quedó del ${cal.fechaLarga(cal.desdeIso(a.fecha))}` : "";
    const clases = ["nota", "nota--agenda"];
    if (r) clases.push("is-hecha");
    if (r && estado.recien === idHechaAgenda(a)) clases.push("is-recien");
    if (atrasada) clases.push("is-atrasada");
    return `
    <article class="${clases.join(" ")}">
        <div class="tarea__fila">
            ${check}
            <div class="tarea__info">
                <p class="nota__meta">📌 ${a.fecha === cal.iso(cal.ahora()) ? "Para hoy · " : mostrarFecha ? `${cal.fechaLarga(cal.desdeIso(a.fecha))} · ` : `Para el ${cal.fechaLarga(cal.desdeIso(a.fecha))} · `}${a.local ? `${LOCALES[a.local]?.nombre} · ` : ""}${esc(paraQuien(a.para))} · de Carolina</p>
                <p class="nota__texto">${esc(a.texto)}</p>
                ${estadoTexto ? `<p class="nota__meta">${estadoTexto}</p>` : ""}
            </div>
            ${marcable && esMio(r) ? `<div class="tarea__acciones"><button class="pildora" data-desmarcar="${idHechaAgenda(a)}">Deshacer</button></div>` : ""}
        </div>
        ${borrable ? `<button class="nota__borrar" data-borrar-agenda="${a.id}">Quitar</button>` : ""}
    </article>`;
}

async function marcarAgenda(id, boton) {
    const a = estado.agenda.find((x) => x.id === id);
    if (!a) return;
    boton.disabled = true;
    const hoy = cal.ahora();
    const local = a.local || cal.dondeEsta(estado.persona, hoy)?.local || "centro";
    const rid = idHechaAgenda(a);
    estado.recien = rid;
    setTimeout(() => { if (estado.recien === rid) estado.recien = null; }, 1500);
    await datos.marcar({
        id: rid, tipo: "hecha", tareaId: a.id, local, persona: estado.persona, asignadaA: a.para,
        fecha: cal.iso(hoy), cuando: hoy.toISOString(), turno: cal.turnoActual(local, hoy), nota: ""
    });
    aviso("¡Listo! Tarea registrada ✓", "ok");
}

// Formulario de tarea puntual. En "Tareas" se elige el día; en el calendario, es el día tocado.
function formTareaPuntual({ conFecha = true, compacto = false } = {}) {
    const f = estado.formAgenda;
    if (!f.fecha) f.fecha = cal.iso(cal.proximoDiaHabil(cal.ahora()));
    // Primero las que trabajan en ese local y después las demás (Carolina puede asignarle algo a cualquiera).
    const delLocal = personasDe(f.local);
    const personas = [...delLocal, ...Object.keys(PERSONAS).filter((id) => PERSONAS[id].rol === "empleada" && !delLocal.includes(id))];
    return `
    <form class="formulario ${compacto ? "formulario--compacto" : ""}" id="form-agenda">
        ${compacto ? "" : "<h2>➕ Nueva tarea</h2>"}
        <label>Tarea
            <input data-agenda-campo="texto" data-foco="agenda-texto" maxlength="200" required value="${esc(f.texto)}"
                placeholder="Ej: reponer las servilletas de la barra que quedó pendiente">
        </label>
        <div class="formulario__fila">
            <label>Local
                <select data-agenda-campo="local">
                    ${Object.entries(LOCALES).map(([id, l]) => `<option value="${id}" ${id === f.local ? "selected" : ""}>${l.nombre}</option>`).join("")}
                </select>
            </label>
            <label>¿Para quién?
                <select data-agenda-campo="para">
                    <option value="todas" ${f.para === "todas" ? "selected" : ""}>Todas las del local</option>
                    ${personas.map((id) => `<option value="${id}" ${f.para === id ? "selected" : ""}>${esc(nombre(id))}${delLocal.includes(id) ? "" : " (otro local)"}</option>`).join("")}
                </select>
            </label>
        </div>
        ${conFecha ? `
        <label>¿Para qué día? <small>Por defecto, el próximo día hábil</small>
            <input type="date" data-agenda-campo="fecha" value="${f.fecha}" min="${cal.iso(cal.ahora())}" required>
        </label>` : ""}
        <button class="boton ${compacto ? "" : "boton--grande"}" type="submit">${conFecha ? "Agregar tarea" : "➕ Agregar a este día"}</button>
    </form>`;
}

async function guardarAgenda(fechaFija = null) {
    const f = estado.formAgenda;
    const texto = f.texto.trim();
    const fecha = fechaFija || f.fecha;
    if (!texto) return aviso("Escribí la tarea");
    if (!fecha) return aviso("Elegí el día");
    await datos.guardarEn("agenda", {
        id: nuevoId("agenda"), fecha, local: f.local, para: f.para, texto, cuando: cal.ahora().toISOString()
    });
    f.texto = "";
    aviso(`Tarea agregada para ${paraQuien(f.para)} el ${cal.fechaLarga(cal.desdeIso(fecha))} ✓`);
    render();
}

// ---------- Vista: Tareas (Carolina) ----------

function vistaTareas() {
    const hoyIso = cal.iso(cal.ahora());
    const lista = [...estado.agenda].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const proximas = lista.filter((a) => a.fecha >= hoyIso);
    const anteriores = lista.filter((a) => a.fecha < hoyIso).reverse().slice(0, 20);
    const semanalesViejas = cal.todasLasTareas().filter((t) => t.id.startsWith("extra-"));

    return `
    <section class="encabezado">
        <h1>Tareas puntuales</h1>
        <p>Para lo que quedó pendiente o se habló en el grupo: elegí el local, para quién y el día (por defecto, mañana).
        Ese día le aparece en "Hoy" para tildarla, y si no la hace, le sigue apareciendo.</p>
    </section>
    ${formTareaPuntual()}
    <section class="bloque">
        <h2 class="bloque__titulo">Hoy y próximas</h2>
        ${proximas.length ? proximas.map((a) => tarjetaAgenda(a, { borrable: true })).join("") : `<p class="vacio">No hay tareas agendadas.</p>`}
    </section>
    ${anteriores.length ? `
    <section class="bloque">
        <h2 class="bloque__titulo">Anteriores</h2>
        ${anteriores.map((a) => tarjetaAgenda(a, { borrable: true })).join("")}
    </section>` : ""}
    ${semanalesViejas.length ? `
    <section class="bloque">
        <h2 class="bloque__titulo">Tareas semanales agregadas antes</h2>
        <ul class="lista-tareas">
            ${semanalesViejas.map((t) => `
            <li>
                <div><strong>${esc(t.nombre)}</strong><small>${LOCALES[t.local]?.nombre || ""}</small></div>
                <button class="boton boton--suave boton--chico" data-borrar-tarea="${t.id}">Quitar</button>
            </li>`).join("")}
        </ul>
    </section>` : ""}
    <p class="vacio">Las tareas fijas de cada semana están en 📖 Glosario.</p>`;
}

async function borrarTarea(id) {
    const t = cal.todasLasTareas().find((x) => x.id === id);
    if (!confirm(`¿Quitar "${t?.nombre}"? Deja de aparecer para el equipo (el historial se conserva).`)) return;
    await datos.borrarTareaExtra(id);
    aviso("Tarea quitada");
}

// ---------- Tarjetas de notas ----------

function tarjetaNotaTurno(n, { mostrarLocal = true } = {}) {
    const propia = esMio(n);
    return `
    <article class="nota nota--${n.local}">
        <p class="nota__meta">${mostrarLocal ? `${LOCALES[n.local]?.nombre} · ` : ""}${diaCorto(n.cuando)} · ${hora(n.cuando)} · turno ${nombreTurno(n.turno)} · ${esc(nombre(n.persona))}${n.editada ? " · editada" : ""}</p>
        ${editandoNota("notasTurno", n.id) ? formEditarNota() : `
        <p class="nota__texto">${esc(n.texto)}</p>
        ${propia ? `<div class="nota__acciones">
            <button class="nota__borrar" data-editar-nota="notasTurno" data-id="${n.id}">Editar</button>
            <button class="nota__borrar" data-borrar-turno="${n.id}">Borrar</button>
        </div>` : ""}`}
    </article>`;
}

// ---------- Editar notas (de turno y el bloc de Carolina) ----------

const editandoNota = (col, id) => estado.editandoNota?.col === col && estado.editandoNota.id === id;
const listaDeNotas = (col) => (col === "notasTurno" ? estado.notasTurno : estado.notasDuena);

function formEditarNota() {
    return `
    <form class="nota__edicion" id="form-editar-nota">
        <textarea data-texto-edicion data-foco="editar-nota" rows="4" maxlength="3000" required>${esc(estado.editandoNota.texto)}</textarea>
        <div class="tarea__botones">
            <button class="boton" type="submit">Guardar</button>
            <button class="boton boton--suave" type="button" data-cancelar-nota>Cancelar</button>
        </div>
    </form>`;
}

function empezarEdicionNota(col, id) {
    const n = listaDeNotas(col).find((x) => x.id === id);
    if (!n) return;
    estado.editandoNota = { col, id, texto: n.texto };
    render();
}

async function guardarEdicionNota() {
    const { col, id, texto } = estado.editandoNota;
    const n = listaDeNotas(col).find((x) => x.id === id);
    const nuevo = texto.trim();
    if (!n) return;
    if (!nuevo) return aviso("La nota no puede quedar vacía");
    const { uid, ...resto } = n;
    await datos.guardarEn(col, { ...resto, texto: nuevo, editada: cal.ahora().toISOString() });
    estado.editandoNota = null;
    aviso("Nota actualizada ✓", "ok");
    render();
}

async function borrarConConfirmacion(coleccion, id, pregunta) {
    if (!confirm(pregunta)) return;
    await datos.borrarDe(coleccion, id);
    aviso("Listo, borrado");
}

// ---------- Vista: Cambio de turno ----------

function vistaTurno() {
    const hoy = cal.ahora();
    const f = estado.formTurno;
    if (!f.local) f.local = (!esDuena() && cal.dondeEsta(estado.persona, hoy)?.local) || "centro";
    const desde = cal.iso(cal.sumarDias(hoy, -7));

    return `
    <section class="encabezado">
        <h1>Cambio de turno</h1>
        <p>Dejá todo lo que tiene que saber quien entra: faltantes, pedidos, clientes que vuelven, algo que se rompió, lo que quedó a medias…</p>
    </section>
    ${formNotaTurno()}
    <div class="locales">
    ${Object.entries(LOCALES).map(([id, l]) => {
        const lista = estado.notasTurno.filter((n) => n.local === id && n.fecha >= desde).sort(masNuevoPrimero);
        return `
        <section class="local local--${id}">
            <header class="local__cabecera">
                <h2>🏪 ${l.nombre}</h2>
                <p>Últimos 7 días · cambio de turno a las ${l.cambioTurno}</p>
            </header>
            <div class="local__cuerpo">
                ${lista.length ? lista.map((n) => tarjetaNotaTurno(n, { mostrarLocal: false })).join("") : `<p class="vacio">Sin notas en los últimos 7 días.</p>`}
            </div>
        </section>`;
    }).join("")}
    </div>`;
}

function formNotaTurno({ compacto = false } = {}) {
    const f = estado.formTurno;
    return `
    <form class="formulario ${compacto ? "formulario--compacto" : ""}" id="form-turno">
        ${compacto ? "" : "<h2>📝 Nota para el próximo turno</h2>"}
        <label>Local
            <select data-turno-campo="local">
                ${Object.entries(LOCALES).map(([id, l]) => `<option value="${id}" ${id === f.local ? "selected" : ""}>${l.nombre}</option>`).join("")}
            </select>
        </label>
        <label>¿Qué hay que saber?
            <textarea data-turno-campo="texto" data-foco="turno-texto" rows="${compacto ? 3 : 5}" maxlength="1500" required
                placeholder="Ej: quedan pocas medialunas para la tarde. La señora de la torta de cumpleaños pasa a buscarla a las 18.">${esc(f.texto)}</textarea>
        </label>
        <button class="boton ${compacto ? "" : "boton--grande"}" type="submit">Dejar nota</button>
    </form>`;
}

async function guardarNotaTurno() {
    const f = estado.formTurno;
    const texto = f.texto.trim();
    if (!texto) return aviso("Escribí algo para el próximo turno");
    const ahoraMismo = cal.ahora();
    await datos.guardarEn("notasTurno", {
        id: nuevoId("turno"), local: f.local, fecha: cal.iso(ahoraMismo), cuando: ahoraMismo.toISOString(),
        turno: cal.turnoActual(f.local, ahoraMismo), persona: estado.persona, texto
    });
    f.texto = "";
    aviso("Nota guardada ✓ La ve el próximo turno");
    render();
}

// ---------- Vista: Glosario (todas las tareas fijas, para consultar) ----------
// Tres formas de verlo: por local (tabla), por persona y por semana.

const RANGOS_SEMANA = ["1 al 7", "8 al 14", "15 al 21", "22 a fin de mes"];

function vistaGlosario() {
    const hoy = cal.ahora();
    const semanaActual = cal.semanaDelMes(hoy);
    // Semanas reales del mes en curso (S4 termina el último día del mes)
    const mesNombre = cal.nombreMes(hoy.getMonth());
    const bloquesMes = [1, 2, 3, 4].map((s) => cal.bloque(hoy.getFullYear(), hoy.getMonth(), s));
    const rango = (s) => `${bloquesMes[s - 1].inicio.getDate()}–${bloquesMes[s - 1].fin.getDate()} ${mesNombre.slice(0, 3)}`;
    const yo = estado.persona;
    const modo = estado.modoGlosario;
    const normalizar = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const buscar = normalizar(estado.buscarGlosario.trim());
    const todas = cal.todasLasTareas().filter((t) => t.tipo !== "libre");
    const visibles = todas.filter((t) => !buscar || normalizar(t.nombre).includes(buscar));
    const persona = (id) => `<span class="persona persona--${id} ${id === yo ? "is-yo" : ""}">${esc(nombre(id))}</span>`;
    const quienLunes = (t) => (t.persona ? persona(t.persona) : t.rotacion.map(persona).join(" "));

    const modos = [["local", "building-store", "Por local"], ["persona", "user", "Por persona"], ["semana", "calendar-week", "Por semana"]];
    let cuerpo = "";

    if (modo === "local") {
        cuerpo = `<div class="locales">${Object.entries(LOCALES).map(([id, l]) => {
            const lista = visibles.filter((t) => t.local === id);
            const filas = lista.map((t) => t.tipo === "lunes"
                ? `<tr><th scope="row">☕ ${esc(t.nombre)}</th><td colspan="4" class="glosario__lunes">Todos los lunes · ${quienLunes(t)}</td></tr>`
                : `<tr><th scope="row">${esc(t.nombre)}</th>${[1, 2, 3, 4].map((s) =>
                    `<td class="${s === semanaActual ? "is-actual" : ""}">${t.semanas[s] ? persona(t.semanas[s]) : `<span class="glosario__nada">—</span>`}</td>`).join("")}</tr>`).join("");
            return `
            <section class="local local--${id}">
                <header class="local__cabecera"><h2>🏪 ${l.nombre}</h2><p>${lista.length} tareas · ${personasDe(id).map(nombre).join(" y ")}</p></header>
                <div class="local__cuerpo">
                    ${lista.length ? `
                    <div class="tabla-scroll">
                        <table class="informe glosario">
                            <thead><tr><th>Tarea</th>${[1, 2, 3, 4].map((s) =>
                                `<th class="${s === semanaActual ? "is-actual" : ""}"><span class="sigla-semana sigla-semana--s${s}">S${s}</span><small>${rango(s)}${s === semanaActual ? " · ahora" : ""}</small></th>`).join("")}</tr></thead>
                            <tbody>${filas}</tbody>
                        </table>
                    </div>` : `<p class="vacio">No hay tareas con esa búsqueda.</p>`}
                </div>
            </section>`;
        }).join("")}</div>`;
    }

    if (modo === "persona") {
        cuerpo = `<div class="glosario__personas">${empleadas().map((p) => {
            const locales = Object.keys(LOCALES).filter((id) => personasDe(id).includes(p));
            const porSemana = [1, 2, 3, 4].map((s) => visibles.filter((t) => t.tipo === "semanal" && t.semanas[s] === p));
            const lunes = visibles.filter((t) => t.tipo === "lunes" && (t.persona === p || t.rotacion?.includes(p)));
            const total = porSemana.reduce((n, l) => n + l.length, 0);
            return `
            <section class="ficha ${p === yo ? "is-yo" : ""}">
                <header class="ficha__cabecera">
                    <span class="evento__avatar evento__avatar--${p}">${esc(nombre(p).slice(0, 2).toUpperCase())}</span>
                    <div><h2>${esc(nombre(p))}${p === yo ? " (vos)" : ""}</h2>
                    <p>${locales.map((id) => `<span class="chip chip--${id}">${LOCALES[id].nombre}</span>`).join(" ")} · ${total} tareas al mes</p></div>
                </header>
                ${lunes.length ? `<p class="ficha__lunes">☕ ${lunes.map((t) => `${esc(t.nombre)} (${LOCALES[t.local].nombre}${t.persona ? ", todos los lunes" : ", lunes alternados"})`).join(" · ")}</p>` : ""}
                ${porSemana.map((lista, i) => `
                <div class="ficha__semana ${i + 1 === semanaActual ? "is-actual" : ""}">
                    <span class="sigla-semana sigla-semana--s${i + 1}">S${i + 1}</span>
                    ${lista.length ? `<ul>${lista.map((t) => `<li><span class="punto-local punto-local--${t.local}"></span>${esc(t.nombre)}</li>`).join("")}</ul>` : `<p class="glosario__nada">Sin tareas fijas</p>`}
                </div>`).join("")}
            </section>`;
        }).join("")}</div>`;
    }

    if (modo === "semana") {
        cuerpo = [1, 2, 3, 4].map((s) => `
        <section class="semana-glosario semana-glosario--s${s} ${s === semanaActual ? "is-actual" : ""}">
            <header class="semana-glosario__cabecera">
                <span class="sigla-semana sigla-semana--s${s}">S${s}</span>
                <strong>Semana ${s}</strong><small>del ${bloquesMes[s - 1].inicio.getDate()} al ${bloquesMes[s - 1].fin.getDate()} de ${mesNombre}${s === semanaActual ? " · esta semana" : ""}</small>
            </header>
            <div class="semana-glosario__locales">
            ${Object.entries(LOCALES).map(([id, l]) => {
                const lista = visibles.filter((t) => t.local === id && t.tipo === "semanal" && t.semanas[s]);
                return `
                <div class="semana-glosario__local">
                    <h3><span class="punto-local punto-local--${id}"></span>${l.nombre} · ${lista.length}</h3>
                    ${lista.length ? `<ul>${lista.map((t) => `<li><span>${esc(t.nombre)}</span>${persona(t.semanas[s])}</li>`).join("")}</ul>` : `<p class="glosario__nada">—</p>`}
                </div>`;
            }).join("")}
            </div>
        </section>`).join("") + `<p class="vacio">☕ La limpieza de la cafetera va todos los lunes: Plaza, ${visibles.filter((t) => t.tipo === "lunes" && t.local === "plaza").map(quienLunes).join("") || "—"}${visibles.some((t) => t.tipo === "lunes" && t.local === "centro") ? ` · Centro, se turnan ${visibles.filter((t) => t.tipo === "lunes" && t.local === "centro").map(quienLunes).join("")}` : ""}.</p>`;
    }

    return `
    <section class="encabezado">
        <h1>📖 Glosario de tareas</h1>
        <p class="glosario__mes">${mesNombre} ${hoy.getFullYear()}</p>
        <p>Todas las tareas fijas de los dos locales y quién hace cada una. La semana del mes va por días:
        ${[1, 2, 3, 4].map((s) => `<span class="sigla-semana sigla-semana--s${s}">S${s}</span> ${RANGOS_SEMANA[s - 1]}`).join(" · ")}.</p>
        <div class="glosario__totales">
            <span class="hoy__chip hoy__chip--fuerte">📋 ${todas.length} tareas fijas</span>
            ${Object.entries(LOCALES).map(([id, l]) => `<span class="hoy__chip">🏪 ${l.nombre}: ${todas.filter((t) => t.local === id).length}</span>`).join("")}
            <span class="hoy__chip">📅 Ahora: semana ${semanaActual} de ${mesNombre}</span>
        </div>
        <input class="glosario__buscar" type="search" data-buscar-glosario data-foco="buscar-glosario"
            value="${esc(estado.buscarGlosario)}" placeholder="🔎 Buscar tarea (ej: vitrina, baño, cafetera)">
    </section>
    <div class="filtros">
        ${modos.map(([id, icono, txt]) => `<button class="filtros__item ${modo === id ? "is-activo" : ""}" data-modo-glosario="${id}"><i class="ti ti-${icono}" aria-hidden="true"></i> ${txt}</button>`).join("")}
    </div>
    ${cuerpo}`;
}

// ---------- Vista: Actividad (muro de Carolina) ----------
// Todo lo que pasó en los locales en los últimos 7 días, en orden y en tiempo real.

function vistaActividad() {
    const hoy = cal.ahora();
    const filtro = estado.filtroMuro;
    const desde = cal.iso(cal.sumarDias(hoy, -7));
    const nombreTarea = nombreDeTarea;
    const iniciales = (id) => nombre(id).slice(0, 2).toUpperCase();

    const eventos = [];
    for (const r of Object.values(estado.registros)) {
        if (r.fecha < desde) continue;
        eventos.push({
            cuando: r.cuando, local: r.local, persona: r.persona, icono: r.tipo === "hecha" ? "✅" : "⏭️",
            texto: r.tipo === "hecha"
                ? `hizo <strong>${esc(nombreTarea(r.tareaId))}</strong>`
                : `pasó <strong>${esc(nombreTarea(r.tareaId))}</strong> para el ${cal.fechaLarga(cal.desdeIso(r.paraFecha))}`,
            extra: r.nota ? `📝 ${esc(r.nota)}` : ""
        });
    }
    for (const n of estado.notasTurno) {
        if (n.fecha < desde) continue;
        eventos.push({ cuando: n.cuando, local: n.local, persona: n.persona, icono: "🔄", texto: "dejó una nota de turno", extra: esc(n.texto) });
    }
    for (const a of estado.agenda) {
        if (!a.cuando || cal.iso(new Date(a.cuando)) < desde) continue;
        eventos.push({
            cuando: a.cuando, local: null, persona: "carolina", icono: "📌",
            texto: `agendó para ${esc(paraQuien(a.para))} el ${cal.fechaLarga(cal.desdeIso(a.fecha))}`, extra: esc(a.texto)
        });
    }

    for (const x of estado.checklists) {
        const c = CHECKLISTS.find((k) => k.id === x.checklist);
        if (!c || x.fecha < desde) continue;
        const faltan = c.items.filter((it) => !x.hechos?.[it.id]);
        const hechos = c.items.length - faltan.length;
        if (!hechos) continue;
        eventos.push({
            cuando: (x.completo && x.completoEn) || x.actualizado, local: x.local, persona: x.persona,
            icono: x.completo ? "✅" : "📋",
            texto: x.completo
                ? `completó el checklist <strong>${esc(c.titulo)}</strong>`
                : `hizo ${hechos} de ${c.items.length} del checklist <strong>${esc(c.titulo)}</strong>`,
            extra: x.completo ? "" : `Falta: ${faltan.map((it) => esc(it.texto)).join(" · ")}`
        });
    }

    const visibles = eventos.filter((e) => filtro === "todos" || e.local === filtro).sort(masNuevoPrimero);

    // Agrupados por día: Hoy, Ayer, lunes 21 de septiembre…
    const grupos = [];
    for (const e of visibles) {
        const d = new Date(e.cuando);
        const dias = cal.diasEntre(d, hoy);
        const etiqueta = dias === 0 ? "Hoy" : dias === 1 ? "Ayer" : cal.fechaLarga(d);
        if (grupos.at(-1)?.[0] !== etiqueta) grupos.push([etiqueta, []]);
        grupos.at(-1)[1].push(e);
    }

    // Avance de la semana en cada local
    const actuales = cal.asignacionesActuales(hoy);
    const progreso = Object.entries(LOCALES).map(([id, l]) => {
        const lista = actuales.filter((a) => a.tarea.local === id);
        const hechas = lista.filter((a) => estadoDe(a).tipo === "hecha").length;
        const pct = lista.length ? Math.round((hechas / lista.length) * 100) : 0;
        return `
        <div class="progreso-local progreso-local--${id}">
            <div class="progreso-local__texto"><strong>🏪 ${l.nombre}</strong><span>${hechas} de ${lista.length} esta semana</span></div>
            <div class="barra"><span class="barra__relleno" style="width:${pct}%"></span></div>
        </div>`;
    }).join("");

    const filtros = [["todos", "Todos"], ...Object.entries(LOCALES).map(([id, l]) => [id, l.nombre])];

    return `
    ${heroHoy()}
    <section class="encabezado">
        <h1>Actividad de los locales</h1>
        <p>Lo que pasó en los últimos 7 días. Se actualiza solo.</p>
    </section>
    <div class="progreso-locales">${progreso}</div>
    ${extras.resumenExtrasDuena()}
    ${recordatoriosHoy()}
    <div class="filtros">
        ${filtros.map(([id, txt]) => `<button class="filtros__item ${filtro === id ? "is-activo" : ""}" data-filtro-muro="${id}">${txt}</button>`).join("")}
    </div>
    <section class="muro">
        ${grupos.length ? grupos.map(([dia, lista]) => `
        <h2 class="muro__dia">${dia}</h2>
        ${lista.map((e) => `
        <article class="evento ${e.local ? `evento--${e.local}` : ""}">
            <span class="evento__avatar evento__avatar--${e.persona}">${iniciales(e.persona)}</span>
            <div class="evento__cuerpo">
                <p>${e.icono} <strong>${esc(nombre(e.persona))}</strong> ${e.texto}</p>
                ${e.extra ? `<p class="evento__extra">${e.extra}</p>` : ""}
                <small>${hora(e.cuando)}${e.local ? ` · ${LOCALES[e.local].nombre}` : ""}</small>
            </div>
        </article>`).join("")}`).join("") : `<p class="vacio">Todavía no hay actividad en estos días.</p>`}
    </section>`;
}

// ---------- Vista: Más ----------

function vistaMas() {
    return `
    <section class="encabezado">
        <h1>Más</h1>
        <p>El resto de las pantallas.</p>
    </section>
    <div class="mas">
        ${menuMas().map(([id, icono, txt]) => `<button class="mas__item" data-vista="${id}"><i class="ti ti-${icono}" aria-hidden="true"></i>${txt}</button>`).join("")}
    </div>`;
}


// ---------- Vista: Pedidos (proveedores y pedidos de clientes) ----------

// ---------- Pedidos a proveedores ----------
// Lo fijo sale de config.js > PEDIDOS; Carolina puede cambiar lo de un día puntual (colección "pedidosDia", id = fecha).

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Lo que se pide y lo que llega en una fecha: { pide, llega, nota, cambiado, persona } */
function pedidosDelDia(fecha) {
    const d = fecha.getDay();
    const cambio = estado.pedidosDia.find((x) => x.id === cal.iso(fecha));
    if (cambio) return { pide: cambio.pide || "", llega: cambio.llega || "", nota: cambio.nota || "", cambiado: true, persona: cambio.persona };
    const marcas = (clave) => PEDIDOS.filter((g) => g.dias.some((x) => x[clave] === d)).flatMap((g) => g.marcas).join(", ");
    return { pide: marcas("pide"), llega: marcas("llega"), nota: "", cambiado: false };
}

// Los dos carteles grandes: lo que se pide y lo que llega hoy.
function carteles(dia) {
    return `
    ${dia.pide ? `<p class="pedidos__hoy pedidos__hoy--pide"><span>📝 Hoy se pide</span><strong>${esc(dia.pide)}</strong></p>` : ""}
    ${dia.llega ? `<p class="pedidos__hoy pedidos__hoy--llega"><span>📦 Hoy llega</span><strong>${esc(dia.llega)}</strong></p>` : ""}
    ${dia.nota ? `<p class="pedidos__nota">🗒️ ${esc(dia.nota)}</p>` : ""}`;
}

// Aviso en "Hoy" de las chicas.
function avisoPedidosHoy(hoy) {
    const dia = pedidosDelDia(hoy);
    const donde = cal.dondeEsta(estado.persona, hoy);
    const llegaron = estado.pedidosClientes.filter((x) => x.estado === "llego" && (!donde || x.local === donde.local)).length;
    if (!dia.pide && !dia.llega && !dia.nota && !llegaron) return "";
    return `
    <section class="momento pedidos pedidos--aviso">
        <h2 class="momento__titulo">🚚 Pedidos de hoy</h2>
        ${carteles(dia)}
        ${llegaron ? `<p class="pedidos__nota">📦 ${llegaron === 1 ? "Llegó 1 pedido de cliente: hay que avisarle." : `Llegaron ${llegaron} pedidos de clientes: hay que avisarles.`}</p>` : ""}
        <button class="boton boton--suave" data-vista="pedidos">Ver pedidos</button>
    </section>`;
}

// Formulario de Carolina para cambiar lo de un día.
function formPedidos() {
    const f = estado.formPedidos;
    const fecha = cal.desdeIso(f.fecha);
    const fijo = !estado.pedidosDia.some((x) => x.id === f.fecha);
    return `
    <form class="formulario formulario--compacto" id="form-pedidos">
        <h3>✏️ Cambiar pedidos del día</h3>
        <label>Día
            <input type="date" data-pedidos-fecha value="${f.fecha}" required>
        </label>
        <p class="formulario__ayuda">${cal.nombreDia(fecha)} ${fecha.getDate()}/${fecha.getMonth() + 1}${fijo ? " · ahora muestra lo de siempre" : " · ya lo cambiaste"}</p>
        <label>Se pide
            <textarea data-pedidos-campo="pide" data-foco="pedidos-pide" rows="2" maxlength="300" placeholder="Ej: lácteos, café en grano">${esc(f.pide)}</textarea>
        </label>
        <label>Llega
            <textarea data-pedidos-campo="llega" data-foco="pedidos-llega" rows="2" maxlength="300" placeholder="Ej: harinas y azúcar">${esc(f.llega)}</textarea>
        </label>
        <label>Nota (opcional)
            <textarea data-pedidos-campo="nota" data-foco="pedidos-nota" rows="2" maxlength="300" placeholder="Ej: los lácteos llegan a la tarde">${esc(f.nota)}</textarea>
        </label>
        <div class="tarea__botones">
            <button class="boton" type="submit">Guardar</button>
            <button class="boton boton--suave" type="button" data-pedidos-cancelar>Cancelar</button>
        </div>
        ${fijo ? "" : `<button class="nota__borrar" type="button" data-pedidos-restaurar>Volver a lo de siempre</button>`}
    </form>`;
}

function abrirFormPedidos(fechaIso) {
    const dia = pedidosDelDia(cal.desdeIso(fechaIso));
    estado.formPedidos = { fecha: fechaIso, pide: dia.pide, llega: dia.llega, nota: dia.nota };
    render();
}

async function guardarPedidos() {
    const f = estado.formPedidos;
    await datos.guardarEn("pedidosDia", {
        id: f.fecha, pide: f.pide.trim(), llega: f.llega.trim(), nota: f.nota.trim(),
        persona: estado.persona, actualizado: cal.ahora().toISOString()
    });
    estado.formPedidos = null;
    aviso("Pedidos del día guardados ✓");
    render();
}

async function restaurarPedidos() {
    if (!confirm("¿Volver a lo de siempre para ese día?")) return;
    await datos.borrarDe("pedidosDia", estado.formPedidos.fecha);
    estado.formPedidos = null;
    aviso("Listo, vuelve a lo de siempre");
    render();
}

// Proveedores en la sección Pedidos: lo de hoy en grande, el calendario fijo abajo.
function tarjetaPedidos(hoy) {
    const d = hoy.getDay();
    const dia = pedidosDelDia(hoy);
    return `
    <section class="pedidos">
        <h2>🏭 Proveedores · hoy</h2>
        ${dia.pide || dia.llega || dia.nota ? carteles(dia) : `<p class="vacio">Hoy no se pide ni llega nada.</p>`}
        ${dia.cambiado ? `<p class="formulario__ayuda">✏️ Cambiado por ${esc(nombre(dia.persona))}</p>` : ""}
        ${esDuena() ? (estado.formPedidos ? formPedidos()
            : `<button class="boton boton--suave" data-pedidos-editar="${cal.iso(hoy)}">✏️ Cambiar lo de hoy u otro día</button>`) : ""}
        <h3 class="pedidos__subtitulo">Días de siempre</h3>
        <ul class="pedidos__lista">
            ${PEDIDOS.map((g) => `
            <li class="pedido">
                <strong class="pedido__marcas">${esc(g.marcas.join(" · "))}</strong>
                ${g.dias.map((x) => `
                <span class="pedido__dias">
                    <span class="${x.pide === d ? "is-hoy" : ""}">Pedido <b>${DIAS_SEMANA[x.pide]}</b></span>
                    <span aria-hidden="true">→</span>
                    <span class="${x.llega === d ? "is-hoy" : ""}">entrega <b>${DIAS_SEMANA[x.llega]}</b></span>
                </span>`).join("")}
            </li>`).join("")}
        </ul>
    </section>`;
}

// ---------- Pedidos de clientes ----------
// Una clienta pide algo que no hay: se anota acá (cliente, teléfono, producto, cantidad, forma de pago)
// y se sigue hasta que se entrega: pendiente → llegó (avisar al cliente) → entregado. Colección "pedidosClientes".

const ESTADOS_PEDIDO = {
    pendiente: { titulo: "⏳ Pendientes", texto: "Pendiente" },
    llego: { titulo: "📦 Llegaron · avisar al cliente", texto: "Llegó" },
    entregado: { titulo: "✅ Entregados", texto: "Entregado" },
    cancelado: { titulo: "❌ Cancelados", texto: "Cancelado" }
};
const PAGO_ESTADOS = [["nada", "Todavía no pagó"], ["sena", "Dejó seña"], ["total", "Pagó el total"]];
const pesos = (n) => `$ ${Number(n || 0).toLocaleString("es-AR")}`;

const formPedidoVacio = (local = "") => ({ cliente: "", telefono: "", producto: "", cantidad: "1", pago: "", pagoEstado: "nada", sena: "", total: "", nota: "", local });
// "5.000" → 5000 (los montos se escriben con puntos de miles)
const leerPesos = (texto) => Number(String(texto || "").replace(/\D/g, "")) || 0;
const buscarPedido = (id) => estado.pedidosClientes.find((x) => x.id === id);

// Campos del formulario (sirve para cargar uno nuevo y para editar). "prefijo" separa los dos formularios.
function camposPedido(f, prefijo) {
    const campo = `data-${prefijo}-campo`;
    return `
        <label>Producto
            <input ${campo}="producto" data-foco="${prefijo}-producto" maxlength="120" required value="${esc(f.producto)}"
                placeholder="Ej: torta Rogel para 15 personas">
        </label>
        <div class="formulario__fila">
            <label>Cantidad
                <input ${campo}="cantidad" data-foco="${prefijo}-cantidad" type="number" min="1" max="999" step="1" inputmode="numeric" required value="${esc(f.cantidad)}">
            </label>
            <label>Local
                <select ${campo}="local">
                    ${Object.entries(LOCALES).map(([id, l]) => `<option value="${id}" ${id === f.local ? "selected" : ""}>${l.nombre}</option>`).join("")}
                </select>
            </label>
        </div>
        <label>Nombre del cliente
            <input ${campo}="cliente" data-foco="${prefijo}-cliente" maxlength="80" required value="${esc(f.cliente)}" placeholder="Ej: Marta">
        </label>
        <label>Teléfono
            <input ${campo}="telefono" data-foco="${prefijo}-telefono" type="tel" inputmode="tel" maxlength="30" value="${esc(f.telefono)}" placeholder="Ej: 11 5555-1234">
        </label>
        <div class="formulario__fila">
            <label>¿Pagó algo?
                <select ${campo}="pagoEstado">
                    ${PAGO_ESTADOS.map(([v, t]) => `<option value="${v}" ${(f.pagoEstado || "nada") === v ? "selected" : ""}>${t}</option>`).join("")}
                </select>
            </label>
            ${f.pagoEstado === "sena" ? `
            <label>Monto de la seña
                <input ${campo}="sena" data-foco="${prefijo}-sena" inputmode="numeric" maxlength="12" value="${esc(f.sena)}" placeholder="Ej: 5.000">
            </label>` : ""}
            ${f.pagoEstado === "total" ? `
            <label>Monto total pagado <small>(obligatorio)</small>
                <input ${campo}="total" data-foco="${prefijo}-total" inputmode="numeric" maxlength="12" required value="${esc(f.total)}" placeholder="$">
            </label>` : ""}
        </div>
        <label>Forma de pago
            <select ${campo}="pago">
                <option value="" ${!f.pago ? "selected" : ""}>Todavía no se sabe</option>
                ${FORMAS_PAGO.map((x) => `<option ${x === f.pago ? "selected" : ""}>${x}</option>`).join("")}
            </select>
        </label>
        <label>Nota (opcional)
            <textarea ${campo}="nota" data-foco="${prefijo}-nota" rows="2" maxlength="300">${esc(f.nota)}</textarea>
        </label>`;
}

function tarjetaPedidoCliente(x) {
    if (estado.pedidoEditando === x.id) {
        return `
        <li class="pedido-cliente pedido-cliente--editando">
            <form class="formulario formulario--compacto" id="form-editar-pedido">
                <h3>✏️ Editar pedido</h3>
                ${camposPedido(estado.edicionPedido, "edicion-pedido")}
                <div class="tarea__botones">
                    <button class="boton" type="submit">Guardar</button>
                    <button class="boton boton--suave" type="button" data-pedido-cancelar>Cancelar</button>
                </div>
                <button class="nota__borrar" type="button" data-pedido-borrar="${x.id}">Borrar pedido</button>
            </form>
        </li>`;
    }
    const tel = (x.telefono || "").replace(/[^\d+]/g, "");
    const cancelar = `<button class="boton boton--chico boton--suave" data-pedido-estado="${x.id}" data-valor="cancelado">❌ Cancelar</button>`;
    const botones = {
        pendiente: `${cancelar}<button class="boton boton--chico" data-pedido-estado="${x.id}" data-valor="llego">📦 Ya llegó</button>`,
        llego: `${cancelar}${tel ? `<a class="boton boton--chico boton--suave" href="tel:${tel}">📞 Llamar</a>` : ""}
            <button class="boton boton--chico" data-pedido-estado="${x.id}" data-valor="entregado">✅ Entregado</button>`,
        entregado: `<button class="boton boton--chico boton--suave" data-pedido-estado="${x.id}" data-valor="llego">↩️ Deshacer entrega</button>`,
        cancelado: `<button class="boton boton--chico boton--suave" data-pedido-estado="${x.id}" data-valor="pendiente">↩️ Volver a pendiente</button>`
    }[x.estado] || "";
    const pagoTexto = { total: `Pagó el total${x.total ? ` (${pesos(x.total)})` : ""}`, sena: `Dejó seña${x.sena ? ` de ${pesos(x.sena)}` : ""}`, nada: "Todavía no pagó" }[x.pagoEstado || "nada"];
    const quien = esc(nombre(x.quien || x.persona));
    const cierre = x.estado === "entregado" ? ` · entregó ${quien}, ${diaCorto(x.entregadoEn || x.actualizado)} ${hora(x.entregadoEn || x.actualizado)}`
        : x.estado === "cancelado" ? ` · canceló ${quien}, ${diaCorto(x.canceladoEn || x.actualizado)}` : "";
    return `
    <li class="pedido-cliente pedido-cliente--${x.estado}">
        <div class="pedido-cliente__cabeza">
            <strong>${esc(x.cantidad)} × ${esc(x.producto)}</strong>
            <span class="chip chip--${x.local}">${esc(LOCALES[x.local]?.nombre || x.local)}</span>
        </div>
        <p class="pedido-cliente__dato">👤 ${esc(x.cliente)}${x.telefono ? ` · 📞 <a href="tel:${tel}">${esc(x.telefono)}</a>` : ""}</p>
        <p class="pedido-cliente__dato">💰 ${pagoTexto}${x.pago ? ` · ${esc(x.pago)}` : ""}</p>
        ${x.nota ? `<p class="pedido-cliente__nota">🗒️ ${esc(x.nota)}</p>` : ""}
        <small class="pedido-cliente__meta">Anotó ${esc(nombre(x.persona))}, ${diaCorto(x.creado)} ${hora(x.creado)}${cierre}</small>
        <div class="pedido-cliente__acciones">
            ${botones}
            <button class="producto__editar" data-pedido-editar="${x.id}" aria-label="Editar pedido de ${esc(x.cliente)}">✏️</button>
        </div>
    </li>`;
}

function vistaPedidos() {
    const hoy = cal.ahora();
    if (!estado.filtroPedidos) {
        estado.filtroPedidos = (!esDuena() && cal.dondeEsta(estado.persona, hoy)?.local) || "todos";
    }
    const filtro = estado.filtroPedidos;
    const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const buscar = normalizar(estado.buscarPedidos.trim());
    const visibles = estado.pedidosClientes
        .filter((x) => filtro === "todos" || x.local === filtro)
        .filter((x) => !buscar || [x.cliente, x.producto, x.telefono].some((t) => normalizar(t).includes(buscar)))
        .sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
    const de = (est) => visibles.filter((x) => x.estado === est);
    const pendientes = de("pendiente");
    const llegaron = de("llego");
    const f = estado.formPedido;
    if (!f.local) f.local = filtro !== "todos" ? filtro : "centro";
    const filtros = [["todos", "Todos"], ...Object.entries(LOCALES).map(([id, l]) => [id, l.nombre])];
    const lista = (items) => `<ul class="pedidos-clientes">${items.map(tarjetaPedidoCliente).join("")}</ul>`;

    return `
    <section class="encabezado">
        <h1>🚚 Pedidos</h1>
        <p>Lo que se les pide a los proveedores y los pedidos que hacen los clientes.</p>
    </section>
    ${tarjetaPedidos(hoy)}
    <section class="encabezado">
        <h2>🧾 Pedidos de clientes</h2>
        <div class="glosario__totales">
            <span class="hoy__chip hoy__chip--fuerte">⏳ ${pendientes.length} pendiente${pendientes.length === 1 ? "" : "s"}</span>
            ${llegaron.length ? `<span class="hoy__chip hoy__chip--alerta">📦 ${llegaron.length} para avisar</span>` : ""}
        </div>
        <input class="glosario__buscar" type="search" data-buscar-pedidos data-foco="buscar-pedidos"
            value="${esc(estado.buscarPedidos)}" placeholder="🔎 Buscar cliente, producto o teléfono">
    </section>
    <div class="filtros">
        ${filtros.map(([id, txt]) => `<button class="filtros__item ${filtro === id ? "is-activo" : ""}" data-filtro-pedidos="${id}">${txt}</button>`).join("")}
    </div>
    ${llegaron.length ? `<h3 class="bloque__titulo">${ESTADOS_PEDIDO.llego.titulo}</h3>${lista(llegaron)}` : ""}
    <h3 class="bloque__titulo">${ESTADOS_PEDIDO.pendiente.titulo}</h3>
    ${pendientes.length ? lista(pendientes) : `<p class="vacio">${buscar ? "No hay pedidos con esa búsqueda." : "No hay pedidos pendientes. Cuando una clienta pida algo, anotalo abajo."}</p>`}
    ${esDuena() ? `<button class="boton boton--suave boton--grande" data-vista="historialPedidos">📚 Ver pedidos entregados y cancelados</button>` : ""}
    <form class="formulario" id="form-pedido">
        <h2>➕ Nuevo pedido de cliente</h2>
        ${camposPedido(f, "pedido")}
        <button class="boton boton--grande" type="submit">Anotar pedido</button>
    </form>`;
}

// Arma el documento a guardar a partir del formulario; null si falta algo.
function leerFormPedido(f) {
    const cantidad = Math.round(Number(f.cantidad));
    const datosPedido = {
        cliente: f.cliente.trim(), telefono: f.telefono.trim(), producto: f.producto.trim(),
        cantidad, pago: f.pago || "", nota: f.nota.trim(), local: f.local,
        pagoEstado: f.pagoEstado || "nada",
        sena: f.pagoEstado === "sena" ? leerPesos(f.sena) : 0,
        total: f.pagoEstado === "total" ? leerPesos(f.total) : 0
    };
    if (!datosPedido.producto) return aviso("Escribí el producto"), null;
    if (!datosPedido.cliente) return aviso("Escribí el nombre del cliente"), null;
    if (!(cantidad >= 1 && cantidad <= 999)) return aviso("La cantidad tiene que ser 1 o más"), null;
    if (datosPedido.pagoEstado === "total" && !datosPedido.total) return aviso("Poné el monto total que pagó"), null;
    return datosPedido;
}

async function agregarPedido() {
    const nuevo = leerFormPedido(estado.formPedido);
    if (!nuevo) return;
    const ahora = cal.ahora().toISOString();
    await datos.guardarEn("pedidosClientes", {
        id: nuevoId("pedido"), ...nuevo, estado: "pendiente", persona: estado.persona, quien: estado.persona, creado: ahora, actualizado: ahora
    });
    estado.formPedido = formPedidoVacio(nuevo.local);
    aviso(`Pedido de ${nuevo.cliente} anotado ✓`);
    render();
}

function editarPedido(id) {
    const x = buscarPedido(id);
    if (!x) return;
    estado.pedidoEditando = id;
    estado.edicionPedido = { ...formPedidoVacio(x.local), ...x, cantidad: String(x.cantidad ?? 1), pagoEstado: x.pagoEstado || "nada", sena: x.sena ? Number(x.sena).toLocaleString("es-AR") : "", total: x.total ? Number(x.total).toLocaleString("es-AR") : "" };
    render();
}

// Guarda el pedido completo con los cambios (el documento se reemplaza entero).
async function guardarPedido(x, cambios) {
    const { uid, ...resto } = x;
    await datos.guardarEn("pedidosClientes", { pagoEstado: "nada", sena: 0, total: 0, ...resto, ...cambios, quien: estado.persona, actualizado: cal.ahora().toISOString() });
}

async function guardarEdicionPedido() {
    const x = buscarPedido(estado.pedidoEditando);
    const cambios = x && leerFormPedido(estado.edicionPedido);
    if (!cambios) return;
    await guardarPedido(x, cambios);
    estado.pedidoEditando = null;
    aviso("Pedido actualizado ✓");
    render();
}

async function cambiarEstadoPedido(id, nuevoEstado) {
    const x = buscarPedido(id);
    if (!x) return;
    if (nuevoEstado === "cancelado" && !confirm(`¿Cancelar el pedido de ${x.cliente} (${x.producto})?`)) return;
    const ahora = cal.ahora().toISOString();
    const cambios = { estado: nuevoEstado };
    if (nuevoEstado === "entregado") cambios.entregadoEn = ahora;
    if (nuevoEstado === "cancelado") cambios.canceladoEn = ahora;
    await guardarPedido(x, cambios);
    aviso({
        llego: "📦 Marcado como llegado: avisale al cliente", entregado: "✅ Pedido entregado",
        cancelado: "❌ Pedido cancelado", pendiente: "Volvió a pendientes"
    }[nuevoEstado] || "Listo");
}

// ---------- Vista: Pedidos entregados (Carolina) ----------
// Historial de los pedidos de clientes ya entregados o cancelados, por mes, con buscador por cliente.

function vistaHistorialPedidos() {
    const filtro = estado.filtroHistorial;
    const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const buscar = normalizar(estado.buscarHistorial.trim());
    const cuando = (x) => (x.estado === "entregado" ? x.entregadoEn : x.canceladoEn) || x.actualizado || x.creado || "";
    const cerrados = estado.pedidosClientes.filter((x) => x.estado === "entregado" || x.estado === "cancelado");
    const cuenta = (est) => cerrados.filter((x) => x.estado === est).length;
    const lista = cerrados
        .filter((x) => x.estado === filtro)
        .filter((x) => !buscar || [x.cliente, x.producto, x.telefono].some((t) => normalizar(t).includes(buscar)))
        .sort((a, b) => cuando(b).localeCompare(cuando(a)));
    // Agrupados por mes
    const meses = [];
    for (const x of lista) {
        const d = new Date(cuando(x));
        const clave = `${cal.nombreMes(d.getMonth())} ${d.getFullYear()}`;
        if (meses.at(-1)?.clave !== clave) meses.push({ clave, items: [] });
        meses.at(-1).items.push(x);
    }
    const filtros = [["entregado", `✅ Entregados (${cuenta("entregado")})`], ["cancelado", `❌ Cancelados (${cuenta("cancelado")})`]];
    return `
    <section class="encabezado">
        <h1>📚 Pedidos entregados</h1>
        <p>Los pedidos de clientes que ya se entregaron o se cancelaron. Buscá un cliente para ver todo lo que pidió.</p>
        <input class="glosario__buscar" type="search" data-buscar-historial data-foco="buscar-historial"
            value="${esc(estado.buscarHistorial)}" placeholder="🔎 Buscar cliente, producto o teléfono">
    </section>
    <div class="filtros">
        ${filtros.map(([id, txt]) => `<button class="filtros__item ${filtro === id ? "is-activo" : ""}" data-filtro-historial="${id}">${txt}</button>`).join("")}
    </div>
    ${buscar && lista.length ? `<p class="formulario__ayuda">${lista.length} pedido${lista.length === 1 ? "" : "s"} con "${esc(estado.buscarHistorial.trim())}"</p>` : ""}
    ${meses.length ? meses.map((m) => `
    <h3 class="bloque__titulo">${m.clave.charAt(0).toUpperCase() + m.clave.slice(1)} · ${m.items.length}</h3>
    <ul class="pedidos-clientes">${m.items.map(tarjetaPedidoCliente).join("")}</ul>`).join("")
        : `<p class="vacio">${buscar ? "No hay pedidos con esa búsqueda." : filtro === "entregado" ? "Todavía no se entregó ningún pedido." : "No hay pedidos cancelados."}</p>`}
    <button class="boton boton--suave" data-vista="pedidos">🚚 Volver a Pedidos</button>`;
}

async function borrarPedido(id) {
    const x = buscarPedido(id);
    if (!x || !confirm(`¿Borrar el pedido de ${x.cliente} (${x.producto})?`)) return;
    await datos.borrarDe("pedidosClientes", id);
    estado.pedidoEditando = null;
    aviso("Pedido borrado");
}

// ---------- Vista: Notas del equipo ----------
// Notas compartidas: todas las ven, escriben, editan y borran. Dos modos:
//  - "texto": título (opcional) y texto libre.
//  - "lista": título, descripción (opcional) e ítems que cualquiera va tildando.
// Cada nota tiene un tiempo de desaparición: pasado ese tiempo ya no se muestra (ni en Notas ni en Hoy).
// "Hasta que yo la quite" no vence y solo la puede borrar (o cambiarle el tiempo) quien la escribió.

const MAX_ITEMS = 100;
// [id, texto, días]
const DURACIONES = [["1d", "1 día", 1], ["3d", "3 días", 3], ["1s", "1 semana", 7], ["1m", "1 mes", 30], ["fija", "Hasta que yo la quite", 0]];
const itemVacio = () => ({ id: Math.random().toString(36).slice(2, 8), texto: "", hecho: false, hechoPor: "" });
const formNotaVacio = (tipo = "texto") => ({ tipo, titulo: "", texto: "", descripcion: "", duracion: "1s", items: [itemVacio()] });
const formularioNota = (cual) => (cual === "edicion" ? estado.edicionNotaEquipo : estado.formNotaEquipo);
const buscarNotaEquipo = (id) => estado.notasEquipo.find((n) => n.id === id);
// Quien la escribió (las chicas comparten cuenta: se compara también el nombre).
const esCreadora = (n) => !n.persona || (n.persona === estado.persona && (!n.uidCreadora || n.uidCreadora === datos.uidActual()));
const venceEn = (duracion) => {
    const dias = DURACIONES.find(([id]) => id === duracion)?.[2];
    return dias ? new Date(cal.ahora().getTime() + dias * 86400000).toISOString() : "";
};
const notasVigentes = () => estado.notasEquipo
    .filter((n) => !n.vence || n.vence > cal.ahora().toISOString())
    .sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
const cuandoLargo = (isoStr) => `${cal.fechaLarga(new Date(isoStr))} a las ${hora(isoStr)}`;

// Campos del formulario (nueva nota o edición): selector de modo, título y texto o ítems.
function camposNota(f, cual) {
    const modos = [["texto", "📝 Texto"], ["lista", "✅ Lista"]];
    return `
    <div class="filtros" role="group" aria-label="Tipo de nota">
        ${modos.map(([id, txt]) => `<button type="button" class="filtros__item ${f.tipo === id ? "is-activo" : ""}" data-nq-tipo="${id}" aria-pressed="${f.tipo === id}">${txt}</button>`).join("")}
    </div>
    <label><span>Título ${f.tipo === "texto" ? "<small>(opcional)</small>" : ""}</span>
        <input data-nq-campo="titulo" data-foco="nq-${cual}-titulo" maxlength="120" value="${esc(f.titulo)}"
            placeholder="${f.tipo === "lista" ? "Ej: Cosas para reponer" : "Ej: Horario del feriado"}">
    </label>
    ${cual === "nueva" || esCreadora(f) ? `
    <label>⏳ ¿Cuándo desaparece?
        <select data-nq-campo="duracion">
            ${DURACIONES.map(([id, txt]) => `<option value="${id}" ${f.duracion === id ? "selected" : ""}>${id === "fija" ? "📌 " : ""}${txt}</option>`).join("")}
        </select>
        ${f.duracion === "fija" ? `<small>Nadie más la puede borrar: queda hasta que vos la quites.</small>` : ""}
    </label>` : ""}
    ${f.tipo === "texto" ? `
    <label>Nota
        <textarea data-nq-campo="texto" data-foco="nq-${cual}-texto" rows="5" maxlength="3000"
            placeholder="Escribí lo que quieras compartir con el equipo…">${esc(f.texto)}</textarea>
    </label>` : `
    <label><span>Descripción <small>(opcional)</small></span>
        <textarea data-nq-campo="descripcion" data-foco="nq-${cual}-descripcion" rows="2" maxlength="500"
            placeholder="Para qué es la lista, hasta cuándo…">${esc(f.descripcion)}</textarea>
    </label>
    <div class="nq-items">
        <span class="nq-items__titulo">Ítems</span>
        ${f.items.map((it, i) => `
        <div class="nq-items__fila">
            <span class="nq-items__punto" aria-hidden="true"></span>
            <input data-nq-item="${i}" data-foco="nq-${cual}-item-${i}" maxlength="200" value="${esc(it.texto)}"
                placeholder="Ítem ${i + 1}" aria-label="Ítem ${i + 1}" enterkeyhint="next">
            <button type="button" class="nq-items__quitar" data-nq-quitar-item="${i}" aria-label="Quitar ítem ${i + 1}"><i class="ti ti-x" aria-hidden="true"></i></button>
        </div>`).join("")}
        ${f.items.length < MAX_ITEMS ? `<button type="button" class="boton boton--suave boton--chico" data-nq-agregar-item>➕ Agregar ítem</button>` : ""}
    </div>`}`;
}

// Cuándo desaparece la nota (o que queda hasta que la quite quien la escribió).
function venceTexto(n) {
    if (n.duracion === "fija") return `📌 Queda hasta que ${esCreadora(n) ? "vos la quites" : `${esc(nombre(n.persona))} la quite`}`;
    return n.vence ? `⏳ Desaparece el ${cuandoLargo(n.vence)}` : "";
}

// resumen: versión para "Hoy" (sin editar ni borrar).
function tarjetaNotaEquipo(n, { resumen = false } = {}) {
    if (!resumen && estado.edicionNotaEquipo?.id === n.id) {
        return `
        <article class="nota nota--equipo">
            <form class="formulario formulario--compacto" id="form-editar-nota-equipo" data-nq-form="edicion">
                ${camposNota(estado.edicionNotaEquipo, "edicion")}
                <div class="tarea__botones">
                    <button class="boton" type="submit">Guardar</button>
                    <button class="boton boton--suave" type="button" data-nq-cancelar>Cancelar</button>
                </div>
            </form>
        </article>`;
    }
    const items = n.items || [];
    const hechos = items.filter((it) => it.hecho).length;
    const completa = items.length && hechos === items.length;
    const cuerpo = n.tipo === "lista" ? `
        ${n.descripcion ? `<p class="nota__texto nq-descripcion">${esc(n.descripcion)}</p>` : ""}
        <ul class="nq-lista">
            ${items.map((it) => `
            <li>
                <button class="nq-lista__item ${it.hecho ? "is-hecho" : ""}" data-nq-tildar="${n.id}" data-item="${it.id}" aria-pressed="${!!it.hecho}">
                    <span class="check ${it.hecho ? "is-ok" : ""}" aria-hidden="true">${it.hecho ? `<i class="ti ti-check"></i>` : ""}</span>
                    <span class="nq-lista__texto">${esc(it.texto)}</span>
                    ${it.hecho && it.hechoPor ? `<small class="nq-lista__quien">${esc(nombre(it.hechoPor))}</small>` : ""}
                </button>
            </li>`).join("")}
        </ul>` : `<p class="nota__texto">${esc(n.texto)}</p>`;

    return `
    <article class="nota nota--equipo ${completa ? "is-completa" : ""}">
        ${n.titulo || n.tipo === "lista" ? `
        <header class="nq-cabecera">
            <h3 class="nq-cabecera__titulo">${n.tipo === "lista" ? "✅" : "📝"} ${esc(n.titulo)}</h3>
            ${n.tipo === "lista" ? `<span class="nq-cabecera__progreso">${hechos}/${items.length}</span>` : ""}
        </header>` : ""}
        ${cuerpo}
        <p class="nota__meta">✍️ ${esc(nombre(n.persona))} · ${cuandoLargo(n.creado)}${n.editada ? ` · editada por ${esc(nombre(n.editadaPor))}` : ""}</p>
        ${resumen ? "" : `
        <div class="nq-pie">
            <span class="nq-pie__vence">${venceTexto(n)}</span>
            <div class="nota__acciones">
                <button class="nota__borrar" data-nq-editar="${n.id}">Editar</button>
                ${n.duracion !== "fija" || esCreadora(n) ? `<button class="nota__borrar" data-nq-borrar="${n.id}">Borrar</button>` : ""}
            </div>
        </div>`}
    </article>`;
}

// "Hoy" de las chicas: las notas vigentes, abajo de todo.
function notasEquipoHoy() {
    const lista = notasVigentes();
    if (!lista.length) return "";
    return `
    <section class="momento">
        <h2 class="momento__titulo">🗒️ Notas del equipo</h2>
        ${lista.map((n) => tarjetaNotaEquipo(n, { resumen: true })).join("")}
        <button class="boton boton--suave" data-ir="notas">Ver o escribir notas</button>
    </section>`;
}

function vistaNotasEquipo() {
    if (!estado.formNotaEquipo) estado.formNotaEquipo = formNotaVacio();
    const lista = notasVigentes();
    return `
    <section class="encabezado">
        <h1>🗒️ Notas</h1>
        <p>Notas para todo el equipo: todas las pueden ver, editar y borrar. Escribí un texto o armá una lista para ir tildando. También aparecen abajo en "Hoy".</p>
    </section>
    <form class="formulario" id="form-nota-equipo" data-nq-form="nueva">
        <h2>➕ Nueva nota</h2>
        ${camposNota(estado.formNotaEquipo, "nueva")}
        <button class="boton boton--grande" type="submit">Guardar nota</button>
    </form>
    <section class="bloque">
        <h2 class="bloque__titulo">Notas del equipo · ${lista.length}</h2>
        ${lista.length ? lista.map(tarjetaNotaEquipo).join("") : `<p class="vacio">Todavía no hay notas. ¡Escribí la primera!</p>`}
    </section>`;
}

// Agrega un ítem vacío en la posición (o al final) y pone el cursor ahí.
function agregarItemForm(cual, pos) {
    const f = formularioNota(cual);
    if (f.items.length >= MAX_ITEMS) return aviso(`Una lista puede tener hasta ${MAX_ITEMS} ítems`);
    const i = pos ?? f.items.length;
    f.items.splice(i, 0, itemVacio());
    render();
    $app.querySelector(`[data-foco="nq-${cual}-item-${i}"]`)?.focus();
}

// Arma la nota a guardar a partir del formulario; null si falta algo. Los ítems vacíos se descartan.
function leerFormNota(f) {
    const base = { tipo: f.tipo, titulo: f.titulo.trim(), texto: "", descripcion: "", items: [], duracion: f.duracion, vence: venceEn(f.duracion) };
    if (f.tipo === "texto") {
        const texto = f.texto.trim();
        if (!texto) return aviso("Escribí la nota"), null;
        return { ...base, texto };
    }
    const items = f.items.map((it) => ({ ...it, texto: it.texto.trim() })).filter((it) => it.texto);
    if (!base.titulo) return aviso("Ponele un título a la lista"), null;
    if (!items.length) return aviso("Agregá al menos un ítem"), null;
    return { ...base, descripcion: f.descripcion.trim(), items };
}

// Guarda la nota completa con los cambios (el documento se reemplaza entero).
async function guardarNotaEquipo(n, cambios) {
    const { uid, ...resto } = n;
    await datos.guardarEn("notasEquipo", { ...resto, ...cambios });
}

async function agregarNotaEquipo() {
    const nueva = leerFormNota(estado.formNotaEquipo);
    if (!nueva) return;
    await datos.guardarEn("notasEquipo", {
        id: nuevoId("nota"), ...nueva, persona: estado.persona, uidCreadora: datos.uidActual(),
        creado: cal.ahora().toISOString(), editada: "", editadaPor: ""
    });
    estado.formNotaEquipo = formNotaVacio(nueva.tipo);
    aviso("Nota guardada ✓ La ve todo el equipo", "ok");
    render();
}

function editarNotaEquipo(id) {
    const n = buscarNotaEquipo(id);
    if (!n) return;
    const items = (n.items || []).map((it) => ({ ...it }));
    estado.edicionNotaEquipo = { ...formNotaVacio(n.tipo), ...n, duracion: n.duracion || "1s", items: items.length ? items : [itemVacio()] };
    render();
}

async function guardarEdicionNotaEquipo() {
    const n = buscarNotaEquipo(estado.edicionNotaEquipo.id);
    if (!n) {
        estado.edicionNotaEquipo = null;
        render();
        return aviso("Esa nota ya la borró otra persona");
    }
    const cambios = leerFormNota(estado.edicionNotaEquipo);
    if (!cambios) return;
    // El tiempo de desaparición lo cambia solo quien la escribió; si no lo cambió, sigue venciendo cuando estaba.
    if (!esCreadora(n) || cambios.duracion === n.duracion) Object.assign(cambios, { duracion: n.duracion, vence: n.vence });
    await guardarNotaEquipo(n, { ...cambios, editada: cal.ahora().toISOString(), editadaPor: estado.persona });
    estado.edicionNotaEquipo = null;
    aviso("Nota actualizada ✓", "ok");
    render();
}

async function tildarItem(id, itemId) {
    const n = buscarNotaEquipo(id);
    if (!n) return;
    const items = n.items.map((it) => (it.id !== itemId ? it : { ...it, hecho: !it.hecho, hechoPor: it.hecho ? "" : estado.persona }));
    await guardarNotaEquipo(n, { items });
}

async function borrarNotaEquipo(id) {
    const n = buscarNotaEquipo(id);
    if (n?.duracion === "fija" && !esCreadora(n)) return aviso(`Esta nota la puede quitar solo ${nombre(n.persona)}`);
    if (!n || !confirm(`¿Borrar la nota${n.titulo ? ` "${n.titulo}"` : ""}? Se borra para todo el equipo.`)) return;
    await datos.borrarDe("notasEquipo", id);
    if (estado.edicionNotaEquipo?.id === id) estado.edicionNotaEquipo = null;
    aviso("Nota borrada");
}

// ---------- Vista: Recordatorios ----------
// Cada recordatorio es DE quien lo anota y PARA quien se elige (las chicas o Carolina).
// Le aparece a la destinataria en su Hoy (a Carolina, en Actividad).
// Todas los ven. Los editan o borran quien lo anotó y la destinataria.
// Duran un tiempo (1 día … 1 mes, o hasta una fecha) o no vencen nunca. Los vencidos dejan de mostrarse.

// [id, texto]. Los tiempos fijos usan los mismos días que las notas del equipo (venceEn).
const DURACIONES_REC = [["sin", "♾️ Sin límite (hasta que lo borre)"], ["1d", "1 día"], ["3d", "3 días"], ["1s", "1 semana"], ["1m", "1 mes"], ["fecha", "📅 Hasta una fecha…"]];
// "persona" = para quién es. Por defecto, para quien lo está escribiendo.
const formRecordatorioVacio = () => ({ texto: "", duracion: "sin", fecha: "", persona: estado.persona });
const formularioRec = (cual) => (cual === "edicion" ? estado.edicionRecordatorio : estado.formRecordatorio);
const buscarRecordatorio = (id) => estado.recordatorios.find((r) => r.id === id);
// Con fecha elegida vence al terminar ese día.
const venceRecordatorio = (f) => (f.duracion === "fecha" ? new Date(`${f.fecha}T23:59:59`).toISOString() : venceEn(f.duracion));
const recordatoriosVigentes = () => estado.recordatorios
    .filter((r) => !r.vence || r.vence > cal.ahora().toISOString())
    .sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
const esParaMi = (r) => r.persona === estado.persona;
const puedeEditarRecordatorio = (r) => esParaMi(r) || r.autora === estado.persona;

function camposRecordatorio(f, cual) {
    return `
    <p class="rec-de"><strong>De:</strong> ${esc(nombre(f.autora || estado.persona))}${(f.autora || estado.persona) === estado.persona ? " (vos)" : ""}</p>
    <label>Para:
        <select data-rec-campo="persona">
            ${Object.keys(PERSONAS).map((id) => `<option value="${id}" ${f.persona === id ? "selected" : ""}>${esc(nombre(id))}${id === estado.persona ? " (vos)" : ""}</option>`).join("")}
        </select>
    </label>
    <label>¿Qué hay que recordar?
        <textarea data-rec-campo="texto" data-foco="rec-${cual}-texto" rows="3" maxlength="1000"
            placeholder="Ej: pedir el franco del sábado, llevar el cargador…">${esc(f.texto)}</textarea>
    </label>
    <label>⏳ ¿Por cuánto tiempo?
        <select data-rec-campo="duracion">
            ${DURACIONES_REC.map(([id, txt]) => `<option value="${id}" ${f.duracion === id ? "selected" : ""}>${txt}</option>`).join("")}
        </select>
    </label>
    ${f.duracion === "fecha" ? `
    <label>Hasta el día
        <input type="date" data-rec-campo="fecha" value="${esc(f.fecha)}" min="${cal.iso(cal.ahora())}">
    </label>` : ""}`;
}

function venceRecordatorioTexto(r) {
    if (r.duracion === "fecha" && r.fecha) return `📅 Hasta el ${cal.fechaLarga(cal.desdeIso(r.fecha))}`;
    return r.vence ? `⏳ Desaparece el ${cuandoLargo(r.vence)}` : "♾️ Sin límite: queda hasta que lo borren";
}

// resumen: versión para "Hoy" (sin editar ni borrar).
function tarjetaRecordatorio(r, { resumen = false } = {}) {
    if (!resumen && estado.edicionRecordatorio?.id === r.id) {
        return `
        <article class="nota nota--recordatorio">
            <form class="formulario formulario--compacto" id="form-editar-recordatorio" data-rec-form="edicion">
                ${camposRecordatorio(estado.edicionRecordatorio, "edicion")}
                <div class="tarea__botones">
                    <button class="boton" type="submit">Guardar</button>
                    <button class="boton boton--suave" type="button" data-rec-cancelar>Cancelar</button>
                </div>
            </form>
        </article>`;
    }
    return `
    <article class="nota nota--recordatorio ${esParaMi(r) ? "is-mio" : ""}">
        <p class="rec-depara">
            <span><strong>De:</strong> ${esc(nombre(r.autora))}</span>
            <span><strong>Para:</strong> ${esc(nombre(r.persona))}</span>
        </p>
        <p class="nota__texto">🔔 ${esc(r.texto)}</p>
        <p class="nota__meta">Anotado el ${cuandoLargo(r.creado)}${r.editado ? " · editado" : ""}</p>
        <div class="nq-pie">
            <span class="nq-pie__vence">${venceRecordatorioTexto(r)}</span>
            ${!resumen && puedeEditarRecordatorio(r) ? `
            <div class="nota__acciones">
                <button class="nota__borrar" data-rec-editar="${r.id}">Editar</button>
                <button class="nota__borrar" data-rec-borrar="${r.id}">Borrar</button>
            </div>` : ""}
        </div>
    </article>`;
}

// "Hoy" de las chicas y "Actividad" de Carolina: los recordatorios que son para ella y siguen vigentes.
function recordatoriosHoy() {
    const mios = recordatoriosVigentes().filter(esParaMi);
    if (!mios.length) return "";
    return `
    <section class="momento">
        <h2 class="momento__titulo">🔔 Tus recordatorios</h2>
        ${mios.map((r) => tarjetaRecordatorio(r, { resumen: true })).join("")}
        <button class="boton boton--suave" data-ir="recordatorios">Ver o anotar recordatorios</button>
    </section>`;
}

function vistaRecordatorios() {
    if (!estado.formRecordatorio) estado.formRecordatorio = formRecordatorioVacio();
    const lista = recordatoriosVigentes();
    return `
    <section class="encabezado">
        <h1>🔔 Recordatorios</h1>
        <p>Elegí para quién es: le aparece en su "Hoy" (a Carolina, en Actividad). Todo el equipo los ve, y los pueden editar o borrar quien lo anotó y a quien va dirigido.</p>
    </section>
    <form class="formulario" id="form-recordatorio" data-rec-form="nuevo">
        <h2>➕ Nuevo recordatorio</h2>
        ${camposRecordatorio(estado.formRecordatorio, "nuevo")}
        <button class="boton boton--grande" type="submit">Guardar recordatorio</button>
    </form>
    <section class="bloque">
        <h2 class="bloque__titulo">Recordatorios · ${lista.length}</h2>
        ${lista.length ? lista.map((r) => tarjetaRecordatorio(r)).join("") : `<p class="vacio">No hay recordatorios. Anotá el primero arriba.</p>`}
    </section>`;
}

// Arma el recordatorio a guardar a partir del formulario; null si falta algo.
function leerFormRecordatorio(f) {
    const texto = f.texto.trim();
    if (!texto) return aviso("Escribí el recordatorio"), null;
    if (f.duracion === "fecha" && !f.fecha) return aviso("Elegí hasta qué día"), null;
    if (f.duracion === "fecha" && f.fecha < cal.iso(cal.ahora())) return aviso("La fecha no puede ser anterior a hoy"), null;
    const fecha = f.duracion === "fecha" ? f.fecha : "";
    return { persona: f.persona, texto, duracion: f.duracion, fecha, vence: venceRecordatorio({ ...f, fecha }) };
}

async function agregarRecordatorio() {
    const nuevo = leerFormRecordatorio(estado.formRecordatorio);
    if (!nuevo) return;
    await datos.guardarEn("recordatorios", {
        id: nuevoId("rec"), ...nuevo, autora: estado.persona, creado: cal.ahora().toISOString(), editado: ""
    });
    estado.formRecordatorio = formRecordatorioVacio();
    const donde = (id) => (PERSONAS[id]?.rol === "duena" ? "Actividad" : "Hoy");
    aviso(nuevo.persona === estado.persona ? `Recordatorio guardado ✓ Te aparece en ${donde(nuevo.persona)}` : `Recordatorio guardado ✓ Le aparece a ${nombre(nuevo.persona)} en ${donde(nuevo.persona)}`, "ok");
    render();
}

function editarRecordatorio(id) {
    const r = buscarRecordatorio(id);
    if (!r || !puedeEditarRecordatorio(r)) return;
    estado.edicionRecordatorio = { ...formRecordatorioVacio(), ...r };
    render();
}

async function guardarEdicionRecordatorio() {
    const r = buscarRecordatorio(estado.edicionRecordatorio.id);
    if (!r) {
        estado.edicionRecordatorio = null;
        render();
        return aviso("Ese recordatorio ya no existe");
    }
    const cambios = leerFormRecordatorio(estado.edicionRecordatorio);
    if (!cambios) return;
    // Si no se cambió el tiempo, sigue desapareciendo cuando estaba previsto.
    if (cambios.duracion === r.duracion && cambios.fecha === (r.fecha || "")) cambios.vence = r.vence;
    const { uid, ...resto } = r;
    await datos.guardarEn("recordatorios", { ...resto, ...cambios, editado: cal.ahora().toISOString() });
    estado.edicionRecordatorio = null;
    aviso("Recordatorio actualizado ✓", "ok");
    render();
}

async function borrarRecordatorio(id) {
    const r = buscarRecordatorio(id);
    if (!r || !puedeEditarRecordatorio(r) || !confirm("¿Borrar este recordatorio?")) return;
    await datos.borrarDe("recordatorios", id);
    if (estado.edicionRecordatorio?.id === id) estado.edicionRecordatorio = null;
    aviso("Recordatorio borrado");
}

// ---------- Checklists (config.js > CHECKLISTS) ----------
// Se tildan cada día (lo tildado se guarda por día: al día siguiente arranca vacío).
// En Hoy aparece el del local donde está la persona según su turno; Carolina ve en Actividad cómo fue.

const checklistsDe = (persona) => CHECKLISTS.filter((c) => c.persona === persona);
const idChecklistDia = (c, fecha) => `${c.id}_${fecha}`;
const registroChecklist = (c, fecha) => estado.checklists.find((x) => x.id === idChecklistDia(c, fecha));
const cuentaChecklist = (c, fecha) => {
    const hechos = registroChecklist(c, fecha)?.hechos || {};
    return c.items.filter((it) => hechos[it.id]).length;
};

// editable: se puede tildar (solo la dueña del checklist, y solo el día de hoy).
function tarjetaChecklist(c, fecha, { editable = false } = {}) {
    const registro = registroChecklist(c, fecha);
    const hechos = registro?.hechos || {};
    const n = cuentaChecklist(c, fecha);
    const completo = n === c.items.length;
    const esSabado = cal.desdeIso(fecha).getDay() === 6;
    return `
    <article class="nota nota--equipo checklist ${completo ? "is-completa" : ""}">
        <header class="nq-cabecera">
            <h3 class="nq-cabecera__titulo">${c.icono} ${esc(c.titulo)}</h3>
            <span class="nq-cabecera__progreso">${n}/${c.items.length}</span>
        </header>
        <ul class="nq-lista">
            ${c.items.map((it) => {
                const hecho = hechos[it.id];
                const contenido = `
                    <span class="check ${hecho ? "is-ok" : ""}" aria-hidden="true">${hecho ? `<i class="ti ti-check"></i>` : ""}</span>
                    <span class="nq-lista__texto">${esc(it.texto)}${it.sabado && esSabado && !hecho ? `<strong class="checklist__sabado">⚠️ ${esc(it.sabado)}</strong>` : ""}</span>
                    ${hecho ? `<small class="nq-lista__quien">${hora(hecho)}</small>` : ""}`;
                return `
            <li>${editable
                    ? `<button class="nq-lista__item ${hecho ? "is-hecho" : ""}" data-check-tildar="${c.id}" data-item="${it.id}" aria-pressed="${!!hecho}">${contenido}</button>`
                    : `<div class="nq-lista__item checklist__fijo ${hecho ? "is-hecho" : ""}">${contenido}</div>`}</li>`;
            }).join("")}
        </ul>
        ${completo ? `<p class="checklist__listo">🎉 ¡Completo!${registro?.completoEn ? ` Terminado a las ${hora(registro.completoEn)}` : ""}</p>` : ""}
    </article>`;
}

// "Hoy": el checklist del local donde está ahora (los demás de hoy, resumidos). Domingo no hay.
function checklistsHoy() {
    const hoy = cal.ahora();
    const mios = checklistsDe(estado.persona);
    if (!mios.length || hoy.getDay() === 0) return "";
    const fecha = cal.iso(hoy);
    const local = cal.dondeEsta(estado.persona, hoy)?.local;
    const actual = mios.find((c) => c.local === local) || mios[0];
    const otros = mios.filter((c) => c !== actual);
    return `
    <section class="momento">
        <h2 class="momento__titulo">✅ Tu checklist</h2>
        ${tarjetaChecklist(actual, fecha, { editable: true })}
        ${otros.map((c) => {
            const n = cuentaChecklist(c, fecha);
            return `<button class="boton boton--suave" data-ir="checklist">${c.icono} ${esc(c.titulo)}: ${n}/${c.items.length}${n === c.items.length ? " ✓" : ""}</button>`;
        }).join("")}
    </section>`;
}

function vistaChecklist() {
    const hoyIso = cal.iso(cal.ahora());
    const fecha = estado.fechaChecklist || hoyIso;
    const lista = esDuena() ? CHECKLISTS : checklistsDe(estado.persona);
    return `
    <section class="encabezado">
        <h1>✅ Checklist</h1>
        <p>${esDuena()
            ? "Lo que tildó cada una en su checklist. Elegí un día para ver cómo fue."
            : "Tildá cada cosa a medida que la hacés. Todos los días arranca vacío."}</p>
        <label class="checklist__dia">📅 Día
            <input type="date" data-check-fecha value="${fecha}" max="${hoyIso}">
        </label>
    </section>
    ${lista.length ? lista.map((c, i) => `
    ${esDuena() && c.persona !== lista[i - 1]?.persona ? `<h2 class="bloque__titulo">${esc(nombre(c.persona))}</h2>` : ""}
    ${tarjetaChecklist(c, fecha, { editable: !esDuena() && c.persona === estado.persona && fecha === hoyIso })}`).join("")
        : `<p class="vacio">No tenés checklists.</p>`}`;
}

async function tildarChecklist(id, itemId) {
    const c = CHECKLISTS.find((x) => x.id === id);
    if (!c || c.persona !== estado.persona) return;
    const ahora = cal.ahora();
    const fecha = cal.iso(ahora);
    const previo = registroChecklist(c, fecha);
    const hechos = { ...(previo?.hechos || {}) };
    if (hechos[itemId]) delete hechos[itemId];
    else hechos[itemId] = ahora.toISOString();
    const completo = c.items.every((it) => hechos[it.id]);
    await datos.guardarEn("checklists", {
        id: idChecklistDia(c, fecha), checklist: c.id, persona: c.persona, local: c.local, fecha, hechos, completo,
        completoEn: completo ? previo?.completoEn || ahora.toISOString() : "", actualizado: ahora.toISOString()
    });
    if (completo && !previo?.completo) aviso(`🎉 ¡Checklist ${c.titulo} completo!`, "ok");
}

// ---------- Vista: Bloc de notas (Carolina) ----------

function vistaNotas() {
    const lista = [...estado.notasDuena].sort(masNuevoPrimero);
    return `
    <section class="encabezado">
        <h1>🔒 Mi bloc privado</h1>
        <p>Tu bloc de notas. Solo lo ves vos. Para escribirle algo al equipo, usá <strong>Notas</strong>.</p>
    </section>
    <form class="formulario" id="form-notas">
        <label>Nueva nota
            <textarea data-nota-duena data-foco="nota-duena" rows="5" maxlength="3000" required
                placeholder="Anotá lo que quieras…">${esc(estado.textoNotaDuena)}</textarea>
        </label>
        <button class="boton boton--grande" type="submit">Guardar nota</button>
    </form>
    <section class="bloque">
        <h2 class="bloque__titulo">Guardadas</h2>
        ${lista.length ? lista.map((n) => `
        <article class="nota">
            <p class="nota__meta">${diaCorto(n.cuando)} · ${hora(n.cuando)}${n.editada ? " · editada" : ""}</p>
            ${editandoNota("notasDuena", n.id) ? formEditarNota() : `
            <p class="nota__texto">${esc(n.texto)}</p>
            <div class="nota__acciones">
                <button class="nota__borrar" data-editar-nota="notasDuena" data-id="${n.id}">Editar</button>
                <button class="nota__borrar" data-borrar-nota-duena="${n.id}">Borrar</button>
            </div>`}
        </article>`).join("") : `<p class="vacio">Todavía no escribiste ninguna nota.</p>`}
    </section>`;
}

async function guardarNotaDuena() {
    const texto = estado.textoNotaDuena.trim();
    if (!texto) return aviso("Escribí algo");
    await datos.guardarEn("notasDuena", { id: nuevoId("nota"), texto, cuando: cal.ahora().toISOString() });
    estado.textoNotaDuena = "";
    aviso("Nota guardada ✓");
    render();
}

// Si algo no se pudo guardar o leer (sin conexión, reglas de Firebase…), avisarlo en vez de fallar en silencio.
const avisoError = (codigo, accion) => aviso(codigo === "permission-denied"
    ? `⚠️ No se pudo ${accion}: Firebase no dio permiso (revisar las reglas)`
    : `⚠️ No se pudo ${accion}${codigo ? ` (${codigo})` : ""}. Probá de nuevo.`, "aplazada");
window.addEventListener("unhandledrejection", (e) => {
    console.error(e.reason);
    avisoError(e.reason?.code || "", "guardar");
});
window.addEventListener("cr-error-lectura", (e) => avisoError(e.detail.codigo, `cargar ${e.detail.coleccion}`));

extras.iniciarExtras({ estado, render, aviso, esc, nombre, esDuena, nuevoId, hora });

// Demo: la primera vez carga datos de ejemplo para que la app no arranque vacía.
if (datos.modoPrueba) sembrarDemo();
iniciar();
