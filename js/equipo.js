// ============================================
// Equipo, roles y permisos (como en DGT, pedido de Esteban 12/10/2026).
// - El equipo de base está en config.js > PERSONAS. Lo que agregan, editan o dan de baja el admin general y los
//   encargados se guarda en la colección "usuarios" y se aplica encima (el objeto PERSONAS se actualiza en el lugar,
//   así el resto de la app lo sigue usando igual).
// - Permisos por rol: config.js > PERMISOS_DE_FABRICA, y lo que cambie el admin general en la colección "permisos".
// Jerarquía (igual que DGT): admin general (uno solo, todo) > encargado (gestiona salón, cocina y caja) > salón / cocina / caja.
// Nadie se gestiona a sí mismo ni al admin general. Nada se borra: se da de baja y se puede reactivar.
// ============================================
import { PERSONAS, ROLES, PERMISOS, PERMISOS_DE_FABRICA, LOCALES } from "./config.js";
import * as datos from "./datos.js";

const BASE = JSON.parse(JSON.stringify(PERSONAS)); // equipo de fábrica (config.js)
let permisosGuardados = {};                         // { encargado: {...}, salon: {...}, cocina: {...} }
let c;                                               // { estado, render, aviso, esc, nombre, nuevoId, hora }

// ---------- Aplicar equipo y permisos ----------

function aplicarUsuarios(lista) {
    for (const id of Object.keys(PERSONAS)) if (!BASE[id]) delete PERSONAS[id];
    for (const [id, p] of Object.entries(BASE)) PERSONAS[id] = { ...p };
    for (const u of lista) {
        const { id, uid, ...resto } = u;
        PERSONAS[id] = { ...(PERSONAS[id] || {}), ...resto };
    }
}

function aplicarPermisos(lista) {
    permisosGuardados = lista.find((x) => x.id === "roles")?.roles || {};
}

// En modo prueba se lee al toque (antes de dibujar el ingreso), así la lista de nombres ya está al día.
if (datos.modoPrueba) {
    try {
        aplicarUsuarios(Object.values(JSON.parse(localStorage.getItem("cr-demo-usuarios")) || {}));
        aplicarPermisos(Object.values(JSON.parse(localStorage.getItem("cr-demo-permisos")) || {}));
    } catch { /* sin almacenamiento: queda el equipo de base */ }
}

export function iniciarEquipo(contexto) {
    c = contexto;
    Object.assign(c.estado, { formPersona: null, editandoPersona: null });
}

export function escucharEquipo() {
    datos.escucharColeccion("usuarios", (lista) => { aplicarUsuarios(lista); c.render(); });
    datos.escucharColeccion("permisos", (lista) => { aplicarPermisos(lista); c.render(); });
}

// ---------- Consultas ----------

export const activa = (id) => !!PERSONAS[id] && PERSONAS[id].activo !== false;
export const rolDe = (id) => PERSONAS[id]?.rol || "";
export const esAdminGeneral = (id) => rolDe(id) === "admin_general";
/** Ve las pantallas de gestión (Actividad, Tareas…): admin general y encargados. */
export const esGestion = (id) => ["admin_general", "encargado"].includes(rolDe(id));
export const esEquipo = (id) => ["salon", "cocina", "caja"].includes(rolDe(id));

/** ¿La persona tiene este permiso? El admin general, siempre. */
export function puede(permiso, id) {
    const rol = rolDe(id);
    if (!activa(id)) return false;
    if (rol === "admin_general") return true;
    const guardado = permisosGuardados[rol]?.[permiso];
    return guardado ?? !!PERMISOS_DE_FABRICA[rol]?.[permiso];
}

/** Roles que cada uno puede dar al agregar o editar. Nadie nombra otro admin general. */
export function rolesQuePuedeAsignar(actor) {
    if (esAdminGeneral(actor)) return ["encargado", "salon", "cocina", "caja"];
    if (rolDe(actor) === "encargado" && puede("usuarios", actor)) return ["salon", "cocina", "caja"];
    return [];
}

