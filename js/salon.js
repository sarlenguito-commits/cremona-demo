// ============================================
// Salón y cocina (idea traída de Restix, 12/10/2026), con el mismo motor de datos que el resto de la app:
//  - Mapa del salón: el admin general (o quien tenga el permiso "mapa") acomoda las mesas y los carteles de cada
//    local; los mozos trabajan encima de ese mismo mapa: abren mesas, cargan el pedido y mandan comandas a cocina.
//  - Comandas (cocina): lo que mandó la moza, con el tiempo que lleva esperando (amarilla y roja como en Restix)
//    y "✓ Listo"; la moza lo ve en "Para llevar a las mesas".
//  - Cobro: al cerrar la mesa, "La cobré yo" (con el medio de pago: suma solo en su cierre de caja) o
//    "La cobra caja" (pasa a "Mesas por cobrar" del rol caja).
// Colecciones: "mesas" (cada cuenta), "comandas" (cada envío a cocina) y "salonMapa" (un mapa por sector del local:
// Salón, Galería y Vereda, con id "<local>-<sector>").
// ============================================
import { PERSONAS, LOCALES, SECTORES, CARTA, COMANDAS, MEDIOS_COBRO } from "./config.js";
import * as cal from "./calendario.js";
import * as datos from "./datos.js";
import { puede as puedeEquipo, activa } from "./equipo.js";

// Lo que se usa de app.js: { estado, render, aviso, esc, nombre, esDuena, nuevoId, hora }
let c;

export function iniciarSalon(contexto) {
    c = contexto;
    Object.assign(c.estado, {
        mesas: [], comandas: [], salonMapa: [],
        localSalon: null,     // local que se ve en Salón / Comandas / Cobros
        mesaSel: null,        // número de mesa abierta en el panel
        catSel: CARTA[0].categoria,
        editandoMapa: false,  // modo "Acomodar el salón"
        itemSel: null,        // elemento del mapa elegido mientras se acomoda
        sectorSel: null,      // sector del salón que se ve (Salón, Galería, Vereda)
        soloMias: false,      // resaltar solo las mesas que abrí yo
        cobrando: null        // id de la mesa que se está cobrando
    });
}

export function escucharSalon() {
    for (const col of ["mesas", "comandas", "salonMapa"]) {
        datos.escucharColeccion(col, (lista) => {
            c.estado[col] = lista;
            if (!arrastre) c.render(); // mientras se arrastra una mesa no se redibuja (se perdería el movimiento)
        });
    }
    // El tiempo de espera de las comandas cambia solo: se redibuja cada minuto (si no se está escribiendo).
    setInterval(() => {
        const escribiendo = document.activeElement?.matches("input, textarea, select");
        if (["comandas", "salon", "cobros"].includes(c.estado.vista) && !escribiendo && !arrastre) c.render();
    }, 60000);
}

