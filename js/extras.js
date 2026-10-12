// ============================================
// Funciones traídas de Restix (12/10/2026), con el mismo motor de datos que el resto de la app:
//  - Stock con mínimo: cuánto queda de cada insumo por local; lo que llega al mínimo aparece como faltante.
//  - Producción del día: encargos con hora de entrega; la tarjeta se pone amarilla y roja cuando se acerca la hora.
//  - Cierre de caja por turno: lo contado contra lo vendido, con la diferencia.
// Colecciones: "stock" (id = <local>_<insumo>), "produccion" y "cajas" (id = <local>_<fecha>_<turno>).
// ============================================
import { PERSONAS, LOCALES, INSUMOS, PRODUCCION, CAJA } from "./config.js";
import * as cal from "./calendario.js";
import * as datos from "./datos.js";
import { resumenSalonDuena, cobradoEnTurno } from "./salon.js";
import { puede as puedeEquipo } from "./equipo.js";

// Lo que se usa de app.js: { estado, render, aviso, esc, nombre, esDuena, nuevoId, hora }
let c;

export function iniciarExtras(contexto) {
    c = contexto;
    Object.assign(c.estado, {
        stock: [], produccion: [], cajas: [],
        localStock: null,        // local que se ve en Stock
        filtroProd: null,        // local que se ve en Producción ("todos" | id)
        fechaProd: null,         // día que se ve en Producción ("YYYY-MM-DD"; null = hoy)
        formProd: null,          // nuevo encargo
        formCaja: null           // cierre de caja que se está cargando
    });
}

export function escucharExtras() {
    for (const col of ["stock", "produccion", "cajas"]) {
        datos.escucharColeccion(col, (lista) => { c.estado[col] = lista; c.render(); });
    }
    // Los colores de Producción dependen de la hora: se redibuja cada minuto (si no se está escribiendo).
    setInterval(() => {
        const escribiendo = document.activeElement?.matches("input, textarea, select");
        if (["produccion", "hoy", "actividad"].includes(c.estado.vista) && !escribiendo) c.render();
    }, 60000);
}

