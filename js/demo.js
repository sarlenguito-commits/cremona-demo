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
// borran sus datos de prueba y cargan los nuevos una vez. (2 = "Abril" pasó a ser "Valentín";
// 3 = checklists de la moza con la puesta a punto del salón y encargos "entregados";
// 4 = Valentín admin general, cobros de mesas y mapa del salón;
// 5 = marca, carta y local reales de Cremona Coffee & Brunch; todo el 12/10/2026)
const VERSION = "5";
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
            { id: "turno-demo-1", local: "centro", fecha: iso(ayer), cuando: a_las(ayer, 13, 50), turno: "manana", persona: "mica",
              texto: "Quedaron 2 porciones de Lemon Pie y medio Matilda lingote en la heladera de atrás. La leche de almendra se terminó.", uid: "demo-mica" },
            { id: "turno-demo-2", local: "centro", fecha: iso(hoy), cuando: a_las(hoy, 9, 20), turno: "manana", persona: "mica",
              texto: "La cafetera hace un ruido raro al calentar la leche: ya le avisé a Carolina. La señora de la torta de cumpleaños pasa a las 18.", uid: "demo-mica" }
        ]);

        guardar("cr-demo-agenda", [
            { id: "agenda-demo-1", fecha: iso(hoy), local: "centro", para: "todas", cuando: dias(-1),
              texto: "Dejar lugar en la heladera: llegan las tortas para el cumpleaños de las 18", uid: "demo-carolina" },
            { id: "agenda-demo-2", fecha: iso(cal.sumarDias(hoy, 3)), local: "centro", para: "juli", cuando: dias(-1),
              texto: "Probar la torta del mes nueva antes de ponerla en la vitrina", uid: "demo-carolina" }
        ]);

        guardar("cr-demo-pedidosClientes", [
            { id: "pedido-demo-1", cliente: "Marta", telefono: "11 5555-0101", producto: "Rogel entero para 15 personas", cantidad: 1,
              pago: "Transferencia", nota: "Con el cartelito \"Feliz cumple, Lucas\"", local: "centro", pagoEstado: "sena", sena: 10000, total: 0,
              estado: "pendiente", persona: "mica", quien: "mica", creado: dias(-2), actualizado: dias(-2), uid: "demo-mica" },
            { id: "pedido-demo-2", cliente: "Rodrigo", telefono: "11 5555-0202", producto: "Caja de 12 Alfajores Cremona", cantidad: 2,
              pago: "Efectivo", nota: "", local: "centro", pagoEstado: "total", sena: 0, total: 18000,
              estado: "llego", persona: "mica", quien: "mica", creado: dias(-3), actualizado: dias(-1), uid: "demo-mica" },
            { id: "pedido-demo-3", cliente: "Paula", telefono: "", producto: "Cheesecake New York entero", cantidad: 1,
              pago: "", nota: "Lo quiere para el sábado", local: "centro", pagoEstado: "nada", sena: 0, total: 0,
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
            { id: "rec-demo-2", persona: "juli", texto: "Pedir más leche de almendra (se terminó el sábado)", duracion: "sin", fecha: "",
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
            centro: { crema: 3, leche: 18, cafe: 2, manteca: 4, harina: 25, azucar: 8, huevos: 2, vasos: 6 }
        };
        guardar("cr-demo-stock", Object.entries(stock).flatMap(([local, cosas]) => Object.entries(cosas).map(([insumo, cantidad], i) => ({
            id: `${local}_${insumo}`, local, insumo, cantidad, persona: "mica",
            actualizado: a_las(ayer, 9 + i, 10), uid: "demo-mica"
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
            encargo("prod-demo-1", "centro", 15, "Rogel entero para 15 personas", 1, "Cartel \"Feliz cumple, Lucas\"", "mica"),
            encargo("prod-demo-2", "centro", 50, "Docena de medialunas de manteca", 3, "", "mica"),
            encargo("prod-demo-3", "centro", 200, "Lemon Pie entero", 1, "Para llevar, en caja", "carolina"),
            encargo("prod-demo-4", "centro", -60, "Alfajores Cremona", 24, "", "juli", true),
            encargo("prod-demo-5", "centro", 35, "Cheesecake New York", 1, "Sin base de galletita", "mica"),
            encargo("prod-demo-6", "centro", 150, "Budín de limón", 2, "", "juli")
        ]);

        // Cierres de caja de ayer: uno cerró bien y otro con faltante.
        guardar("cr-demo-cajas", [
            { id: `centro_${iso(ayer)}_manana`, local: "centro", fecha: iso(ayer), turno: "manana", fondo: 20000, vendido: 185000,
              efectivo: 82000, transferencias: 71000, tarjetas: 52000, gastos: 0, diferencia: 0, nota: "",
              persona: "mica", cuando: a_las(ayer, 14, 35), uid: "demo-mica" },
            { id: `centro_${iso(ayer)}_tarde`, local: "centro", fecha: iso(ayer), turno: "tarde", fondo: 20000, vendido: 143500,
              efectivo: 68000, transferencias: 40000, tarjetas: 51000, gastos: 3000, diferencia: -1500, nota: "Pagué $3.000 de hielo",
              persona: "mica", cuando: a_las(ayer, 20, 15), uid: "demo-mica" }
        ]);

        // ---------- Salón y comandas (js/salon.js) ----------
        // Centro: mesa 3 con un tostado en cocina, mesa 5 con wafles listos para llevar, mesa 7 con algo sin mandar.
        // Mesa 2 con una comanda demorada (roja), para que se vea en cocina.
        const hace = (min) => new Date(hoy.getTime() - min * 60000).toISOString();
        const linea = (id, itemId, nombre, precio, cantidad, cocina = false, comanda = "") => ({ id, itemId, nombre, precio, cantidad, cocina, comanda });
        const mesa = (id, local, numero, abierta, moza, pedido) => ({
            id, local, numero, estado: "abierta", pedido, abiertaPor: moza, abiertaEn: hace(abierta),
            cerradaPor: "", cerradaEn: "", total: 0, uid: `demo-${moza}`
        });
        guardar("cr-demo-mesas", [
            mesa("mesa-demo-3", "centro", 3, 25, "mica", [
                linea("l1", "cafe-latte", "Latte", 5700, 2), linea("l2", "viennoiserie-medialuna-de-manteca", "Medialuna de manteca", 4400, 3),
                linea("l3", "opciones-saladas-tostado-de-jamon-y-queso", "Tostado de jamón y queso", 10300, 1, true, "comanda-demo-1")]),
            mesa("mesa-demo-5", "centro", 5, 40, "mica", [
                linea("l4", "cafe-cappuccino", "Cappuccino", 5700, 2), linea("l5", "opciones-saladas-avocado-toast", "Avocado toast", 14000, 2, true, "comanda-demo-2")]),
            mesa("mesa-demo-7", "centro", 7, 4, "mica", [
                linea("l6", "bebidas-licuado-de-banana", "Licuado de banana", 7200, 1), linea("l7", "brunch-huevos-benedictinos", "Huevos benedictinos", 11500, 1, true)]),
            mesa("mesa-demo-p2", "centro", 2, 35, "mica", [
                linea("l8", "especiales-sin-cafe-te-en-hebras", "Té en hebras", 5300, 2), linea("l9", "brunch-bagel-de-salmon-y-queso-crema", "Bagel de salmón y queso crema", 21800, 2, true, "comanda-demo-3")])
        ]);
        // Cobros: una cuenta que la moza pasó a caja (la ve Nati) y una mesa que la moza ya cobró en efectivo.
        const cuenta = (id, numero, min, pedido, extra) => ({
            ...mesa(id, "centro", numero, min + 40, "mica", pedido), total: pedido.reduce((s, l) => s + l.precio * l.cantidad, 0), ...extra
        });
        const conCobros = JSON.parse(localStorage.getItem("cr-demo-mesas"));
        const cobrada = new Date(hoy.getTime() - 60 * 60000);
        Object.assign(conCobros, Object.fromEntries([
            cuenta("mesa-demo-pc", 6, 3, [linea("l10", "cafe-flat-white", "Flat White", 5700, 2), linea("l11", "tortas-lemon-pie", "Lemon Pie", 13800, 2)],
                { estado: "por-cobrar", pasadaPor: "mica", pasadaEn: hace(3) }),
            cuenta("mesa-demo-cob", 4, 60, [linea("l12", "especiales-sin-cafe-chocolate-caliente-submarino", "Chocolate caliente / Submarino", 6300, 1), linea("l13", "viennoiserie-croissant-clasico", "Croissant clásico", 4700, 2)],
                { estado: "cerrada", cerradaPor: "mica", cerradaEn: cobrada.toISOString(),
                  cobro: { medio: "efectivo", por: "mica", en: cobrada.toISOString(), fecha: iso(cobrada), turno: cal.turnoActual("centro", cobrada) } })
        ].map((m) => [m.id, m])));
        localStorage.setItem("cr-demo-mesas", JSON.stringify(conCobros));
        const comanda = (id, local, numero, mesaId, items, enviada, estado, listoPor = "", listoHace = 0) => ({
            id, local, numero, mesaId, items, estado, moza: "mica", enviada: hace(enviada),
            listoPor, listoEn: listoPor ? hace(listoHace) : "", servidoPor: "", servidoEn: "", uid: "demo-mica"
        });
        guardar("cr-demo-comandas", [
            comanda("comanda-demo-1", "centro", 3, "mesa-demo-3", [{ nombre: "Tostado de jamón y queso", cantidad: 1 }], 9, "en-cocina"),
            comanda("comanda-demo-2", "centro", 5, "mesa-demo-5", [{ nombre: "Avocado toast", cantidad: 2 }], 22, "listo", "juli", 2),
            comanda("comanda-demo-3", "centro", 2, "mesa-demo-p2", [{ nombre: "Bagel de salmón y queso crema", cantidad: 2 }], 28, "en-cocina")
        ]);

        guardar("cr-demo-notasDuena", [
            { id: "nota-demo-duena", texto: "Pedir presupuesto de crema a otro proveedor: subió mucho este mes.", cuando: dias(-1), uid: "demo-carolina" }
        ]);

        localStorage.setItem(MARCA, VERSION);
    } catch {
        // Sin almacenamiento (ventana privada estricta): la demo arranca vacía.
    }
}