/** ¿actor puede editar o dar de baja a objetivo? Nunca a sí mismo ni al admin general. */
export function puedeGestionar(actor, objetivo) {
    if (!actor || !objetivo || actor === objetivo || esAdminGeneral(objetivo)) return false;
    if (esAdminGeneral(actor)) return true;
    return rolDe(actor) === "encargado" && puede("usuarios", actor) && esEquipo(objetivo);
}

// ---------- Pantalla: Equipo y permisos ----------

const esc = (s) => c.esc(s);
const formVacio = (rol = "salon") => ({ nombre: "", rol, puesto: "", local: "" });

function dondeTrabaja(id) {
    const turnos = Object.entries(LOCALES).flatMap(([lid, l]) =>
        Object.entries(l.turnos).filter(([, p]) => p === id).map(([t]) => `${l.nombre} ${t === "manana" ? "mañana" : "tarde"}`));
    if (turnos.length) return turnos.join(" · ");
    return PERSONAS[id]?.local ? LOCALES[PERSONAS[id].local]?.nombre : "Los dos locales";
}

function camposPersona(f, prefijo, roles) {
    return `
    <label>Nombre
        <input data-${prefijo}-campo="nombre" data-foco="${prefijo}-nombre" maxlength="40" required value="${esc(f.nombre)}" placeholder="Ej: Tomás">
    </label>
    <div class="formulario__fila">
        <label>Rol
            <select data-${prefijo}-campo="rol">
                ${roles.map((r) => `<option value="${r}" ${f.rol === r ? "selected" : ""}>${ROLES[r].nombre}</option>`).join("")}
            </select>
        </label>
        <label>Puesto (cómo se muestra)
            <input data-${prefijo}-campo="puesto" data-foco="${prefijo}-puesto" maxlength="30" value="${esc(f.puesto)}" placeholder="Ej: ${ROLES[f.rol]?.puestoSugerido || "moza"}">
        </label>
    </div>
    <label>Local
        <select data-${prefijo}-campo="local">
            <option value="" ${!f.local ? "selected" : ""}>Los dos locales</option>
            ${Object.entries(LOCALES).map(([id, l]) => `<option value="${id}" ${f.local === id ? "selected" : ""}>${l.nombre}</option>`).join("")}
        </select>
    </label>`;
}

function tarjetaPersona(id) {
    const p = PERSONAS[id];
    const yo = c.estado.persona;
    const baja = p.activo === false;
    if (c.estado.editandoPersona?.id === id) {
        return `
        <article class="miembro miembro--editando">
            <form class="formulario formulario--compacto" id="form-editar-persona">
                ${camposPersona(c.estado.editandoPersona, "ep", rolesQuePuedeAsignar(yo))}
                <div class="tarea__botones">
                    <button class="boton" type="submit">Guardar</button>
                    <button class="boton boton--suave" type="button" data-persona-cancelar>Cancelar</button>
                </div>
            </form>
        </article>`;
    }
    return `
    <article class="miembro ${baja ? "is-baja" : ""}">
        <span class="evento__avatar evento__avatar--${id}" aria-hidden="true">${esc(p.nombre.slice(0, 2).toUpperCase())}</span>
        <div class="miembro__datos">
            <p><strong>${esc(p.nombre)}</strong>${id === yo ? " (vos)" : ""} · ${esc(p.puesto || "")}</p>
            <p class="miembro__meta"><span class="rol-chip rol-chip--${p.rol}">${ROLES[p.rol]?.nombre || p.rol}</span> ${esc(dondeTrabaja(id))}${baja ? ` · <strong class="texto-alerta">Dado/a de baja</strong>` : ""}</p>
        </div>
        ${puedeGestionar(yo, id) ? `
        <div class="miembro__acciones">
            ${baja ? `<button class="boton boton--suave" data-persona-alta="${id}">Reactivar</button>`
                : `<button class="producto__editar" data-persona-editar="${id}" aria-label="Editar a ${esc(p.nombre)}">✏️</button>
                   <button class="boton boton--suave" data-persona-baja="${id}">Dar de baja</button>`}
        </div>` : ""}
    </article>`;
}

