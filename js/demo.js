// ============================================
// Datos de ejemplo para la DEMO (solo en modo prueba).
// La primera vez que alguien abre la app en un navegador, se cargan algunas tareas hechas,
// notas, pedidos y recordatorios, así no arranca vacía. Todo es inventado y queda solo en ese navegador.
// "Borrar datos de prueba" lo saca y no se vuelve a cargar (salvo que se borre "cr-demo-sembrado").
// ============================================
import { CHECKLISTS } from "./config.js";
import * as cal from "./calendario.js";

const MARCA = "cr-demo-sembrado";
// Si cambian las personas o los datos de ejemplo, se sube la versión: los navegadores que ya tenían la demo
// borran sus datos de prueba y cargan los nuevos una vez. (2 = "Abril" pasó a ser "Valentín", 12/10/2026)
const VERSION = "2";
const guardar = (clave, docs) => localStorage.setItem(clave, JSON.stringify(Object.fromEntries(docs.map((d) => [d.id, d]))));

// Fecha y hora (ISO) de un día a una hora dada.
const a_las = (dia, h, m = 0) => {
    const d = new Date(dia);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
};

// Último día hábil (lunes a sábado) antes de hoy.
function ayerHabil(hoy) {
    let d = cal.sumarDias(hoy, -1);
    if (d.getDay() === 0) d = cal.sumarDias(d, -1);
    return d;
}

// Tareas hechas: todo lo de la semana anterior (salvo una, para que se vea "Quedó de la semana pasada")
// y la mitad de lo que va de esta semana.
function registros(hoy) {
    const inicio = cal.desdeIso(cal.iso(cal.sumarDias(hoy, -21)));
    const ayer = cal.sumarDias(hoy, -1);
    const anteriores = cal.asignacionesDelBloque(cal.bloqueAnterior(cal.bloqueDe(hoy)));
    const actuales = cal.asignacionesDelBloque(cal.bloqueDe(hoy));
    const elegidas = [...anteriores.slice(1), ...actuales.filter((_, i) => i % 2 === 0)];
    const lista = [];
    elegidas.forEach((a, i) => {
        // Un día dentro del período que ya haya pasado (y no domingo)
        const desde = a.desde > inicio ? a.desde : inicio;
        const hasta = a.hasta < ayer ? a.hasta : ayer;
        const dias = cal.diasEntre(desde, hasta);
        if (dias < 0) return;
        let dia = cal.sumarDias(desde, i % (dias + 1));
        if (dia.getDay() === 0) dia = dia > desde ? cal.sumarDias(dia, -1) : cal.sumarDias(dia, 1);
        if (dia > hasta) return;
        const cuando = a_las(dia, 10 + (i % 7), 15);
        lista.push({
            id: a.id, tipo: "hecha", tareaId: a.tarea.id, local: a.tarea.local, persona: a.persona, asignadaA: a.persona,
            asignacionId: a.id, fecha: cal.iso(dia), cuando, turno: cal.turnoActual(a.tarea.local, new Date(cuando)),
            nota: i % 5 === 0 ? "Listo, quedó impecable" : "", uid: `demo-${a.persona}`
        });
    });
    return lista;
}

