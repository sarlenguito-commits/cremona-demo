// ============================================
// Configuración de la app: Firebase, personas, locales y tareas.
// Para cambiar asignaciones o sumar tareas, se edita solo este archivo.
// ============================================

// Pegar acá la configuración web de Firebase (Consola > Configuración del proyecto > Tus apps).
// Mientras apiKey diga "PEGAR_AQUI", la app funciona en MODO PRUEBA (datos solo en este navegador).
// Esta es una DEMO: queda en modo prueba a propósito.
export const firebaseConfig = {
    apiKey: "PEGAR_AQUI",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

// Día desde el que se cuentan las tareas: lo anterior no se muestra como pendiente ni cuenta en informes.
// En la demo arranca hace 3 semanas, así siempre hay algo de historia (ver js/demo.js).
const inicio = new Date();
inicio.setDate(inicio.getDate() - 21);
export const FECHA_INICIO = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-${String(inicio.getDate()).padStart(2, "0")}`;

// Acceso: Carolina (la dueña) entra con su usuario (carolina@cremona.app) y contraseña.
// Las chicas comparten un usuario del equipo (equipo@cremona.app) con una clave que ponen
// una sola vez por celular; después eligen su nombre. Con Firebase, las claves reales vivirían solo ahí.
export const DOMINIO_LOGIN = "cremona.app";
export const USUARIO_EQUIPO = "equipo";

// Clave del equipo SOLO para el modo prueba (se muestra en la pantalla de entrada).
export const CLAVE_EQUIPO_PRUEBA = "1234";

// Protección contra quien pruebe claves: después de estos intentos fallidos, se bloquea ese celular un rato.
export const INTENTOS_MAXIMOS = 5;
export const MINUTOS_BLOQUEO = 15;

// Nombres inventados para la demo. "puesto" es lo que se muestra al entrar y en su Hoy
// (rol "duena" = ve todo: Actividad, Informes, Tareas, Agenda; sirve también para una encargada).
export const PERSONAS = {
    abril: { nombre: "Abril", rol: "empleada", puesto: "cocinera" },
    mica: { nombre: "Mica", rol: "empleada", puesto: "moza" },
    juli: { nombre: "Juli", rol: "empleada", puesto: "cocinera" },
    carolina: { nombre: "Carolina", rol: "duena", puesto: "dueña" }
};

// cambioTurno: hora en que el turno mañana pasa al turno tarde.
export const LOCALES = {
    centro: {
        nombre: "Centro",
        cambioTurno: "14:30",
        turnos: { manana: "mica", tarde: "juli" }
    },
    plaza: {
        nombre: "Plaza",
        cambioTurno: "16:00",
        turnos: { manana: "abril", tarde: "mica" }
    }
};

// Tipos de tarea:
//  - "semanal": semana del mes (1 = días 1-7, 2 = 8-14, 3 = 15-21, 4 = 22 a fin de mes) → persona
//  - "lunes":   se hace cada lunes; "persona" fija o "rotacion" que alterna un lunes cada una
//  - "libre":   sin asignar todavía; se muestra hace cuántos días se hizo por última vez
export const TAREAS = [
    // ---------- Plaza: Abril (cocinera, mañana) y Mica (moza, tarde) ----------
    { id: "pla-cafetera", local: "plaza", nombre: "Limpieza a fondo de la cafetera (descalcificar y lavar filtros)", tipo: "lunes", persona: "mica" },
    { id: "pla-horno", local: "plaza", nombre: "Limpieza del horno y las placas", tipo: "semanal", semanas: { 1: "abril", 2: "abril", 3: "abril", 4: "abril" } },
    { id: "pla-heladera", local: "plaza", nombre: "Ordenar la heladera de atrás y tirar lo vencido", tipo: "semanal", semanas: { 2: "abril", 4: "abril" } },
    { id: "pla-cocina", local: "plaza", nombre: "Limpieza a fondo de la cocina: mesadas, bacha y campana", tipo: "semanal", semanas: { 1: "abril", 3: "abril" } },
    { id: "pla-deposito", local: "plaza", nombre: "Limpiar y acomodar el depósito (harinas, azúcar, descartables)", tipo: "semanal", semanas: { 2: "abril", 4: "abril" } },
    { id: "pla-vitrina", local: "plaza", nombre: "Limpieza a fondo de la vitrina refrigerada (vidrios, bandejas y burletes)", tipo: "semanal", semanas: { 1: "mica", 3: "mica" } },
    { id: "pla-mesas", local: "plaza", nombre: "Repasar patas de mesas y sillas, y despegar chicles", tipo: "semanal", semanas: { 2: "mica", 4: "mica" } },
    { id: "pla-bano", local: "plaza", nombre: "Limpieza del baño de clientes", tipo: "semanal", semanas: { 1: "mica", 3: "mica" } },
    { id: "pla-vidrios", local: "plaza", nombre: "Limpieza a fondo de los vidrios de la entrada", tipo: "semanal", semanas: { 2: "mica", 4: "mica" } },
    { id: "pla-pizarra", local: "plaza", nombre: "Cambiar la pizarra de la semana (tortas y promos)", tipo: "semanal", semanas: { 1: "mica", 2: "mica", 3: "mica", 4: "mica" } },

    // ---------- Centro: Mica (moza, mañana) y Juli (cocinera, tarde) ----------
    { id: "cen-vitrina", local: "centro", nombre: "Limpieza a fondo de la vitrina de tortas", tipo: "semanal", semanas: { 2: "mica", 4: "mica" } },
    { id: "cen-barra", local: "centro", nombre: "Limpieza de la barra y los estantes de tazas", tipo: "semanal", semanas: { 1: "mica", 3: "mica" } },
    { id: "cen-molinillo", local: "centro", nombre: "Limpiar el molinillo de café y la tolva", tipo: "semanal", semanas: { 2: "mica", 4: "mica" } },
    { id: "cen-exterior", local: "centro", nombre: "Limpieza de la vereda, el toldo y las mesas de afuera", tipo: "semanal", semanas: { 1: "mica", 3: "mica" } },
    { id: "cen-cocina", local: "centro", nombre: "Limpieza a fondo de la cocina: mesadas, bacha y campana", tipo: "semanal", semanas: { 1: "juli", 2: "juli", 3: "juli", 4: "juli" } },
    { id: "cen-horno", local: "centro", nombre: "Limpieza del horno y las placas", tipo: "semanal", semanas: { 1: "juli", 3: "juli" } },
    { id: "cen-freezer", local: "centro", nombre: "Descongelar y ordenar el freezer", tipo: "semanal", semanas: { 2: "juli", 4: "juli" } },
    { id: "cen-vajilla", local: "centro", nombre: "Revisar la vajilla: separar tazas cachadas y pulir cubiertos", tipo: "semanal", semanas: { 2: "juli", 4: "juli" } },
    // La cafetera del Centro se turna: un lunes cada una (desde el lunes de referencia).
    { id: "cen-cafetera", local: "centro", nombre: "Limpieza a fondo de la cafetera (descalcificar y lavar filtros)", tipo: "lunes", rotacion: ["mica", "juli"], desde: "2026-09-21" }
];

// ---------- Pedidos a proveedores ----------
// Qué día se hace el pedido de cada rubro y qué día llega (0 = domingo, 1 = lunes … 6 = sábado).
// Se muestra en la sección Pedidos y marca lo que se pide o llega hoy.
export const PEDIDOS = [
    { marcas: ["Lácteos", "Crema", "Manteca"], dias: [{ pide: 1, llega: 2 }, { pide: 4, llega: 5 }] },
    { marcas: ["Café en grano", "Té y hierbas"], dias: [{ pide: 2, llega: 4 }] },
    { marcas: ["Harinas", "Azúcar", "Chocolate", "Descartables"], dias: [{ pide: 3, llega: 5 }] },
    { marcas: ["Frutas frescas"], dias: [{ pide: 1, llega: 3 }, { pide: 5, llega: 6 }] }
];

// Formas de pago para los pedidos de clientes (es opcional: se puede dejar "Todavía no se sabe").
export const FORMAS_PAGO = ["Efectivo", "Transferencia", "QR", "Débito", "Crédito"];

// ---------- Checklists (por persona y local) ----------
// Se tildan cada día y al día siguiente arrancan vacíos. En "Hoy" le aparece a la persona el del local
// donde está según su turno, y Carolina ve en Actividad si se completó.
// Cada ítem tiene un id fijo (no cambiarlo: con él se guarda lo tildado). "sabado" = aviso que se resalta los sábados.
export const CHECKLISTS = [
    {
        id: "mica-apertura-centro", persona: "mica", local: "centro", titulo: "Apertura · Centro", icono: "☀️",
        items: [
            { id: "cafetera", texto: "Prender la cafetera y tirar el primer café de prueba" },
            { id: "vitrina", texto: "Armar la vitrina con las tortas del día y sus carteles" },
            { id: "temperatura", texto: "Anotar la temperatura de la heladera y la vitrina" },
            { id: "posnet", texto: "Posnet conectado y con carga" },
            { id: "mesas", texto: "Mesas limpias, servilleteros llenos y azucareros completos" },
            { id: "musica", texto: "Música prendida (volumen bajo)" },
            { id: "cartel", texto: "Sacar la pizarra a la vereda" }
        ]
    },
    {
        id: "mica-cierre-plaza", persona: "mica", local: "plaza", titulo: "Cierre del local · Plaza", icono: "🔒",
        items: [
            { id: "cafetera", texto: "Apagar la cafetera y hacer el retrolavado" },
            { id: "basura", texto: "Basura: sacarla y poner bolsa nueva", sabado: "Hoy es sábado: se saca sí o sí (los 3 tachos)" },
            { id: "vitrina", texto: "Pasar a la heladera lo que queda de la vitrina, tapado y con fecha" },
            { id: "sobrantes", texto: "Avisar al grupo qué tortas quedaron para mañana" },
            { id: "horno", texto: "Horno apagado y llave del gas cerrada" },
            { id: "piso", texto: "Barrer y trapear el salón" },
            { id: "luces", texto: "Apagar luces: salón, cocina y depósito" },
            { id: "posnet", texto: "Dejar cargando el posnet" },
            { id: "alarma", texto: "Activar la alarma" }
        ]
    }
];

// ---------- Stock con mínimo (idea traída de Restix, 12/10/2026) ----------
// Lo que hay de cada insumo en cada local. Si queda en el mínimo o menos, aparece como faltante
// en "Hoy" de quien está en ese local y en Actividad de Carolina. "paso" = cuánto suma o resta cada toque.
export const INSUMOS = [
    { id: "crema", nombre: "Crema de leche", unidad: "litros", minimo: 4, paso: 1 },
    { id: "leche", nombre: "Leche", unidad: "litros", minimo: 10, paso: 1 },
    { id: "cafe", nombre: "Café en grano", unidad: "kg", minimo: 3, paso: 1 },
    { id: "manteca", nombre: "Manteca", unidad: "kg", minimo: 2, paso: 1 },
    { id: "harina", nombre: "Harina 0000", unidad: "kg", minimo: 10, paso: 5 },
    { id: "azucar", nombre: "Azúcar", unidad: "kg", minimo: 5, paso: 1 },
    { id: "huevos", nombre: "Huevos", unidad: "maples", minimo: 2, paso: 1 },
    { id: "vasos", nombre: "Vasos para llevar", unidad: "paquetes", minimo: 3, paso: 1 }
];

// ---------- Producción del día (idea traída de la pantalla de Cocina de Restix) ----------
// Tortas y encargos con hora de entrega. La tarjeta se pone amarilla cuando falta menos de
// MINUTOS_AMARILLO y roja cuando falta menos de MINUTOS_ROJO (o ya se pasó la hora).
export const PRODUCCION = { MINUTOS_AMARILLO: 60, MINUTOS_ROJO: 20 };

// ---------- Cierre de caja por turno (idea traída de la caja de Restix) ----------
// fondo: el cambio con el que arranca la caja. tolerancia: diferencia (en $) que se considera "cerró bien".
export const CAJA = { fondo: 20000, tolerancia: 500 };