function tablaPermisos() {
    const editable = esAdminGeneral(c.estado.persona);
    const roles = ["encargado", "salon", "cocina", "caja"];
    return `
    <section class="momento">
        <h2 class="momento__titulo">🔐 Permisos por rol</h2>
        <p class="formulario__ayuda">${editable ? "Tocá un casillero para dar o sacar un permiso. Se aplica al instante a todas las personas de ese rol." : "Solo el admin general los cambia."} El admin general puede todo.</p>
        <div class="tabla-scroll">
            <table class="permisos">
                <thead><tr><th>Permiso</th><th>Admin general</th>${roles.map((r) => `<th>${ROLES[r].nombre}</th>`).join("")}</tr></thead>
                <tbody>
                    ${PERMISOS.map((pm) => `
                    <tr>
                        <td>${esc(pm.texto)}</td>
                        <td class="permisos__fijo">✓</td>
                        ${roles.map((r) => {
                            if (pm.gestion && r !== "encargado") return `<td class="permisos__na">—</td>`;
                            const val = permisosGuardados[r]?.[pm.id] ?? !!PERMISOS_DE_FABRICA[r]?.[pm.id];
                            return `<td><input type="checkbox" ${val ? "checked" : ""} ${editable ? "" : "disabled"} data-permiso="${pm.id}" data-permiso-rol="${r}" aria-label="${esc(pm.texto)} · ${ROLES[r].nombre}"></td>`;
                        }).join("")}
                    </tr>`).join("")}
                </tbody>
            </table>
        </div>
        ${editable ? `<button class="boton boton--suave" data-permisos-fabrica>Volver a los permisos de fábrica</button>` : ""}
    </section>`;
}

export function vistaEquipo() {
    const yo = c.estado.persona;
    const roles = rolesQuePuedeAsignar(yo);
    if (!c.estado.formPersona) c.estado.formPersona = formVacio(roles.includes("salon") ? "salon" : roles[0]);
    const orden = ["admin_general", "encargado", "salon", "cocina", "caja"];
    const ids = Object.keys(PERSONAS).sort((a, b) =>
        (PERSONAS[a].activo === false) - (PERSONAS[b].activo === false) || orden.indexOf(rolDe(a)) - orden.indexOf(rolDe(b)));
    return `
    <section class="encabezado">
        <h1>👥 Equipo y permisos</h1>
        <p>Quién trabaja en Cremona, con qué rol y qué puede hacer cada rol. Las personas de baja no aparecen al entrar,
        pero su historial queda.</p>
    </section>
    <section class="momento">
        <h2 class="momento__titulo">Equipo · ${ids.filter(activa).length} activos</h2>
        <div class="miembros">${ids.map(tarjetaPersona).join("")}</div>
    </section>
    ${roles.length ? `
    <form class="formulario" id="form-persona">
        <h2>➕ Agregar persona</h2>
        ${camposPersona(c.estado.formPersona, "np", roles)}
        <p class="formulario__ayuda">En la demo entra tocando su nombre con la clave del equipo. Las tareas fijas de la
        semana se reparten aparte; mientras tanto puede usar el salón, la cocina, las notas y los pedidos según su rol.</p>
        <button class="boton boton--grande" type="submit">Agregar al equipo</button>
    </form>` : ""}
    ${tablaPermisos()}`;
}

// ---------- Acciones ----------

const idDe = (nombre) => `${nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "persona"}-${Math.random().toString(36).slice(2, 6)}`;

async function guardarPersona(id, datosPersona) {
    await datos.guardarEn("usuarios", { id, ...datosPersona, editadoPor: c.estado.persona, editado: new Date().toISOString() });
}

