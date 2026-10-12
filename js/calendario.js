// ============================================
// Lógica de fechas: semana del mes, lunes, turnos y qué le toca a quién.
// ============================================
import { TAREAS, LOCALES, FECHA_INICIO } from "./config.js";

// Tareas agregadas por Carolina desde la app (se suman a las de config.js).
let tareasExtra = [];
export const setTareasExtra = (lista) => { tareasExtra = lista; };
export const todasLasTareas = () => [...TAREAS, ...tareasExtra];

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Fecha "de hoy". Para probar se puede simular con ?fecha=2026-09-28&hora=15:00 en la URL.
export function ahora() {
    const params = new URLSearchParams(location.search);
    const d = new Date();
    if (params.get("fecha")) {
        const [a, m, dia] = params.get("fecha").split("-").map(Number);
        d.setFullYear(a, m - 1, dia);
    }
    if (params.get("hora")) {
        const [h, min] = params.get("hora").split(":").map(Number);
        d.setHours(h, min, 0, 0);
    }
    return d;
}

export const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const desdeIso = (s) => {
    const [a, m, d] = s.split("-").map(Number);
    return new Date(a, m - 1, d);
};

export const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const diasEntre = (a, b) =>
    Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);

export const nombreDia = (d) => DIAS[d.getDay()];
export const fechaLarga = (d) => `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
export const nombreMes = (mes) => MESES[mes];

// Próximo día que abren los locales (lunes a sábado).
export function proximoDiaHabil(d) {
    let s = sumarDias(d, 1);
    if (s.getDay() === 0) s = sumarDias(s, 1);
    return s;
}

export function semanaDelMes(d) {
    const dia = d.getDate();
    if (dia <= 7) return 1;
    if (dia <= 14) return 2;
    if (dia <= 21) return 3;
    return 4;
}

// Bloque = una "semana del mes" concreta, ej. semana 4 de septiembre 2026 (días 22 al 30).
export function bloque(anio, mes, semana) {
    const inicio = new Date(anio, mes, (semana - 1) * 7 + 1);
    const fin = semana === 4 ? new Date(anio, mes + 1, 0) : new Date(anio, mes, semana * 7);
    return {
        anio, mes, semana, inicio, fin,
        clave: `${anio}-${String(mes + 1).padStart(2, "0")}-s${semana}`
    };
}

export const bloqueDe = (d) => bloque(d.getFullYear(), d.getMonth(), semanaDelMes(d));

export function bloqueAnterior(b) {
    if (b.semana > 1) return bloque(b.anio, b.mes, b.semana - 1);
    const d = new Date(b.anio, b.mes, 0); // último día del mes anterior
    return bloque(d.getFullYear(), d.getMonth(), 4);
}

// Lunes de la semana (lunes a domingo) que contiene la fecha.
export function lunesDe(d) {
    const dif = (d.getDay() + 6) % 7;
    return sumarDias(d, -dif);
}

export function turnoActual(localId, d) {
    const [h, m] = LOCALES[localId].cambioTurno.split(":").map(Number);
    return d.getHours() * 60 + d.getMinutes() < h * 60 + m ? "manana" : "tarde";
}

function personaDelLunes(tarea, lunes) {
    if (tarea.persona) return tarea.persona;
    const semanas = Math.round(diasEntre(desdeIso(tarea.desde), lunes) / 7);
    const i = ((semanas % tarea.rotacion.length) + tarea.rotacion.length) % tarea.rotacion.length;
    return tarea.rotacion[i];
}

// Todas las asignaciones de un bloque (semana del mes): tareas semanales de ese bloque
// y los lavados de cafetera de cada lunes que cae dentro del bloque.
export function asignacionesDelBloque(b) {
    const lista = [];
    for (const t of todasLasTareas()) {
        if (t.tipo === "semanal" && t.semanas[b.semana]) {
            lista.push({
                id: `${t.id}_${b.clave}`, tarea: t, persona: t.semanas[b.semana],
                desde: b.inicio, hasta: b.fin, periodo: `Semana ${b.semana}`
            });
        }
        if (t.tipo === "lunes") {
            for (let d = new Date(b.inicio); d <= b.fin; d = sumarDias(d, 1)) {
                if (d.getDay() === 1) lista.push(asignacionLunes(t, d));
            }
        }
    }
    return lista;
}

function asignacionLunes(t, lunes) {
    return {
        id: `${t.id}_${iso(lunes)}`, tarea: t, persona: personaDelLunes(t, lunes),
        desde: lunes, hasta: sumarDias(lunes, 5), periodo: `Lunes ${lunes.getDate()}`, lunes
    };
}

// Lo que corresponde "ahora": tareas del bloque actual + cafetera del lunes de esta semana.
export function asignacionesActuales(hoy) {
    const b = bloqueDe(hoy);
    const lista = todasLasTareas().filter((t) => t.tipo === "semanal" && t.semanas[b.semana]).map((t) => ({
        id: `${t.id}_${b.clave}`, tarea: t, persona: t.semanas[b.semana],
        desde: b.inicio, hasta: b.fin, periodo: `Semana ${b.semana}`
    }));
    const lunes = lunesDe(hoy);
    for (const t of todasLasTareas().filter((t) => t.tipo === "lunes")) lista.push(asignacionLunes(t, lunes));
    return lista;
}

// Lo del período anterior (para mostrar lo que quedó pendiente).
export function asignacionesAnteriores(hoy) {
    const b = bloqueAnterior(bloqueDe(hoy));
    const lista = todasLasTareas().filter((t) => t.tipo === "semanal" && t.semanas[b.semana]).map((t) => ({
        id: `${t.id}_${b.clave}`, tarea: t, persona: t.semanas[b.semana],
        desde: b.inicio, hasta: b.fin, periodo: `Semana ${b.semana}`
    }));
    const lunesPasado = sumarDias(lunesDe(hoy), -7);
    for (const t of todasLasTareas().filter((t) => t.tipo === "lunes")) lista.push(asignacionLunes(t, lunesPasado));
    return lista.filter(despuesDelInicio);
}

// true si la asignación termina el día de inicio o después (lo anterior no se cuenta).
export const despuesDelInicio = (a) => iso(a.hasta) >= FECHA_INICIO;

export const tareasLibres = () => todasLasTareas().filter((t) => t.tipo === "libre");

// En qué local está (o estará) hoy una persona según la hora. null si no trabaja en ningún local.
export function dondeEsta(persona, d) {
    const locales = Object.entries(LOCALES).filter(([, l]) => Object.values(l.turnos).includes(persona));
    if (!locales.length) return null;
    const ahoraMismo = locales.find(([id, l]) => l.turnos[turnoActual(id, d)] === persona);
    const [id, l] = ahoraMismo || locales[0];
    const turno = Object.entries(l.turnos).find(([, p]) => p === persona)[0];
    return { local: id, turno };
}