const esc = (s) => c.esc(s);
const ahora = () => cal.ahora();
const hoyIso = () => cal.iso(ahora());
const pesos = (n) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const leerNumero = (v) => Number(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0;
const localDeHoy = () => cal.dondeEsta(c.estado.persona, ahora())?.local || Object.keys(LOCALES)[0];
const puesto = () => PERSONAS[c.estado.persona]?.puesto || "";
const nombreTurno = (t) => (t === "manana" ? "mañana" : "tarde");

/** Las pantallas nuevas para el menú "Más": [vista, ícono, texto]. Caja: la moza y la dueña. */
export function menuExtras() {
    return [
        ["produccion", "cake", "Producción del día"],
        ["stock", "packages", "Stock"],
        ["caja", "cash", "Cierre de caja"]
    ].filter(([id]) => puede(id));
}

// Botones para elegir local (y "Todos" si se pide).
function filtroLocales(actual, atributo, { todos = false } = {}) {
    if (Object.keys(LOCALES).length < 2) return ""; // con un solo local no hace falta elegir
    const opciones = [...(todos ? [["todos", "Todos"]] : []), ...Object.entries(LOCALES).map(([id, l]) => [id, l.nombre])];
    return `
    <div class="filtros">
        ${opciones.map(([id, txt]) => `<button class="filtros__item ${actual === id ? "is-activo" : ""}" ${atributo}="${id}">${txt}</button>`).join("")}
    </div>`;
}

// ============================================
// Stock con mínimo
// ============================================

const docStock = (local, insumo) => c.estado.stock.find((x) => x.id === `${local}_${insumo}`);
const cantidad = (local, insumo) => docStock(local, insumo)?.cantidad ?? null;

/** Insumos de un local que están en el mínimo o por debajo (los que todavía no tienen dato, no cuentan). */
export function faltantes(local) {
    return INSUMOS.filter((i) => {
        const q = cantidad(local, i.id);
        return q !== null && q <= i.minimo;
    });
}

export function vistaStock() {
    const local = c.estado.localStock || (c.esDuena() ? Object.keys(LOCALES)[0] : localDeHoy());
    const bajos = faltantes(local).length;
    return `
    <section class="encabezado">
        <h1>📦 Stock</h1>
        <p>Cuánto queda de cada cosa. Tocá − cuando se usa y + cuando llega mercadería. Lo que queda en el mínimo
        aparece como faltante en "Hoy" de quien está en el local y en Actividad de los encargados.</p>
    </section>
    ${filtroLocales(local, "data-stock-local")}
    ${bajos ? `<p class="stock__resumen">⚠️ ${bajos === 1 ? "1 cosa para pedir" : `${bajos} cosas para pedir`} en ${LOCALES[local].nombre}</p>` : ""}
    <ul class="stock">
        ${INSUMOS.map((i) => {
            const d = docStock(local, i.id);
            const q = d?.cantidad ?? null;
            const bajo = q !== null && q <= i.minimo;
            return `
            <li class="stock__fila ${bajo ? "is-bajo" : ""}">
                <div class="stock__nombre">
                    <strong>${esc(i.nombre)}</strong>
                    <small>Mínimo: ${i.minimo} ${esc(i.unidad)}${d?.persona ? ` · tocó ${esc(c.nombre(d.persona))} a las ${c.hora(d.actualizado)}` : ""}</small>
                    ${bajo ? `<span class="stock__alerta">⚠️ Hay que pedir</span>` : ""}
                </div>
                <div class="stock__control">
                    <button class="stock__boton" data-stock-cambiar="${i.id}" data-delta="${-i.paso}" ${puede("ajustarStock") ? "" : "disabled"} aria-label="Restar ${i.paso} de ${esc(i.nombre)}">−</button>
                    <span class="stock__cantidad">${q ?? "—"}<small>${esc(i.unidad)}</small></span>
                    <button class="stock__boton" data-stock-cambiar="${i.id}" data-delta="${i.paso}" ${puede("ajustarStock") ? "" : "disabled"} aria-label="Sumar ${i.paso} de ${esc(i.nombre)}">+</button>
                </div>
            </li>`;
        }).join("")}
    </ul>`;
}

async function cambiarStock(insumoId, delta) {
    if (!puede("ajustarStock")) return c.aviso("No tenés permiso para cambiar el stock");
    const local = c.estado.localStock || (c.esDuena() ? Object.keys(LOCALES)[0] : localDeHoy());
    const insumo = INSUMOS.find((i) => i.id === insumoId);
    const antes = cantidad(local, insumoId) ?? 0;
    const nueva = Math.max(0, antes + delta);
    if (nueva === antes && delta < 0) return;
    await datos.guardarEn("stock", {
        id: `${local}_${insumoId}`, local, insumo: insumoId, cantidad: nueva,
        persona: c.estado.persona, actualizado: ahora().toISOString()
    });
    if (antes > insumo.minimo && nueva <= insumo.minimo) c.aviso(`⚠️ ${insumo.nombre} quedó en el mínimo: hay que pedir`, "aplazada");
}

// ============================================
// Producción del día
// ============================================

// Estados de un encargo: "pendiente" (cocina lo tiene que hacer) → "listo" (para entregar) → "entregado" (se lo llevó el cliente).
const puede = (permiso) => puedeEquipo(permiso, c.estado.persona);
const terminado = (p) => p.estado === "listo" || p.estado === "entregado";

const minutosQueFaltan = (p) => Math.round((new Date(`${p.fecha}T${p.hora}`) - ahora()) / 60000);

function nivel(p) {
    if (terminado(p) || p.fecha !== hoyIso()) return "";
    const m = minutosQueFaltan(p);
    if (m <= PRODUCCION.MINUTOS_ROJO) return "rojo";
    if (m <= PRODUCCION.MINUTOS_AMARILLO) return "amarillo";
    return "";
}

function textoTiempo(p) {
    if (p.fecha !== hoyIso()) return "";
    const m = minutosQueFaltan(p);
    if (m < 0) return `⏰ Se pasó la hora (hace ${-m} min)`;
    if (m < 60) return `⏳ Faltan ${m} min`;
    return `Faltan ${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim();
}

const formProdVacio = (local) => ({ fecha: hoyIso(), hora: "", producto: "", cantidad: "1", local, nota: "" });

// compacta = resumen en "Hoy"; entrega = resumen de la moza con el botón "Entregado".
function tarjetaProduccion(p, { compacta = false, entrega = false } = {}) {
    const listo = terminado(p);
    const entregado = p.estado === "entregado";
    return `
    <article class="prod prod--${nivel(p) || "normal"} ${entregado ? "is-entregado" : listo ? "is-listo" : ""}">
        <p class="prod__hora">${esc(p.hora)}</p>
        <div class="prod__cuerpo">
            <p class="prod__producto">${esc(p.cantidad)} × ${esc(p.producto)}</p>
            <p class="prod__meta">${esc(LOCALES[p.local]?.nombre || "")}${entregado
                ? ` · 📦 Entregado${p.entregadoPor ? ` (${esc(c.nombre(p.entregadoPor))}, ${c.hora(p.entregadoEn)})` : ""}`
                : listo
                ? ` · ✅ Listo para entregar${p.listoPor ? ` (${esc(c.nombre(p.listoPor))}, ${c.hora(p.listoEn)})` : ""}`
                : textoTiempo(p) ? ` · ${textoTiempo(p)}` : ""}</p>
            ${!compacta && p.nota ? `<p class="prod__nota">🗒️ ${esc(p.nota)}</p>` : ""}
            ${!compacta ? `<p class="prod__meta">Anotó ${esc(c.nombre(p.persona))}</p>` : ""}
        </div>
        ${entrega ? `<button class="boton" data-prod-entregado="${p.id}">📦 Entregado</button>`
            : compacta ? "" : entregado
            ? `<button class="boton boton--suave" data-prod-a-listo="${p.id}">Deshacer</button>`
            : listo
            ? `<div class="prod__acciones">
                <button class="boton" data-prod-entregado="${p.id}">📦 Entregado</button>
                <button class="boton boton--suave" data-prod-deshacer="${p.id}">Deshacer</button>
            </div>`
            : `<div class="prod__acciones">
                <button class="boton" data-prod-listo="${p.id}">✓ Listo</button>
                <button class="producto__editar" data-prod-borrar="${p.id}" aria-label="Borrar ${esc(p.producto)}">🗑️</button>
            </div>`}
    </article>`;
}

const ordenPorHora = (a, b) => a.hora.localeCompare(b.hora);

export function vistaProduccion() {
    const e = c.estado;
    const fecha = e.fechaProd || hoyIso();
    const filtro = e.filtroProd || (c.esDuena() ? "todos" : localDeHoy());
    if (!e.formProd) e.formProd = formProdVacio(filtro === "todos" ? Object.keys(LOCALES)[0] : filtro);
    const f = e.formProd;
    const delDia = e.produccion.filter((p) => p.fecha === fecha && (filtro === "todos" || p.local === filtro));
    const pendientes = delDia.filter((p) => !terminado(p)).sort(ordenPorHora);
    const listos = delDia.filter((p) => p.estado === "listo").sort(ordenPorHora);
    const entregados = delDia.filter((p) => p.estado === "entregado").sort(ordenPorHora);
    const esHoy = fecha === hoyIso();

    return `
    <section class="encabezado">
        <h1>🍰 Producción del día</h1>
        <p>Tortas y encargos con su hora de entrega. La tarjeta se pone amarilla cuando falta menos de
        ${PRODUCCION.MINUTOS_AMARILLO} minutos y roja cuando faltan ${PRODUCCION.MINUTOS_ROJO} o ya se pasó la hora.</p>
    </section>
    ${filtroLocales(filtro, "data-prod-local", { todos: true })}
    <label class="prod__dia">📅 Día
        <input type="date" data-prod-fecha value="${fecha}">
    </label>
    <section class="momento">
        <h2 class="momento__titulo">${esHoy ? "Para hoy" : cal.fechaLarga(cal.desdeIso(fecha))}${pendientes.length ? ` · ${pendientes.length} por hacer` : ""}</h2>
        ${pendientes.length ? pendientes.map((p) => tarjetaProduccion(p)).join("") : `<p class="momento__vacio momento__vacio--ok">🎉 No hay nada pendiente para este día.</p>`}
    </section>
    ${listos.length ? `
    <section class="momento">
        <h2 class="momento__titulo">🎂 Encargos listos para entregar</h2>
        ${listos.map((p) => tarjetaProduccion(p)).join("")}
    </section>` : ""}
    ${entregados.length ? `
    <section class="momento">
        <h2 class="momento__titulo">📦 Entregados</h2>
        ${entregados.map((p) => tarjetaProduccion(p)).join("")}
    </section>` : ""}
    <form class="formulario" id="form-produccion">
        <h2>➕ Nuevo encargo</h2>
        <label>Producto
            <input data-prod-campo="producto" data-foco="prod-producto" maxlength="120" required value="${esc(f.producto)}" placeholder="Ej: torta Rogel para 15 personas">
        </label>
        <div class="formulario__fila">
            <label>Cantidad
                <input data-prod-campo="cantidad" data-foco="prod-cantidad" type="number" min="1" max="999" required value="${esc(f.cantidad)}">
            </label>
            <label>Local
                <select data-prod-campo="local">
                    ${Object.entries(LOCALES).map(([id, l]) => `<option value="${id}" ${id === f.local ? "selected" : ""}>${l.nombre}</option>`).join("")}
                </select>
            </label>
        </div>
        <div class="formulario__fila">
            <label>Día
                <input data-prod-campo="fecha" type="date" required value="${esc(f.fecha)}">
            </label>
            <label>Hora de entrega
                <input data-prod-campo="hora" data-foco="prod-hora" type="time" required value="${esc(f.hora)}">
            </label>
        </div>
        <label>Nota (opcional)
            <input data-prod-campo="nota" data-foco="prod-nota" maxlength="200" value="${esc(f.nota)}" placeholder="Ej: sin nueces, con el cartel de feliz cumple">
        </label>
        <button class="boton boton--grande" type="submit">Agregar a producción</button>
    </form>`;
}

async function agregarProduccion() {
    const f = c.estado.formProd;
    const producto = f.producto.trim();
    const cant = Math.round(Number(f.cantidad));
    if (!producto) return c.aviso("Escribí qué hay que preparar");
    if (!f.hora) return c.aviso("Poné la hora de entrega");
    if (!(cant >= 1 && cant <= 999)) return c.aviso("La cantidad tiene que ser 1 o más");
    await datos.guardarEn("produccion", {
        id: c.nuevoId("prod"), local: f.local, fecha: f.fecha || hoyIso(), hora: f.hora, producto, cantidad: cant,
        nota: f.nota.trim(), estado: "pendiente", persona: c.estado.persona, creado: ahora().toISOString(), listoPor: "", listoEn: ""
    });
    c.estado.formProd = { ...formProdVacio(f.local), fecha: f.fecha };
    c.aviso("Encargo agregado a producción ✓", "ok");
    c.render();
}

async function marcarProduccion(id, listo) {
    const p = c.estado.produccion.find((x) => x.id === id);
    if (!p) return;
    const { uid, ...resto } = p;
    await datos.guardarEn("produccion", {
        ...resto, estado: listo ? "listo" : "pendiente",
        listoPor: listo ? c.estado.persona : "", listoEn: listo ? ahora().toISOString() : "",
        entregadoPor: "", entregadoEn: ""
    });
    if (listo) c.aviso(`✅ ${p.producto}: listo para entregar`, "ok");
}

// La moza (o quien sea) marca que el cliente ya se lo llevó; "Deshacer" lo vuelve a "listo".
async function marcarEntregado(id, entregado) {
    const p = c.estado.produccion.find((x) => x.id === id);
    if (!p) return;
    const { uid, ...resto } = p;
    await datos.guardarEn("produccion", {
        ...resto, estado: entregado ? "entregado" : "listo",
        entregadoPor: entregado ? c.estado.persona : "", entregadoEn: entregado ? ahora().toISOString() : ""
    });
    if (entregado) c.aviso(`📦 ${p.producto}: entregado`, "ok");
}

async function borrarProduccion(id) {
    const p = c.estado.produccion.find((x) => x.id === id);
    if (p && confirm(`¿Borrar "${p.producto}" de producción?`)) await datos.borrarDe("produccion", id);
}

// ============================================
// Cierre de caja por turno
// ============================================

const idCaja = (local, fecha, turno) => `${local}_${fecha}_${turno}`;

// Diferencia = lo que entró (efectivo sin el fondo, más lo que se pagó de gastos con ese efectivo,
// más transferencias y tarjetas) menos lo vendido según la registradora. Positivo = sobra; negativo = falta.
const diferenciaDe = (x) => (x.efectivo - x.fondo + x.gastos) + x.transferencias + x.tarjetas - x.vendido;

function estadoDiferencia(d) {
    if (Math.abs(d) <= CAJA.tolerancia) return { clase: "ok", texto: `✅ Cerró bien${d ? ` (${d > 0 ? "+" : "−"}${pesos(Math.abs(d))})` : ""}` };
    return d > 0 ? { clase: "sobra", texto: `⬆️ Sobran ${pesos(d)}` } : { clase: "falta", texto: `⚠️ Faltan ${pesos(-d)}` };
}

const CAMPOS_CAJA = [
    ["vendido", "Total vendido según la registradora"],
    ["efectivo", "Efectivo contado en la caja (con el fondo)"],
    ["transferencias", "Transferencias y QR"],
    ["tarjetas", "Débito y crédito"],
    ["gastos", "Gastos pagados con el efectivo de la caja"]
];

// Arma el formulario del local y turno elegidos; si ese cierre ya existe, lo trae para corregirlo.
function cargarFormCaja(local, turno, fecha = hoyIso()) {
    const previo = c.estado.cajas.find((x) => x.id === idCaja(local, fecha, turno));
    c.estado.formCaja = previo
        ? { local, turno, fecha, nota: previo.nota || "", ...Object.fromEntries(["fondo", ...CAMPOS_CAJA.map(([k]) => k)].map((k) => [k, String(previo[k] ?? "")])), existe: true }
        : { local, turno, fecha, fondo: String(CAJA.fondo), vendido: "", efectivo: "", transferencias: "", tarjetas: "", gastos: "", nota: "", existe: false };
}

const numerosCaja = (f) => Object.fromEntries(["fondo", ...CAMPOS_CAJA.map(([k]) => k)].map((k) => [k, leerNumero(f[k])]));

export function vistaCaja() {
    const e = c.estado;
    if (!e.formCaja || e.formCaja.fecha !== hoyIso()) {
        const local = c.esDuena() ? Object.keys(LOCALES)[0] : localDeHoy();
        cargarFormCaja(local, cal.turnoActual(local, ahora()));
    }
    const f = e.formCaja;
    const d = diferenciaDe(numerosCaja(f));
    const est = estadoDiferencia(d);
    const desde = cal.iso(cal.sumarDias(ahora(), -7));
    const ultimos = e.cajas.filter((x) => x.fecha >= desde).sort((a, b) => (b.cuando || "").localeCompare(a.cuando || ""));

    return `
    <section class="encabezado">
        <h1>💵 Cierre de caja</h1>
        <p>Al terminar el turno, anotá lo que dice la registradora y lo que contaste. La app calcula si sobra o falta,
        y los encargados lo ven en Actividad.</p>
    </section>
    <form class="formulario" id="form-caja">
        <h2>${f.existe ? "✏️ Corregir el cierre" : "🧮 Cierre de hoy"}</h2>
        <div class="formulario__fila">
            <label>Local
                <select data-caja-elegir="local">
                    ${Object.entries(LOCALES).map(([id, l]) => `<option value="${id}" ${id === f.local ? "selected" : ""}>${l.nombre}</option>`).join("")}
                </select>
            </label>
            <label>Turno
                <select data-caja-elegir="turno">
                    ${["manana", "tarde"].map((t) => `<option value="${t}" ${t === f.turno ? "selected" : ""}>${nombreTurno(t)}</option>`).join("")}
                </select>
            </label>
        </div>
        <label>Fondo de cambio con el que arrancó
            <input data-caja-campo="fondo" data-foco="caja-fondo" inputmode="numeric" value="${esc(f.fondo)}" placeholder="Ej: ${CAJA.fondo}">
        </label>
        ${CAMPOS_CAJA.map(([k, txt]) => `
        <label>${txt}
            <input data-caja-campo="${k}" data-foco="caja-${k}" inputmode="numeric" value="${esc(f[k])}" placeholder="$ 0">
        </label>`).join("")}
        ${(() => {
            const cobrado = cobradoEnTurno(f.local, f.fecha, f.turno);
            if (!cobrado.mesas) return "";
            return `
        <div class="caja__mesas">
            <p><strong>🍽️ Cobrado por mesas en este turno: ${pesos(cobrado.total)}</strong> (${cobrado.mesas} mesa${cobrado.mesas === 1 ? "" : "s"})</p>
            <p class="caja__detalle">Efectivo ${pesos(cobrado.porMedio.efectivo)} · Transferencias y QR ${pesos(cobrado.porMedio.transferencias)} · Tarjetas ${pesos(cobrado.porMedio.tarjetas)}</p>
            <button class="boton boton--suave" type="button" data-caja-usar-mesas="${cobrado.total}">Usar como "total vendido"</button>
        </div>`;
        })()}
        <p class="caja__diferencia caja__diferencia--${est.clase}" id="caja-diferencia">${est.texto}</p>
        <label>Nota (opcional)
            <input data-caja-campo="nota" data-foco="caja-nota" maxlength="200" value="${esc(f.nota)}" placeholder="Ej: pagué $3.000 de hielo al proveedor">
        </label>
        <button class="boton boton--grande" type="submit">${f.existe ? "Guardar cambios" : "Guardar cierre"}</button>
    </form>
    <section class="momento">
        <h2 class="momento__titulo">Últimos 7 días</h2>
        ${ultimos.length ? ultimos.map((x) => tarjetaCaja(x)).join("") : `<p class="vacio">Todavía no hay cierres anotados.</p>`}
    </section>`;
}

function tarjetaCaja(x, { compacta = false } = {}) {
    const est = estadoDiferencia(x.diferencia);
    return `
    <article class="caja caja--${est.clase}">
        <p class="caja__titulo"><strong>${esc(LOCALES[x.local]?.nombre || "")}</strong> · ${cal.fechaLarga(cal.desdeIso(x.fecha))} · turno ${nombreTurno(x.turno)}</p>
        <p class="caja__diferencia caja__diferencia--${est.clase}">${est.texto}</p>
        ${compacta ? "" : `<p class="caja__detalle">Vendido ${pesos(x.vendido)} · Efectivo ${pesos(x.efectivo)} (fondo ${pesos(x.fondo)}) · Transferencias ${pesos(x.transferencias)} · Tarjetas ${pesos(x.tarjetas)}${x.gastos ? ` · Gastos ${pesos(x.gastos)}` : ""}</p>`}
        ${!compacta && x.nota ? `<p class="caja__detalle">🗒️ ${esc(x.nota)}</p>` : ""}
        <p class="caja__detalle">Cerró ${esc(c.nombre(x.persona))}${x.cuando ? ` a las ${c.hora(x.cuando)}` : ""}</p>
        ${!compacta && c.esDuena() ? `<button class="producto__editar" data-caja-borrar="${x.id}" aria-label="Borrar este cierre">🗑️</button>` : ""}
    </article>`;
}

async function guardarCaja() {
    const f = c.estado.formCaja;
    const n = numerosCaja(f);
    if (!f.vendido.trim() || !f.efectivo.trim()) return c.aviso("Completá lo vendido y el efectivo contado");
    const diferencia = diferenciaDe(n);
    await datos.guardarEn("cajas", {
        id: idCaja(f.local, f.fecha, f.turno), local: f.local, fecha: f.fecha, turno: f.turno, ...n, diferencia,
        nota: f.nota.trim(), persona: c.estado.persona, cuando: ahora().toISOString()
    });
    f.existe = true;
    c.aviso(`Cierre guardado · ${estadoDiferencia(diferencia).texto}`, Math.abs(diferencia) <= CAJA.tolerancia ? "ok" : "aplazada");
    c.render();
}

// ============================================
// Avisos en "Hoy" (empleadas) y resumen en Actividad (dueña)
// ============================================

export function avisosExtrasHoy() {
    const local = localDeHoy();
    const bajos = faltantes(local);
    const deHoy = c.estado.produccion.filter((p) => p.fecha === hoyIso() && p.local === local).sort(ordenPorHora);
    const prod = puede("produccionHoy") ? deHoy.filter((p) => !terminado(p)) : [];
    const paraEntregar = puede("produccionHoy") ? [] : deHoy.filter((p) => p.estado === "listo");
    return `
    ${paraEntregar.length ? `
    <section class="momento">
        <h2 class="momento__titulo">🎂 Encargos listos para entregar · ${paraEntregar.length}</h2>
        ${paraEntregar.map((p) => tarjetaProduccion(p, { entrega: true })).join("")}
    </section>` : ""}
    ${prod.length ? `
    <section class="momento">
        <h2 class="momento__titulo">🍰 Producción de hoy · ${prod.length} por hacer</h2>
        ${prod.slice(0, 3).map((p) => tarjetaProduccion(p, { compacta: true })).join("")}
        <button class="boton boton--suave" data-ir="produccion">Ver producción</button>
    </section>` : ""}
    ${bajos.length ? `
    <section class="momento">
        <h2 class="momento__titulo">⚠️ Faltantes en ${esc(LOCALES[local].nombre)}</h2>
        <p class="stock__chips">${bajos.map((i) => `<span class="stock__chip">${esc(i.nombre)}: ${cantidad(local, i.id)} ${esc(i.unidad)}</span>`).join("")}</p>
        <button class="boton boton--suave" data-ir="stock">Ver stock</button>
    </section>` : ""}`;
}

export function resumenExtrasDuena() {
    const hoy = hoyIso();
    const desde = cal.iso(cal.sumarDias(ahora(), -3));
    const filas = Object.entries(LOCALES).map(([id, l]) => {
        const bajos = faltantes(id);
        const prod = c.estado.produccion.filter((p) => p.fecha === hoy && p.local === id && !terminado(p));
        const urgentes = prod.filter((p) => nivel(p) === "rojo").length;
        const cierres = c.estado.cajas.filter((x) => x.local === id && x.fecha >= desde).sort((a, b) => (b.cuando || "").localeCompare(a.cuando || ""));
        return `
        <article class="resumen-extra resumen-extra--${id}">
            <h3>🏪 ${l.nombre}</h3>
            <p>🍰 ${prod.length ? `${prod.length} encargo${prod.length === 1 ? "" : "s"} por hacer hoy${urgentes ? ` · <strong class="texto-alerta">${urgentes} con la hora encima</strong>` : ""}` : "Sin encargos pendientes hoy"}</p>
            <p>📦 ${bajos.length ? `<strong class="texto-alerta">Para pedir:</strong> ${bajos.map((i) => esc(i.nombre)).join(", ")}` : "Stock bien"}</p>
            ${cierres.length ? cierres.slice(0, 2).map((x) => `<p>💵 Turno ${nombreTurno(x.turno)} ${x.fecha === hoy ? "de hoy" : `del ${cal.nombreDia(cal.desdeIso(x.fecha))}`}: <span class="caja__diferencia caja__diferencia--${estadoDiferencia(x.diferencia).clase}">${estadoDiferencia(x.diferencia).texto}</span></p>`).join("") : "<p>💵 Sin cierres de caja en los últimos 3 días</p>"}
        </article>`;
    }).join("");
    return `
    <section class="momento">
        <h2 class="momento__titulo">☕ Salón, cocina, stock y caja</h2>
        ${resumenSalonDuena()}
        <div class="resumen-extras">${filas}</div>
        <div class="resumen-extras__botones">
            <button class="boton boton--suave" data-ir="salon">Salón</button>
            <button class="boton boton--suave" data-ir="comandas">Comandas</button>
            <button class="boton boton--suave" data-ir="produccion">Producción</button>
            <button class="boton boton--suave" data-ir="stock">Stock</button>
            <button class="boton boton--suave" data-ir="caja">Cierres de caja</button>
        </div>
    </section>`;
}

// ============================================
// Eventos (se llama desde conectarEventos de app.js con su helper "on")
// ============================================

export function conectarExtras(on) {
    const e = c.estado;
    // Stock
    on("[data-stock-local]", "click", (el) => { e.localStock = el.dataset.stockLocal; c.render(); });
    on("[data-stock-cambiar]", "click", (el) => cambiarStock(el.dataset.stockCambiar, Number(el.dataset.delta)));
    // Producción
    on("[data-prod-local]", "click", (el) => {
        e.filtroProd = el.dataset.prodLocal;
        if (e.formProd && el.dataset.prodLocal !== "todos") e.formProd.local = el.dataset.prodLocal;
        c.render();
    });
    on("[data-prod-fecha]", "change", (el) => { e.fechaProd = el.value || null; if (e.formProd && el.value) e.formProd.fecha = el.value; c.render(); });
    on("[data-prod-campo]", "input", (el) => { e.formProd[el.dataset.prodCampo] = el.value; });
    on("[data-prod-campo]", "change", (el) => { e.formProd[el.dataset.prodCampo] = el.value; });
    on("#form-produccion", "submit", (el, ev) => { ev.preventDefault(); agregarProduccion(); });
    on("[data-prod-listo]", "click", (el) => { el.disabled = true; marcarProduccion(el.dataset.prodListo, true); });
    on("[data-prod-deshacer]", "click", (el) => marcarProduccion(el.dataset.prodDeshacer, false));
    on("[data-prod-entregado]", "click", (el) => { el.disabled = true; marcarEntregado(el.dataset.prodEntregado, true); });
    on("[data-prod-a-listo]", "click", (el) => marcarEntregado(el.dataset.prodAListo, false));
    on("[data-prod-borrar]", "click", (el) => borrarProduccion(el.dataset.prodBorrar));
    // Caja: la diferencia se recalcula al escribir, sin redibujar toda la pantalla.
    on("[data-caja-campo]", "input", (el) => {
        e.formCaja[el.dataset.cajaCampo] = el.value;
        const est = estadoDiferencia(diferenciaDe(numerosCaja(e.formCaja)));
        const p = document.getElementById("caja-diferencia");
        if (p) { p.className = `caja__diferencia caja__diferencia--${est.clase}`; p.textContent = est.texto; }
    });
    on("[data-caja-elegir]", "change", (el) => {
        const f = e.formCaja;
        cargarFormCaja(el.dataset.cajaElegir === "local" ? el.value : f.local, el.dataset.cajaElegir === "turno" ? el.value : f.turno);
        c.render();
    });
    on("#form-caja", "submit", (el, ev) => { ev.preventDefault(); guardarCaja(); });
    on("[data-caja-usar-mesas]", "click", (el) => { e.formCaja.vendido = el.dataset.cajaUsarMesas; c.render(); });
    on("[data-caja-borrar]", "click", async (el) => {
        if (confirm("¿Borrar este cierre de caja?")) await datos.borrarDe("cajas", el.dataset.cajaBorrar);
    });
}