async function agregarPersona() {
    const f = c.estado.formPersona;
    const nombre = f.nombre.trim();
    if (!nombre) return c.aviso("Escribí el nombre");
    if (!rolesQuePuedeAsignar(c.estado.persona).includes(f.rol)) return c.aviso("No podés dar ese rol");
    const id = idDe(nombre);
    await guardarPersona(id, { nombre, rol: f.rol, puesto: f.puesto.trim() || ROLES[f.rol].puestoSugerido, local: f.local, activo: true, creadoPor: c.estado.persona });
    c.estado.formPersona = formVacio(f.rol);
    c.aviso(`${nombre} se sumó al equipo ✓`, "ok");
    c.render();
}

async function guardarEdicion() {
    const f = c.estado.editandoPersona;
    if (!f || !puedeGestionar(c.estado.persona, f.id)) return;
    const nombre = f.nombre.trim();
    if (!nombre) return c.aviso("Escribí el nombre");
    if (!rolesQuePuedeAsignar(c.estado.persona).includes(f.rol)) return c.aviso("No podés dar ese rol");
    await guardarPersona(f.id, { ...PERSONAS[f.id], nombre, rol: f.rol, puesto: f.puesto.trim() || ROLES[f.rol].puestoSugerido, local: f.local });
    c.estado.editandoPersona = null;
    c.aviso(`${nombre}: cambios guardados ✓`, "ok");
    c.render();
}

async function cambiarAlta(id, activo) {
    if (!puedeGestionar(c.estado.persona, id)) return;
    const p = PERSONAS[id];
    if (!activo && !confirm(`¿Dar de baja a ${p.nombre}? No va a poder entrar, pero su historial queda y se puede reactivar.`)) return;
    await guardarPersona(id, { ...p, activo });
    c.aviso(activo ? `${p.nombre} vuelve al equipo ✓` : `${p.nombre} quedó dado/a de baja`, "ok");
}

async function cambiarPermiso(rol, permiso, valor) {
    if (!esAdminGeneral(c.estado.persona)) return;
    const roles = JSON.parse(JSON.stringify(permisosGuardados));
    roles[rol] = { ...(roles[rol] || {}), [permiso]: valor };
    await datos.guardarEn("permisos", { id: "roles", roles, editadoPor: c.estado.persona, editado: new Date().toISOString() });
    c.aviso("Permiso actualizado ✓", "ok");
}

export function conectarEquipo(on) {
    const e = c.estado;
    on("[data-np-campo]", "input", (el) => { e.formPersona[el.dataset.npCampo] = el.value; });
    on("[data-np-campo]", "change", (el) => { e.formPersona[el.dataset.npCampo] = el.value; });
    on("[data-ep-campo]", "input", (el) => { e.editandoPersona[el.dataset.epCampo] = el.value; });
    on("[data-ep-campo]", "change", (el) => { e.editandoPersona[el.dataset.epCampo] = el.value; });
    on("#form-persona", "submit", (el, ev) => { ev.preventDefault(); agregarPersona(); });
    on("#form-editar-persona", "submit", (el, ev) => { ev.preventDefault(); guardarEdicion(); });
    on("[data-persona-editar]", "click", (el) => {
        const p = PERSONAS[el.dataset.personaEditar];
        e.editandoPersona = { id: el.dataset.personaEditar, nombre: p.nombre, rol: p.rol, puesto: p.puesto || "", local: p.local || "" };
        c.render();
    });
    on("[data-persona-cancelar]", "click", () => { e.editandoPersona = null; c.render(); });
    on("[data-persona-baja]", "click", (el) => cambiarAlta(el.dataset.personaBaja, false));
    on("[data-persona-alta]", "click", (el) => cambiarAlta(el.dataset.personaAlta, true));
    on("[data-permiso]", "change", (el) => cambiarPermiso(el.dataset.permisoRol, el.dataset.permiso, el.checked));
    on("[data-permisos-fabrica]", "click", async () => {
        if (!confirm("¿Volver todos los permisos a como venían de fábrica?")) return;
        await datos.guardarEn("permisos", { id: "roles", roles: {}, editadoPor: e.persona, editado: new Date().toISOString() });
        c.aviso("Permisos de fábrica restaurados ✓", "ok");
    });
}