export function sembrarDemo() {
    try {
        const previa = localStorage.getItem(MARCA);
        if (previa === VERSION) return;
        if (previa) {
            // Datos de una versión anterior: se borran (menos la clave del equipo ya puesta) y se cargan los nuevos.
            Object.keys(localStorage)
                .filter((k) => k.startsWith("cr-demo-") && k !== "cr-demo-equipo" && k !== "cr-demo-usuario")
                .forEach((k) => localStorage.removeItem(k));
            if (localStorage.getItem("cr-demo-usuario") === "abril") localStorage.removeItem("cr-demo-usuario");
        }
        const hoy = cal.ahora();
        const ayer = ayerHabil(hoy);
        const iso = cal.iso;
        const dias = (n) => new Date(hoy.getTime() + n * 86400000).toISOString();

        guardar("cr-demo-registros", registros(hoy));

        guardar("cr-demo-notasTurno", [
            { id: "turno-demo-1", local: "plaza", fecha: iso(ayer), cuando: a_las(ayer, 15, 50), turno: "manana", persona: "valentin",
              texto: "Quedaron 2 porciones de lemon pie y media chocotorta en la heladera de atrás. La leche de almendras se terminó.", uid: "demo-valentin" },
            { id: "turno-demo-2", local: "centro", fecha: iso(hoy), cuando: a_las(hoy, 9, 20), turno: "manana", persona: "mica",
              texto: "La cafetera hace un ruido raro al calentar la leche: ya le avisé a Carolina. La señora de la torta de cumpleaños pasa a las 18.", uid: "demo-mica" }
        ]);

        guardar("cr-demo-agenda", [
            { id: "agenda-demo-1", fecha: iso(hoy), local: "centro", para: "todas", cuando: dias(-1),
              texto: "Dejar lugar en la heladera: llegan las tortas para el cumpleaños de las 18", uid: "demo-carolina" },
            { id: "agenda-demo-2", fecha: iso(cal.sumarDias(hoy, 3)), local: "plaza", para: "valentin", cuando: dias(-1),
              texto: "Armar la pizarra nueva con la torta de la semana", uid: "demo-carolina" }
        ]);

        guardar("cr-demo-pedidosClientes", [
            { id: "pedido-demo-1", cliente: "Marta", telefono: "11 5555-0101", producto: "Torta Rogel para 15 personas", cantidad: 1,
              pago: "Transferencia", nota: "Con el cartelito \"Feliz cumple, Lucas\"", local: "centro", pagoEstado: "sena", sena: 10000, total: 0,
              estado: "pendiente", persona: "mica", quien: "mica", creado: dias(-2), actualizado: dias(-2), uid: "demo-mica" },
            { id: "pedido-demo-2", cliente: "Rodrigo", telefono: "11 5555-0202", producto: "Docena de alfajores de maicena", cantidad: 2,
              pago: "Efectivo", nota: "", local: "plaza", pagoEstado: "total", sena: 0, total: 18000,
              estado: "llego", persona: "valentin", quien: "valentin", creado: dias(-3), actualizado: dias(-1), uid: "demo-valentin" },
            { id: "pedido-demo-3", cliente: "Paula", telefono: "", producto: "Cheesecake de frutos rojos entero", cantidad: 1,
              pago: "", nota: "Lo quiere para el sábado", local: "plaza", pagoEstado: "nada", sena: 0, total: 0,
              estado: "pendiente", persona: "juli", quien: "juli", creado: dias(-1), actualizado: dias(-1), uid: "demo-juli" }
        ]);

        guardar("cr-demo-notasEquipo", [
            { id: "nota-demo-1", tipo: "texto", titulo: "Rótulos de la vitrina", texto: "Toda torta que se corta lleva su etiqueta con la fecha. Lo de más de 3 días no se vende.",
              descripcion: "", items: [], duracion: "fija", vence: "", persona: "carolina", uidCreadora: "demo-carolina",
              creado: dias(-4), editada: "", editadaPor: "", uid: "demo-carolina" },
            { id: "nota-demo-2", tipo: "lista", titulo: "Faltantes para pedir", texto: "", descripcion: "Lo que se vaya acabando, anotalo acá.",
              items: [
                  { id: "i1", texto: "Vasos de 8 oz para llevar", hecho: true, hechoPor: "mica" },
                  { id: "i2", texto: "Servilletas", hecho: false, hechoPor: "" },
                  { id: "i3", texto: "Sobres de edulcorante", hecho: false, hechoPor: "" }
              ],
              duracion: "1s", vence: dias(5), persona: "juli", uidCreadora: "demo-juli",
              creado: dias(-2), editada: "", editadaPor: "", uid: "demo-juli" }
        ]);

        guardar("cr-demo-recordatorios", [
            { id: "rec-demo-1", persona: "mica", texto: "Comprar velitas de cumpleaños antes del viernes", duracion: "1s", fecha: "",
              vence: dias(6), autora: "carolina", creado: dias(-1), editado: "", uid: "demo-carolina" },
            { id: "rec-demo-2", persona: "juli", texto: "Devolverle a Valentín el táper de las medialunas", duracion: "sin", fecha: "",
              vence: "", autora: "valentin", creado: dias(-2), editado: "", uid: "demo-valentin" },
            { id: "rec-demo-3", persona: "carolina", texto: "Llamar al técnico por la cafetera del Centro", duracion: "3d", fecha: "",
              vence: dias(2), autora: "mica", creado: dias(0), editado: "", uid: "demo-mica" }
        ]);

        // Checklist de apertura de ayer, completo (Carolina lo ve en Actividad).
        const c = CHECKLISTS[0];
        if (c) {
            const hechos = Object.fromEntries(c.items.map((it, i) => [it.id, a_las(ayer, 8, 30 + i * 3)]));
            guardar("cr-demo-checklists", [{
                id: `${c.id}_${iso(ayer)}`, checklist: c.id, persona: c.persona, local: c.local, fecha: iso(ayer), hechos,
                completo: true, completoEn: a_las(ayer, 9, 0), actualizado: a_las(ayer, 9, 0), uid: `demo-${c.persona}`
            }]);
        }

        // ---------- Funciones traídas de Restix (js/extras.js) ----------
        // Stock: algunos insumos ya en el mínimo, para que se vean los faltantes.
        const stock = {
            centro: { crema: 3, leche: 18, cafe: 5, manteca: 4, harina: 25, azucar: 8, huevos: 2, vasos: 6 },
            plaza: { crema: 7, leche: 12, cafe: 2, manteca: 3, harina: 15, azucar: 6, huevos: 4, vasos: 2 }
        };
        guardar("cr-demo-stock", Object.entries(stock).flatMap(([local, cosas]) => Object.entries(cosas).map(([insumo, cantidad], i) => ({
            id: `${local}_${insumo}`, local, insumo, cantidad, persona: local === "centro" ? "mica" : "valentin",
            actualizado: a_las(ayer, 9 + i, 10), uid: `demo-${local === "centro" ? "mica" : "valentin"}`
        }))));

        // Producción de hoy: con horas relativas a ahora (una urgente, una cerca, una tranquila y una lista).
        const horaEn = (min) => {
            const d = new Date(hoy.getTime() + min * 60000);
            if (iso(d) !== iso(hoy)) return "23:45";
            return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        };
        const encargo = (id, local, min, producto, cantidad, nota, persona, listo = false) => ({
            id, local, fecha: iso(hoy), hora: horaEn(min), producto, cantidad, nota, estado: listo ? "listo" : "pendiente",
            persona, creado: dias(-1), listoPor: listo ? "juli" : "", listoEn: listo ? dias(0) : "", uid: `demo-${persona}`
        });
        guardar("cr-demo-produccion", [
            encargo("prod-demo-1", "centro", 15, "Torta Rogel para 15 personas", 1, "Cartel \"Feliz cumple, Lucas\"", "mica"),
            encargo("prod-demo-2", "centro", 50, "Docena de medialunas de manteca", 3, "", "mica"),
            encargo("prod-demo-3", "centro", 200, "Lemon pie entero", 1, "Para llevar, en caja", "carolina"),
            encargo("prod-demo-4", "centro", -60, "Alfajores de maicena", 24, "", "juli", true),
            encargo("prod-demo-5", "plaza", 35, "Cheesecake de frutos rojos", 1, "Sin base de galletita", "mica"),
            encargo("prod-demo-6", "plaza", 150, "Budín de limón", 2, "", "valentin")
        ]);

        // Cierres de caja de ayer: uno cerró bien y otro con faltante.
        guardar("cr-demo-cajas", [
            { id: `centro_${iso(ayer)}_manana`, local: "centro", fecha: iso(ayer), turno: "manana", fondo: 20000, vendido: 185000,
              efectivo: 82000, transferencias: 71000, tarjetas: 52000, gastos: 0, diferencia: 0, nota: "",
              persona: "mica", cuando: a_las(ayer, 14, 35), uid: "demo-mica" },
            { id: `plaza_${iso(ayer)}_tarde`, local: "plaza", fecha: iso(ayer), turno: "tarde", fondo: 20000, vendido: 143500,
              efectivo: 68000, transferencias: 40000, tarjetas: 51000, gastos: 3000, diferencia: -1500, nota: "Pagué $3.000 de hielo",
              persona: "mica", cuando: a_las(ayer, 20, 15), uid: "demo-mica" }
        ]);

        guardar("cr-demo-notasDuena", [
            { id: "nota-demo-duena", texto: "Pedir presupuesto de crema a otro proveedor: subió mucho este mes.", cuando: dias(-1), uid: "demo-carolina" }
        ]);

        localStorage.setItem(MARCA, VERSION);
    } catch {
        // Sin almacenamiento (ventana privada estricta): la demo arranca vacía.
    }
}