const esc = (s) => c.esc(s);
const ahora = () => cal.ahora();
const pesos = (n) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const puede = (permiso) => puedeEquipo(permiso, c.estado.persona);
const localDeHoy = () => cal.dondeEsta(c.estado.persona, ahora())?.local || Object.keys(LOCALES)[0];
const localVisto = () => c.estado.localSalon || (c.esDuena() ? Object.keys(LOCALES)[0] : localDeHoy());
const itemDeCarta = (id) => CARTA.flatMap((g) => g.items).find((i) => i.id === id);
const minutosDesde = (isoStr) => Math.max(0, Math.round((ahora() - new Date(isoStr)) / 60000));
const hace = (isoStr) => { const m = minutosDesde(isoStr); return m < 1 ? "recién" : m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h ${m % 60} min`; };
// En el mapa no entra el total completo: "$ 54k".
const pesosCorto = (n) => (n >= 1000 ? `$ ${Math.round(n / 1000)}k` : pesos(n));
const nombreMedio = (id) => MEDIOS_COBRO.find(([m]) => m === id)?.[1] || id;

const mesaAbierta = (local, numero) => c.estado.mesas.find((m) => m.local === local && m.numero === numero && m.estado === "abierta");
const totalDe = (m) => (m.pedido || []).reduce((s, l) => s + l.precio * l.cantidad, 0);
const comandasDe = (m) => c.estado.comandas.filter((k) => k.mesaId === m.id);
const sinEnviar = (m) => (m.pedido || []).filter((l) => l.cocina && !l.comanda);
// ¿Hay alguien activo que cobre en caja? (si no, no se ofrece "La cobra caja")
const hayCaja = () => Object.keys(PERSONAS).some((id) => activa(id) && PERSONAS[id].rol === "caja");

/** Pantallas para el menú "Más", según los permisos. */
export function menuSalon() {
    return [
        ...(puede("salon") ? [["salon", "armchair", "Salón y mesas"]] : []),
        ...(puede("comandas") ? [["comandas", "chef-hat", "Comandas de cocina"]] : []),
        ...(puede("cobrar") ? [["cobros", "receipt", "Mesas por cobrar"]] : [])
    ];
}

function filtroLocales(actual) {
    if (Object.keys(LOCALES).length < 2) return ""; // con un solo local no hace falta elegir
    return `
    <div class="filtros">
        ${Object.entries(LOCALES).map(([id, l]) => `<button class="filtros__item ${actual === id ? "is-activo" : ""}" data-salon-local="${id}">${l.nombre}</button>`).join("")}
    </div>`;
}

// ============================================
// Mapa del salón (uno por local; coordenadas en % del plano, así se ve igual en el celular y en la compu)
// ============================================

const sectoresDe = (local) => SECTORES[local] || [{ id: "salon", nombre: "Salón", mesas: 8 }];
const sectorVisto = (local) => {
    const s = sectoresDe(local);
    return s.find((x) => x.id === c.estado.sectorSel) || s[0];
};

// Mesas de un sector repartidas en una grilla, numeradas a continuación de los sectores anteriores.
function mapaPorDefecto(local, sectorId) {
    const sectores = sectoresDe(local);
    const idx = Math.max(0, sectores.findIndex((s) => s.id === sectorId));
    const desde = sectores.slice(0, idx).reduce((s, x) => s + x.mesas, 0);
    const n = sectores[idx]?.mesas || 6;
    const cols = Math.min(6, Math.ceil(Math.sqrt(n * 1.4)));
    const filas = Math.ceil(n / cols);
    const mesas = Array.from({ length: n }, (_, i) => ({
        id: `m${desde + i + 1}`, tipo: "mesa", numero: desde + i + 1, forma: i % 3 === 2 ? "redonda" : "cuadrada",
        x: Math.round(10 + (i % cols) * (80 / Math.max(1, cols - 1))), y: Math.round(24 + Math.floor(i / cols) * (62 / Math.max(1, filas - 1 || 1)))
    }));
    const carteles = sectorId === "vereda" ? [{ id: "c-calle", tipo: "cartel", texto: "Calle", x: 50, y: 93 }]
        : idx === 0 ? [{ id: "c-barra", tipo: "cartel", texto: "Barra", x: 50, y: 8 }, { id: "c-entrada", tipo: "cartel", texto: "Entrada", x: 50, y: 93 }]
        : [{ id: "c-sector", tipo: "cartel", texto: sectores[idx]?.nombre || "Sector", x: 50, y: 8 }];
    return [...carteles, ...mesas];
}

const idMapa = (local, sectorId) => `${local}-${sectorId}`;
const itemsDelMapa = (local, sectorId = sectorVisto(local).id) =>
    c.estado.salonMapa.find((m) => m.id === idMapa(local, sectorId))?.items || mapaPorDefecto(local, sectorId);
const numerosDeMesas = (local) => sectoresDe(local).flatMap((s) => itemsDelMapa(local, s.id).filter((i) => i.tipo === "mesa").map((i) => i.numero)).sort((a, b) => a - b);
/** Sector en el que está una mesa (para mostrar "Mesa 18 · Galería"). */
export const sectorDeMesa = (local, numero) => sectoresDe(local).find((s) => itemsDelMapa(local, s.id).some((i) => i.tipo === "mesa" && i.numero === numero));

async function guardarMapa(local, items, sectorId = sectorVisto(local).id) {
    await datos.guardarEn("salonMapa", { id: idMapa(local, sectorId), local, sector: sectorId, items, editadoPor: c.estado.persona, editado: ahora().toISOString() });
}

function htmlMapa(local) {
    const e = c.estado;
    const yo = e.persona;
    return `
    <div class="salon-mapa ${e.editandoMapa ? "is-editando" : ""}" id="salon-mapa" data-local="${local}" data-sector="${sectorVisto(local).id}">
        ${itemsDelMapa(local).map((it) => {
            const pos = `left:${it.x}%;top:${it.y}%`;
            if (it.tipo === "cartel") {
                return `<span class="salon-cartel ${e.itemSel === it.id ? "is-elegida" : ""}" style="${pos}" data-item="${it.id}">${esc(it.texto)}</span>`;
            }
            const m = mesaAbierta(local, it.numero);
            const lista = m && comandasDe(m).some((k) => k.estado === "listo");
            const enCocina = m && comandasDe(m).some((k) => k.estado === "en-cocina");
            const clase = !m ? "libre" : lista ? "lista" : "abierta";
            const ajena = e.soloMias && m && m.abiertaPor !== yo;
            const elegida = e.editandoMapa ? e.itemSel === it.id : e.mesaSel === it.numero;
            return `
            <button class="mesa mesa--${clase} mesa--${it.forma || "cuadrada"} ${elegida ? "is-elegida" : ""} ${ajena ? "is-ajena" : ""}"
                style="${pos}" data-item="${it.id}" data-mesa-sel="${it.numero}" aria-label="Mesa ${it.numero}${m ? ", abierta" : ", libre"}">
                <strong>${it.numero}</strong>
                ${m ? `<small>${pesosCorto(totalDe(m))}</small>` : ""}
                ${lista ? `<span class="mesa__aviso">🛎️</span>` : enCocina ? `<span class="mesa__aviso">🔥</span>` : ""}
            </button>`;
        }).join("")}
    </div>`;
}

function barraAcomodar(local) {
    const e = c.estado;
    const it = itemsDelMapa(local).find((x) => x.id === e.itemSel);
    return `
    <div class="mapa-herramientas">
        <p class="formulario__ayuda">✋ Arrastrá las mesas y los carteles a su lugar. Tocá uno para cambiarle la forma o quitarlo.
        Los mozos ven este mismo mapa.</p>
        <div class="mapa-herramientas__botones">
            <button class="boton boton--suave" data-mapa-agregar="mesa">➕ Mesa</button>
            <button class="boton boton--suave" data-mapa-agregar="cartel">➕ Cartel</button>
            ${it?.tipo === "mesa" ? `<button class="boton boton--suave" data-mapa-forma>${it.forma === "redonda" ? "⬜ Hacerla cuadrada" : "⚪ Hacerla redonda"}</button>` : ""}
            ${it ? `<button class="boton boton--suave" data-mapa-quitar>🗑️ Quitar ${it.tipo === "mesa" ? `mesa ${it.numero}` : `"${esc(it.texto)}"`}</button>` : ""}
            <button class="boton" data-mapa-listo>✓ Listo</button>
        </div>
    </div>`;
}

// ---------- Arrastrar (solo en modo "Acomodar") ----------
let arrastre = null; // { el, id, local, mapa, dx, dy, movido }

function empezarArrastre(el, ev) {
    const mapa = document.getElementById("salon-mapa");
    if (!c.estado.editandoMapa || !mapa) return;
    ev.preventDefault();
    arrastre = { el, id: el.dataset.item, local: mapa.dataset.local, sector: mapa.dataset.sector, mapa, inicioX: ev.clientX, inicioY: ev.clientY, movido: false };
    el.setPointerCapture?.(ev.pointerId);
    el.addEventListener("pointermove", moverArrastre);
    el.addEventListener("pointerup", soltarArrastre, { once: true });
    el.addEventListener("pointercancel", soltarArrastre, { once: true });
}

function moverArrastre(ev) {
    if (!arrastre) return;
    if (Math.abs(ev.clientX - arrastre.inicioX) + Math.abs(ev.clientY - arrastre.inicioY) > 4) arrastre.movido = true;
    if (!arrastre.movido) return;
    const r = arrastre.mapa.getBoundingClientRect();
    const x = Math.min(95, Math.max(5, ((ev.clientX - r.left) / r.width) * 100));
    const y = Math.min(95, Math.max(5, ((ev.clientY - r.top) / r.height) * 100));
    arrastre.el.style.left = `${x}%`;
    arrastre.el.style.top = `${y}%`;
    arrastre.x = Math.round(x * 10) / 10;
    arrastre.y = Math.round(y * 10) / 10;
}

async function soltarArrastre() {
    const a = arrastre;
    a.el.removeEventListener("pointermove", moverArrastre);
    arrastre = null;
    if (!a.movido) {
        // Fue un toque: elige el elemento para cambiarle la forma o quitarlo
        c.estado.itemSel = c.estado.itemSel === a.id ? null : a.id;
        c.render();
        return;
    }
    const items = itemsDelMapa(a.local, a.sector).map((it) => (it.id === a.id ? { ...it, x: a.x, y: a.y } : it));
    c.estado.itemSel = a.id;
    await guardarMapa(a.local, items, a.sector);
}

async function agregarAlMapa(tipo) {
    const local = localVisto();
    const items = [...itemsDelMapa(local)];
    if (tipo === "mesa") {
        const numero = Math.max(0, ...numerosDeMesas(local)) + 1; // sigue la numeración de todos los sectores
        items.push({ id: c.nuevoId("m"), tipo: "mesa", numero, forma: "cuadrada", x: 50, y: 50 });
        c.aviso(`Mesa ${numero} agregada: arrastrala a su lugar`, "ok");
    } else {
        const texto = (prompt("¿Qué dice el cartel? (ej: Baño, Vereda, Cocina)") || "").trim().slice(0, 20);
        if (!texto) return;
        items.push({ id: c.nuevoId("c"), tipo: "cartel", texto, x: 50, y: 50 });
    }
    await guardarMapa(local, items);
}

async function cambiarForma() {
    const local = localVisto();
    const items = itemsDelMapa(local).map((it) => (it.id === c.estado.itemSel ? { ...it, forma: it.forma === "redonda" ? "cuadrada" : "redonda" } : it));
    await guardarMapa(local, items);
}

async function quitarDelMapa() {
    const local = localVisto();
    const it = itemsDelMapa(local).find((x) => x.id === c.estado.itemSel);
    if (!it) return;
    if (it.tipo === "mesa" && mesaAbierta(local, it.numero)) return c.aviso(`La mesa ${it.numero} está abierta: cerrala antes de quitarla`);
    if (!confirm(it.tipo === "mesa" ? `¿Quitar la mesa ${it.numero} del salón?` : `¿Quitar el cartel "${it.texto}"?`)) return;
    c.estado.itemSel = null;
    await guardarMapa(local, itemsDelMapa(local).filter((x) => x.id !== it.id));
}

// ============================================
// Comandas (tarjetas compartidas entre cocina, moza y dueña)
// ============================================

function nivelComanda(k) {
    if (k.estado !== "en-cocina") return "normal";
    const m = minutosDesde(k.enviada);
    return m >= COMANDAS.MINUTOS_ROJO ? "rojo" : m >= COMANDAS.MINUTOS_AMARILLO ? "amarillo" : "normal";
}

// boton: "listo" (cocina) | "llevado" (moza) | "" (solo ver)
function tarjetaComanda(k, { boton = "" } = {}) {
    const estadoTxt = k.estado === "en-cocina" ? `🔥 En cocina · mandada ${hace(k.enviada)}`
        : k.estado === "listo" ? `🛎️ Lista ${hace(k.listoEn)}${k.listoPor ? ` (${esc(c.nombre(k.listoPor))})` : ""}`
        : `✓ Llevada a la mesa${k.servidoPor ? ` (${esc(c.nombre(k.servidoPor))})` : ""}`;
    return `
    <article class="comanda comanda--${nivelComanda(k)} ${k.estado === "servido" ? "is-servida" : ""}">
        <p class="comanda__mesa">Mesa ${k.numero}</p>
        <div class="comanda__cuerpo">
            <ul class="comanda__items">${k.items.map((i) => `<li><strong>${i.cantidad} ×</strong> ${esc(i.nombre)}</li>`).join("")}</ul>
            <p class="comanda__meta">${esc(LOCALES[k.local]?.nombre || "")} · ${estadoTxt} · pidió ${esc(c.nombre(k.moza))}</p>
        </div>
        ${boton === "listo" ? `<button class="boton" data-comanda-listo="${k.id}">✓ Listo</button>`
            : boton === "llevado" ? `<button class="boton" data-comanda-llevada="${k.id}">✓ Llevado</button>` : ""}
    </article>`;
}

const ordenEnvio = (a, b) => (a.enviada || "").localeCompare(b.enviada || "");

export function vistaComandas() {
    const local = localVisto();
    const hoy = cal.iso(ahora());
    const delLocal = c.estado.comandas.filter((k) => k.local === local);
    const enCocina = delLocal.filter((k) => k.estado === "en-cocina").sort(ordenEnvio);
    const listas = delLocal.filter((k) => k.estado === "listo").sort(ordenEnvio);
    const servidas = delLocal.filter((k) => k.estado === "servido" && (k.servidoEn || "").startsWith(hoy)).sort(ordenEnvio).reverse().slice(0, 6);
    return `
    <section class="encabezado">
        <h1>🍳 Comandas de cocina</h1>
        <p>Lo que mandó la moza desde las mesas, primero lo más viejo. La tarjeta se pone amarilla a los
        ${COMANDAS.MINUTOS_AMARILLO} minutos y roja a los ${COMANDAS.MINUTOS_ROJO}. Con "✓ Listo" le avisa a la moza que lo lleve.</p>
    </section>
    ${filtroLocales(local)}
    <section class="momento">
        <h2 class="momento__titulo">En cocina${enCocina.length ? ` · ${enCocina.length}` : ""}</h2>
        ${enCocina.length ? enCocina.map((k) => tarjetaComanda(k, { boton: "listo" })).join("") : `<p class="momento__vacio momento__vacio--ok">🎉 No hay nada esperando en cocina.</p>`}
    </section>
    ${listas.length ? `
    <section class="momento">
        <h2 class="momento__titulo">🛎️ Listas, esperando a la moza</h2>
        ${listas.map((k) => tarjetaComanda(k)).join("")}
    </section>` : ""}
    ${servidas.length ? `
    <section class="momento">
        <h2 class="momento__titulo">Llevadas hoy</h2>
        ${servidas.map((k) => tarjetaComanda(k)).join("")}
    </section>` : ""}`;
}

async function cambiarComanda(id, nuevo) {
    const k = c.estado.comandas.find((x) => x.id === id);
    if (!k) return;
    const { uid, ...resto } = k;
    const cuando = ahora().toISOString();
    const cambios = nuevo === "listo" ? { listoPor: c.estado.persona, listoEn: cuando } : { servidoPor: c.estado.persona, servidoEn: cuando };
    await datos.guardarEn("comandas", { ...resto, ...cambios, estado: nuevo });
    c.aviso(nuevo === "listo" ? `🛎️ Mesa ${k.numero}: lista para llevar` : `✓ Mesa ${k.numero}: llevado`, "ok");
}

// ============================================
// Salón: el mapa y la mesa elegida
// ============================================

function etiquetaLinea(l, m) {
    if (!l.cocina) return `<span class="linea__estado">barra</span>`;
    if (!l.comanda) return `<span class="linea__estado linea__estado--pendiente">sin mandar</span>`;
    const k = comandasDe(m).find((x) => x.id === l.comanda);
    const txt = !k ? "en cocina" : k.estado === "en-cocina" ? "🔥 en cocina" : k.estado === "listo" ? "🛎️ lista" : "✓ servida";
    return `<span class="linea__estado linea__estado--${k?.estado || "en-cocina"}">${txt}</span>`;
}

// Al cerrar: "La cobré yo" (con el medio) o "La cobra caja".
function panelCobro(m) {
    const yoCobro = puede("cobrarMesa");
    const caja = hayCaja();
    return `
    <div class="cobro">
        <h3>💵 ¿Cómo se cobra la mesa ${m.numero}? · ${pesos(totalDe(m))}</h3>
        ${yoCobro ? `
        <p class="formulario__ayuda">La cobré yo (se suma solo a tu cierre de caja del turno):</p>
        <div class="cobro__medios">
            ${MEDIOS_COBRO.map(([id, txt]) => `<button class="boton" data-cobrar-mesa="${m.id}" data-medio="${id}">${txt}</button>`).join("")}
        </div>` : ""}
        ${caja ? `<button class="boton boton--suave" data-pasar-caja="${m.id}">🧾 La cobra caja</button>` : ""}
        ${!yoCobro && !caja ? `<p class="vacio">No tenés permiso para cobrar y no hay nadie en caja: avisale a la encargada.</p>` : ""}
        <button class="boton boton--suave" data-cobro-cancelar>Cancelar</button>
    </div>`;
}

function panelMesa(local, numero) {
    const m = mesaAbierta(local, numero);
    if (!m) {
        return `
        <section class="mesa-panel">
            <h2>Mesa ${numero} · libre</h2>
            <button class="boton boton--grande" data-mesa-abrir="${numero}">Abrir mesa ${numero}</button>
        </section>`;
    }
    const pendientes = sinEnviar(m);
    const cat = CARTA.find((g) => g.categoria === c.estado.catSel) || CARTA[0];
    return `
    <section class="mesa-panel">
        <h2>Mesa ${numero} · ${pesos(totalDe(m))}</h2>
        <p class="mesa-panel__meta">Abrió ${esc(c.nombre(m.abiertaPor))} ${hace(m.abiertaEn)}</p>
        ${m.pedido?.length ? `
        <ul class="mesa-panel__pedido">
            ${m.pedido.map((l) => `
            <li class="linea">
                <span><strong>${l.cantidad} ×</strong> ${esc(l.nombre)}</span>
                ${etiquetaLinea(l, m)}
                <span class="linea__precio">${pesos(l.precio * l.cantidad)}</span>
                ${l.cocina && l.comanda ? "" : `<button class="linea__quitar" data-linea-quitar="${l.id}" aria-label="Quitar uno de ${esc(l.nombre)}">−</button>`}
            </li>`).join("")}
        </ul>` : `<p class="vacio">Todavía no pidió nada. Tocá lo que pide en la carta de abajo.</p>`}
        ${pendientes.length ? `<button class="boton boton--grande" data-mesa-enviar="${m.id}">🍳 Mandar a cocina (${pendientes.reduce((s, l) => s + l.cantidad, 0)})</button>` : ""}
        ${c.estado.cobrando === m.id ? panelCobro(m) : `
        <div class="carta">
            <div class="filtros">
                ${CARTA.map((g) => `<button class="filtros__item ${g === cat ? "is-activo" : ""}" data-carta-cat="${esc(g.categoria)}">${esc(g.categoria)}</button>`).join("")}
            </div>
            <section class="carta__seccion carta__seccion--${cat.estilo || "simple"}">
                <h3 class="carta__seccion-titulo">${esc(cat.categoria)}${cat.foto ? `<img class="carta__seccion-foto" src="assets/img/fotos/${cat.foto}" alt="" width="56" height="56" loading="lazy">` : ""}</h3>
                ${cat.nota ? `<p class="carta__seccion-nota">${esc(cat.nota)}</p>` : ""}
                ${cat.items.map((i) => `
                <button class="carta__plato" data-carta-item="${i.id}" aria-label="Agregar ${esc(i.nombre)}, ${pesos(i.precio)}">
                    <strong>${esc(i.nombre)}${i.cocina ? " 🍳" : ""}</strong><i aria-hidden="true"></i><span>${pesos(i.precio)}</span>
                    ${i.desc ? `<small>${esc(i.desc)}</small>` : ""}
                </button>`).join("")}
            </section>
        </div>
        <button class="boton boton--suave" data-mesa-cobrar="${m.id}" ${m.pedido?.length ? "" : "disabled"}>💵 Cobrar y cerrar · ${pesos(totalDe(m))}</button>
        ${m.pedido?.length ? "" : `<button class="boton boton--suave" data-mesa-liberar="${m.id}">Liberar la mesa (no pidieron nada)</button>`}`}
    </section>`;
}

export function vistaSalon() {
    const e = c.estado;
    const local = localVisto();
    const numeros = numerosDeMesas(local);
    const listas = e.comandas.filter((k) => k.local === local && k.estado === "listo").sort(ordenEnvio);
    if (e.mesaSel && !numeros.includes(e.mesaSel)) e.mesaSel = null;
    const abiertasMias = e.mesas.filter((m) => m.local === local && m.estado === "abierta" && m.abiertaPor === e.persona).length;
    return `
    <section class="encabezado">
        <h1>🍽️ Salón y mesas</h1>
        <p>${e.editandoMapa ? "Estás acomodando el salón." : `Tocá una mesa para abrirla y cargar lo que piden. Lo de cocina (🍳) se manda con un botón;
        el café, las bebidas y lo de la vitrina los servís vos. Cuando cocina lo termina, aparece en "Para llevar".`}</p>
    </section>
    ${filtroLocales(local)}
    ${!e.editandoMapa && listas.length ? `
    <section class="momento">
        <h2 class="momento__titulo">🛎️ Para llevar a las mesas · ${listas.length}</h2>
        ${listas.map((k) => tarjetaComanda(k, { boton: "llevado" })).join("")}
    </section>` : ""}
    <div class="filtros sectores">
        ${sectoresDe(local).map((s) => {
            const abiertas = e.mesas.filter((m) => m.local === local && m.estado === "abierta" && sectorDeMesa(local, m.numero)?.id === s.id).length;
            return `<button class="filtros__item ${sectorVisto(local).id === s.id ? "is-activo" : ""}" data-sector-tab="${s.id}">${esc(s.nombre)}${abiertas ? ` · ${abiertas}` : ""}</button>`;
        }).join("")}
    </div>
    <div class="mapa-barra">
        ${!e.editandoMapa ? `<button class="filtros__item ${e.soloMias ? "is-activo" : ""}" data-solo-mias>👤 Mis mesas${abiertasMias ? ` · ${abiertasMias}` : ""}</button>` : ""}
        ${!e.editandoMapa && puede("mapa") ? `<button class="filtros__item" data-mapa-acomodar>✏️ Acomodar el salón</button>` : ""}
    </div>
    ${htmlMapa(local)}
    ${e.editandoMapa ? barraAcomodar(local)
        : e.mesaSel ? panelMesa(local, e.mesaSel) : `<p class="vacio">Elegí una mesa del mapa para ver o cargar su pedido.</p>`}`;
}

async function guardarMesa(m) {
    const { uid, ...resto } = m;
    await datos.guardarEn("mesas", resto);
}

async function abrirMesa(numero) {
    const local = localVisto();
    if (mesaAbierta(local, numero)) return;
    await datos.guardarEn("mesas", {
        id: c.nuevoId("mesa"), local, numero, estado: "abierta", pedido: [],
        abiertaPor: c.estado.persona, abiertaEn: ahora().toISOString(), cerradaPor: "", cerradaEn: "", total: 0
    });
    c.aviso(`Mesa ${numero} abierta ✓`, "ok");
}

async function agregarItem(itemId) {
    const m = mesaAbierta(localVisto(), c.estado.mesaSel);
    const it = itemDeCarta(itemId);
    if (!m || !it) return;
    const pedido = [...(m.pedido || [])];
    // Si ya está cargado y no se mandó a cocina todavía, suma uno a esa línea.
    const linea = pedido.find((l) => l.itemId === itemId && !l.comanda);
    if (linea) linea.cantidad += 1;
    else pedido.push({ id: c.nuevoId("l"), itemId, nombre: it.nombre, precio: it.precio, cantidad: 1, cocina: !!it.cocina, comanda: "" });
    await guardarMesa({ ...m, pedido });
}

async function quitarItem(lineaId) {
    const m = mesaAbierta(localVisto(), c.estado.mesaSel);
    if (!m) return;
    const pedido = (m.pedido || []).map((l) => (l.id === lineaId ? { ...l, cantidad: l.cantidad - 1 } : l)).filter((l) => l.cantidad > 0);
    await guardarMesa({ ...m, pedido });
}

async function mandarACocina(mesaId) {
    const m = c.estado.mesas.find((x) => x.id === mesaId);
    if (!m) return;
    const pendientes = sinEnviar(m);
    if (!pendientes.length) return;
    const id = c.nuevoId("comanda");
    await datos.guardarEn("comandas", {
        id, local: m.local, numero: m.numero, mesaId: m.id, estado: "en-cocina",
        items: pendientes.map((l) => ({ nombre: l.nombre, cantidad: l.cantidad })),
        moza: c.estado.persona, enviada: ahora().toISOString(), listoPor: "", listoEn: "", servidoPor: "", servidoEn: ""
    });
    await guardarMesa({ ...m, pedido: m.pedido.map((l) => (l.cocina && !l.comanda ? { ...l, comanda: id } : l)) });
    c.aviso(`🍳 Mesa ${m.numero}: mandado a cocina`, "ok");
}

// ---------- Cobro ----------

function datosCobro(m, medio) {
    const cuando = ahora();
    return { medio, por: c.estado.persona, en: cuando.toISOString(), fecha: cal.iso(cuando), turno: cal.turnoActual(m.local, cuando) };
}

async function cobrarMesa(mesaId, medio) {
    const m = c.estado.mesas.find((x) => x.id === mesaId);
    if (!m) return;
    const total = totalDe(m);
    await guardarMesa({ ...m, estado: "cerrada", total, cobro: datosCobro(m, medio), cerradaPor: c.estado.persona, cerradaEn: ahora().toISOString() });
    if (c.estado.mesaSel === m.numero) c.estado.mesaSel = null;
    c.estado.cobrando = null;
    c.aviso(`💵 Mesa ${m.numero} cobrada · ${pesos(total)} · ${nombreMedio(medio)}`, "ok");
    c.render();
}

async function pasarACaja(mesaId) {
    const m = c.estado.mesas.find((x) => x.id === mesaId);
    if (!m) return;
    // La mesa queda libre para otros clientes; la cuenta espera en "Mesas por cobrar".
    await guardarMesa({ ...m, estado: "por-cobrar", total: totalDe(m), pasadaPor: c.estado.persona, pasadaEn: ahora().toISOString() });
    c.estado.mesaSel = null;
    c.estado.cobrando = null;
    c.aviso(`🧾 Mesa ${m.numero} pasada a caja · ${pesos(totalDe(m))}`, "ok");
    c.render();
}

async function liberarMesa(mesaId) {
    const m = c.estado.mesas.find((x) => x.id === mesaId);
    if (!m || m.pedido?.length) return;
    await guardarMesa({ ...m, estado: "cerrada", total: 0, cerradaPor: c.estado.persona, cerradaEn: ahora().toISOString() });
    c.estado.mesaSel = null;
    c.aviso(`Mesa ${m.numero} liberada`, "ok");
}

// ---------- Pantalla de caja: mesas por cobrar ----------

function tarjetaPorCobrar(m) {
    return `
    <article class="por-cobrar">
        <p class="comanda__mesa">Mesa ${m.numero}</p>
        <div class="comanda__cuerpo">
            <p><strong>${pesos(m.total || totalDe(m))}</strong> · ${(m.pedido || []).map((l) => `${l.cantidad} × ${esc(l.nombre)}`).join(", ")}</p>
            <p class="comanda__meta">${esc(LOCALES[m.local]?.nombre || "")} · la pasó ${esc(c.nombre(m.pasadaPor))} ${hace(m.pasadaEn)}</p>
            <div class="cobro__medios">
                ${MEDIOS_COBRO.map(([id, txt]) => `<button class="boton" data-cobrar-mesa="${m.id}" data-medio="${id}">${txt}</button>`).join("")}
            </div>
        </div>
    </article>`;
}

export function vistaCobros() {
    const local = localVisto();
    const hoy = cal.iso(ahora());
    const porCobrar = c.estado.mesas.filter((m) => m.local === local && m.estado === "por-cobrar").sort((a, b) => (a.pasadaEn || "").localeCompare(b.pasadaEn || ""));
    const cobradas = c.estado.mesas.filter((m) => m.local === local && m.estado === "cerrada" && m.cobro?.fecha === hoy)
        .sort((a, b) => (b.cobro.en || "").localeCompare(a.cobro.en || ""));
    const porMedio = MEDIOS_COBRO.map(([id, txt]) => [txt, cobradas.filter((m) => m.cobro.medio === id).reduce((s, m) => s + (m.total || 0), 0)]);
    return `
    <section class="encabezado">
        <h1>🧾 Mesas por cobrar</h1>
        <p>Las cuentas que los mozos pasaron a caja. Elegí cómo pagó y queda cobrada (se suma sola al cierre de caja del turno).</p>
    </section>
    ${filtroLocales(local)}
    <section class="momento">
        <h2 class="momento__titulo">Por cobrar${porCobrar.length ? ` · ${porCobrar.length}` : ""}</h2>
        ${porCobrar.length ? porCobrar.map(tarjetaPorCobrar).join("") : `<p class="momento__vacio momento__vacio--ok">🎉 No hay cuentas esperando.</p>`}
    </section>
    <section class="momento">
        <h2 class="momento__titulo">Cobrado hoy en ${esc(LOCALES[local].nombre)} · ${pesos(cobradas.reduce((s, m) => s + (m.total || 0), 0))}</h2>
        <p class="stock__chips">${porMedio.map(([txt, total]) => `<span class="mesa-chip">${txt}: ${pesos(total)}</span>`).join("")}</p>
        ${cobradas.slice(0, 8).map((m) => `<p class="caja__detalle">Mesa ${m.numero} · ${pesos(m.total || 0)} · ${nombreMedio(m.cobro.medio)} · cobró ${esc(c.nombre(m.cobro.por))} a las ${c.hora(m.cobro.en)}</p>`).join("")}
    </section>`;
}

/** Lo cobrado por mesas en un local, día y turno, por medio de pago (lo usa el cierre de caja de extras.js). */
export function cobradoEnTurno(local, fecha, turno) {
    const mesas = c.estado.mesas.filter((m) => m.local === local && m.estado === "cerrada" && m.cobro?.fecha === fecha && m.cobro?.turno === turno);
    const porMedio = Object.fromEntries(MEDIOS_COBRO.map(([id]) => [id, mesas.filter((m) => m.cobro.medio === id).reduce((s, m) => s + (m.total || 0), 0)]));
    return { mesas: mesas.length, total: Object.values(porMedio).reduce((s, n) => s + n, 0), porMedio };
}

// ============================================
// "Hoy" (moza, cocina y caja) y resumen para la dueña (Actividad)
// ============================================

export function avisosSalonHoy() {
    const local = localDeHoy();
    let html = "";
    if (puede("cobrar")) {
        const porCobrar = c.estado.mesas.filter((m) => m.local === local && m.estado === "por-cobrar");
        html += `
        <section class="momento">
            <h2 class="momento__titulo">🧾 Mesas por cobrar · ${porCobrar.length}</h2>
            ${porCobrar.length ? porCobrar.map(tarjetaPorCobrar).join("") : `<p class="vacio">No hay cuentas esperando.</p>`}
            <button class="boton boton--suave" data-ir="cobros">Ver lo cobrado hoy</button>
        </section>`;
    }
    if (puede("comandas")) {
        const enCocina = c.estado.comandas.filter((k) => k.local === local && k.estado === "en-cocina").sort(ordenEnvio);
        if (enCocina.length) html += `
        <section class="momento">
            <h2 class="momento__titulo">🍳 Comandas en cocina · ${enCocina.length}</h2>
            ${enCocina.slice(0, 4).map((k) => tarjetaComanda(k, { boton: "listo" })).join("")}
            <button class="boton boton--suave" data-ir="comandas">Ver comandas</button>
        </section>`;
    }
    if (!puede("salon")) return html;
    const listas = c.estado.comandas.filter((k) => k.local === local && k.estado === "listo").sort(ordenEnvio);
    const abiertas = c.estado.mesas.filter((m) => m.local === local && m.estado === "abierta").sort((a, b) => a.numero - b.numero);
    return `
    ${html}
    ${listas.length ? `
    <section class="momento">
        <h2 class="momento__titulo">🛎️ Para llevar a las mesas · ${listas.length}</h2>
        ${listas.map((k) => tarjetaComanda(k, { boton: "llevado" })).join("")}
    </section>` : ""}
    <section class="momento">
        <h2 class="momento__titulo">🍽️ Mesas abiertas en ${esc(LOCALES[local].nombre)} · ${abiertas.length}</h2>
        ${abiertas.length ? `<p class="stock__chips">${abiertas.map((m) => `<span class="mesa-chip">Mesa ${m.numero}${sectorDeMesa(local, m.numero) ? ` (${esc(sectorDeMesa(local, m.numero).nombre)})` : ""} · ${pesos(totalDe(m))}${m.abiertaPor === c.estado.persona ? " · tuya" : ""}${comandasDe(m).some((k) => k.estado === "en-cocina") ? " · 🔥" : ""}</span>`).join("")}</p>` : `<p class="vacio">No hay mesas abiertas.</p>`}
        <button class="boton boton--suave" data-ir="salon">Ir al salón</button>
    </section>`;
}

export function resumenSalonDuena() {
    return Object.entries(LOCALES).map(([id, l]) => {
        const abiertas = c.estado.mesas.filter((m) => m.local === id && m.estado === "abierta");
        const porCobrar = c.estado.mesas.filter((m) => m.local === id && m.estado === "por-cobrar").length;
        const enCocina = c.estado.comandas.filter((k) => k.local === id && k.estado === "en-cocina");
        const rojas = enCocina.filter((k) => nivelComanda(k) === "rojo").length;
        return `<p>🍽️ ${l.nombre}: ${abiertas.length} mesa${abiertas.length === 1 ? "" : "s"} abierta${abiertas.length === 1 ? "" : "s"} (${pesos(abiertas.reduce((s, m) => s + totalDe(m), 0))}) · ${enCocina.length} en cocina${rojas ? ` · <strong class="texto-alerta">${rojas} demorada${rojas === 1 ? "" : "s"}</strong>` : ""}${porCobrar ? ` · 🧾 ${porCobrar} por cobrar` : ""}</p>`;
    }).join("");
}

// ============================================
// Eventos
// ============================================

export function conectarSalon(on) {
    const e = c.estado;
    on("[data-salon-local]", "click", (el) => { e.localSalon = el.dataset.salonLocal; e.mesaSel = null; e.itemSel = null; e.cobrando = null; c.render(); });
    on("[data-mesa-sel]", "click", (el) => {
        if (e.editandoMapa) return; // en modo acomodar, el toque lo maneja el arrastre
        const n = Number(el.dataset.mesaSel);
        e.mesaSel = e.mesaSel === n ? null : n;
        e.cobrando = null;
        c.render();
    });
    on("#salon-mapa [data-item]", "pointerdown", (el, ev) => empezarArrastre(el, ev));
    on("[data-mapa-acomodar]", "click", () => { e.editandoMapa = true; e.mesaSel = null; e.itemSel = null; c.render(); });
    on("[data-mapa-listo]", "click", () => { e.editandoMapa = false; e.itemSel = null; c.aviso("Salón guardado ✓ Los mozos ya lo ven así", "ok"); c.render(); });
    on("[data-mapa-agregar]", "click", (el) => agregarAlMapa(el.dataset.mapaAgregar));
    on("[data-mapa-forma]", "click", () => cambiarForma());
    on("[data-mapa-quitar]", "click", () => quitarDelMapa());
    on("[data-solo-mias]", "click", () => { e.soloMias = !e.soloMias; c.render(); });
    on("[data-sector-tab]", "click", (el) => { e.sectorSel = el.dataset.sectorTab; e.mesaSel = null; e.itemSel = null; e.cobrando = null; c.render(); });
    on("[data-mesa-abrir]", "click", (el) => { el.disabled = true; abrirMesa(Number(el.dataset.mesaAbrir)); });
    on("[data-carta-cat]", "click", (el) => { e.catSel = el.dataset.cartaCat; c.render(); });
    on("[data-carta-item]", "click", (el) => agregarItem(el.dataset.cartaItem));
    on("[data-linea-quitar]", "click", (el) => quitarItem(el.dataset.lineaQuitar));
    on("[data-mesa-enviar]", "click", (el) => { el.disabled = true; mandarACocina(el.dataset.mesaEnviar); });
    on("[data-mesa-cobrar]", "click", (el) => {
        const m = c.estado.mesas.find((x) => x.id === el.dataset.mesaCobrar);
        if (m && sinEnviar(m).length && !confirm("Hay cosas de cocina sin mandar. ¿Cobrar igual?")) return;
        e.cobrando = el.dataset.mesaCobrar;
        c.render();
    });
    on("[data-cobro-cancelar]", "click", () => { e.cobrando = null; c.render(); });
    on("[data-cobrar-mesa]", "click", (el) => { el.disabled = true; cobrarMesa(el.dataset.cobrarMesa, el.dataset.medio); });
    on("[data-pasar-caja]", "click", (el) => { el.disabled = true; pasarACaja(el.dataset.pasarCaja); });
    on("[data-mesa-liberar]", "click", (el) => liberarMesa(el.dataset.mesaLiberar));
    on("[data-comanda-listo]", "click", (el) => { el.disabled = true; cambiarComanda(el.dataset.comandaListo, "listo"); });
    on("[data-comanda-llevada]", "click", (el) => { el.disabled = true; cambiarComanda(el.dataset.comandaLlevada, "servido"); });
}
