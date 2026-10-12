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

// Acceso: el admin general y los encargados entran con su usuario (ej: carolina@cremona.app) y contraseña.
// Las chicas comparten un usuario del equipo (equipo@cremona.app) con una clave que ponen
// una sola vez por celular; después eligen su nombre. Con Firebase, las claves reales vivirían solo ahí.
export const DOMINIO_LOGIN = "cremona.app";
export const USUARIO_EQUIPO = "equipo";

// Códigos de acceso del modo prueba (pedido de Esteban, 12/10/2026):
// - el admin general (Valentín) entra con el suyo, que NO se muestra en la pantalla de entrada;
// - todos los demás (encargados y el equipo, también los que agregue Valentín) con el del equipo, que sí se muestra.
// En la demo no protegen datos reales: cada celular guarda lo suyo. Con Firebase, cada uno tendría su contraseña.
export const CLAVE_ADMIN_PRUEBA = "1102";
export const CLAVE_EQUIPO_PRUEBA = "1234";

// Protección contra quien pruebe claves: después de estos intentos fallidos, se bloquea ese celular un rato.
export const INTENTOS_MAXIMOS = 5;
export const MINUTOS_BLOQUEO = 15;

// ---------- Equipo, roles y permisos (como en DGT, pedido de Esteban 12/10/2026) ----------
// Equipo de base (nombres inventados). El admin general y los encargados agregan, editan y dan de baja
// personas desde Más → Equipo y permisos; esos cambios se guardan aparte (colección "usuarios") y se suman a esta lista.
// rol: "admin_general" (uno solo: todo, maneja los permisos) · "encargado" (gestiona al equipo de salón, cocina y caja,
// no a otros encargados ni al admin) · "salon" (mozos) · "cocina" (cocineros) · "caja" (cobra las mesas que le pasan
// los mozos). "puesto" es solo el texto que se muestra.
// "local" (opcional): para quien no figura en los turnos de LOCALES, en qué local trabaja.
export const PERSONAS = {
    // Valentín es cocinero de Cremona y el admin general de la demo (pedido de Esteban, 12/10/2026).
    valentin: { nombre: "Valentín", rol: "admin_general", puesto: "cocinero" },
    mica: { nombre: "Mica", rol: "salon", puesto: "moza" },
    juli: { nombre: "Juli", rol: "cocina", puesto: "cocinera" },
    nati: { nombre: "Nati", rol: "caja", puesto: "cajera", local: "centro" },
    carolina: { nombre: "Carolina", rol: "encargado", puesto: "encargada" }
};

export const ROLES = {
    admin_general: { nombre: "Admin general", puestoSugerido: "dueño" },
    encargado: { nombre: "Encargado/a", puestoSugerido: "encargada" },
    salon: { nombre: "Salón (mozos)", puestoSugerido: "moza" },
    cocina: { nombre: "Cocina", puestoSugerido: "cocinero" },
    caja: { nombre: "Caja", puestoSugerido: "cajera" }
};

// Qué puede hacer cada rol. El admin general puede todo (no se cambia). Lo de los demás lo cambia el admin general
// en Equipo y permisos (se guarda en la colección "permisos"); esto es lo de fábrica.
// gestion: true = solo tiene sentido para el encargado (pantallas de gestión).
export const PERMISOS = [
    { id: "salon", texto: "Salón y mesas" },
    { id: "comandas", texto: "Comandas de cocina" },
    { id: "produccionHoy", texto: "Ver lo que hay que cocinar en su Hoy" },
    { id: "produccion", texto: "Producción del día (anotar encargos)" },
    { id: "stock", texto: "Ver el stock" },
    { id: "ajustarStock", texto: "Cambiar cantidades de stock" },
    { id: "caja", texto: "Cierre de caja" },
    { id: "cobrarMesa", texto: "Cobrar sus mesas (\"la cobré yo\")" },
    { id: "cobrar", texto: "Cobrar las mesas que pasan a caja" },
    { id: "mapa", texto: "Acomodar el mapa del salón", gestion: true },
    { id: "informes", texto: "Informes", gestion: true },
    { id: "tareas", texto: "Tareas puntuales y agenda", gestion: true },
    { id: "usuarios", texto: "Agregar y editar personas", gestion: true }
];

export const PERMISOS_DE_FABRICA = {
    encargado: { salon: true, comandas: true, produccionHoy: false, produccion: true, stock: true, ajustarStock: true, caja: true, cobrarMesa: true, cobrar: true, mapa: true, informes: true, tareas: true, usuarios: true },
    salon: { salon: true, comandas: false, produccionHoy: false, produccion: true, stock: true, ajustarStock: true, caja: true, cobrarMesa: true, cobrar: false },
    cocina: { salon: false, comandas: true, produccionHoy: true, produccion: true, stock: true, ajustarStock: true, caja: false, cobrarMesa: false, cobrar: false },
    caja: { salon: false, comandas: false, produccionHoy: false, produccion: true, stock: true, ajustarStock: false, caja: true, cobrarMesa: false, cobrar: true }
};

// Formas de cobro al cerrar una mesa (se suman solas en el cierre de caja del turno).
export const MEDIOS_COBRO = [["efectivo", "💵 Efectivo"], ["transferencias", "📲 Transferencia o QR"], ["tarjetas", "💳 Débito o crédito"]];

// Cremona tiene un local: Humberto Primo 1152, Luján (abre de lunes a sábado de 8 a 20).
// El id "centro" quedó de la primera versión de la demo (lo usan los colores y los datos); el nombre es el real.
// cambioTurno: hora en que el turno mañana pasa al turno tarde.
export const LOCALES = {
    centro: {
        nombre: "Humberto Primo",
        direccion: "Humberto Primo 1152, Luján",
        cambioTurno: "14:00",
        turnos: { manana: "mica", tarde: "juli" }
    }
};

// Tipos de tarea:
//  - "semanal": semana del mes (1 = días 1-7, 2 = 8-14, 3 = 15-21, 4 = 22 a fin de mes) → persona
//  - "lunes":   se hace cada lunes; "persona" fija o "rotacion" que alterna un lunes cada una
//  - "libre":   sin asignar todavía; se muestra hace cuántos días se hizo por última vez
// Repartidas por puesto: Mica (moza, mañana) el salón y la barra; Juli (cocinera, tarde) la cocina.
export const TAREAS = [
    // ---------- Salón y barra: Mica ----------
    { id: "cafetera", local: "centro", nombre: "Limpieza a fondo de la cafetera (descalcificar y lavar filtros)", tipo: "lunes", persona: "mica" },
    { id: "vitrina", local: "centro", nombre: "Limpieza a fondo de la vitrina (vidrios, bandejas y burletes)", tipo: "semanal", semanas: { 1: "mica", 3: "mica" } },
    { id: "barra", local: "centro", nombre: "Limpieza de la barra y los estantes de tazas", tipo: "semanal", semanas: { 2: "mica", 4: "mica" } },
    { id: "molinillo", local: "centro", nombre: "Limpiar el molinillo de café y la tolva", tipo: "semanal", semanas: { 1: "mica", 3: "mica" } },
    { id: "mesas", local: "centro", nombre: "Repasar mesas, sillas y el sillón del salón", tipo: "semanal", semanas: { 2: "mica", 4: "mica" } },
    { id: "vereda", local: "centro", nombre: "Limpieza de la vereda y las mesas de afuera", tipo: "semanal", semanas: { 1: "mica", 3: "mica" } },
    { id: "vidrios", local: "centro", nombre: "Limpieza a fondo de los vidrios de la entrada", tipo: "semanal", semanas: { 2: "mica", 4: "mica" } },
    { id: "pizarra", local: "centro", nombre: "Cambiar la pizarra de la semana (torta del mes y promos)", tipo: "semanal", semanas: { 1: "mica", 2: "mica", 3: "mica", 4: "mica" } },

    // ---------- Cocina: Juli ----------
    { id: "cocina", local: "centro", nombre: "Limpieza a fondo de la cocina: mesadas, bacha y campana", tipo: "semanal", semanas: { 1: "juli", 2: "juli", 3: "juli", 4: "juli" } },
    { id: "horno", local: "centro", nombre: "Limpieza del horno y las placas", tipo: "semanal", semanas: { 1: "juli", 3: "juli" } },
    { id: "heladera", local: "centro", nombre: "Ordenar la heladera y tirar lo vencido", tipo: "semanal", semanas: { 2: "juli", 4: "juli" } },
    { id: "freezer", local: "centro", nombre: "Descongelar y ordenar el freezer", tipo: "semanal", semanas: { 3: "juli" } },
    { id: "deposito", local: "centro", nombre: "Limpiar y acomodar el depósito (harinas, azúcar, descartables)", tipo: "semanal", semanas: { 1: "juli", 3: "juli" } },
    { id: "vajilla", local: "centro", nombre: "Revisar la vajilla: separar tazas cachadas y pulir cubiertos", tipo: "semanal", semanas: { 2: "juli", 4: "juli" } }
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
// donde está según su turno, y los encargados ven en Actividad si se completó.
// Cada ítem tiene un id fijo (no cambiarlo: con él se guarda lo tildado). "sabado" = aviso que se resalta los sábados.
export const CHECKLISTS = [
    {
        id: "mica-apertura", persona: "mica", local: "centro", titulo: "Apertura y salón", icono: "☀️",
        items: [
            { id: "cafetera", texto: "Prender la cafetera y tirar el primer café de prueba" },
            { id: "vitrina", texto: "Armar la vitrina con la viennoiserie y las tortas del día" },
            { id: "temperatura", texto: "Anotar la temperatura de la heladera y la vitrina" },
            { id: "posnet", texto: "Posnet conectado y con carga" },
            { id: "mesas", texto: "Mesas y sillas limpias y derechas" },
            { id: "servilleteros", texto: "Armar los servilleteros" },
            { id: "aderezos", texto: "Rellenar azucareros y sobres de edulcorante" },
            { id: "bebidas", texto: "Cargar la heladera de bebidas y poner a enfriar" },
            { id: "cartas", texto: "Cartas limpias, una en cada mesa" },
            { id: "musica", texto: "Música prendida (volumen bajo)" }
        ]
    },
    {
        id: "juli-cierre", persona: "juli", local: "centro", titulo: "Cierre del local", icono: "🔒",
        items: [
            { id: "cafetera", texto: "Apagar la cafetera y hacer el retrolavado" },
            { id: "basura", texto: "Basura: sacarla y poner bolsa nueva", sabado: "Hoy es sábado: se saca sí o sí (mañana está cerrado)" },
            { id: "vitrina", texto: "Pasar a la heladera lo que queda de la vitrina, tapado y con fecha" },
            { id: "sobrantes", texto: "Avisar al grupo qué tortas quedaron para mañana" },
            { id: "horno", texto: "Horno apagado y llave del gas cerrada" },
            { id: "piso", texto: "Barrer y trapear el salón y la cocina" },
            { id: "luces", texto: "Apagar luces: salón, cocina y depósito" },
            { id: "posnet", texto: "Dejar cargando el posnet" },
            { id: "alarma", texto: "Activar la alarma" }
        ]
    }
];

// ---------- Stock con mínimo (idea traída de Restix, 12/10/2026) ----------
// Lo que hay de cada insumo en cada local. Si queda en el mínimo o menos, aparece como faltante
// en "Hoy" de quien está en ese local y en Actividad de los encargados. "paso" = cuánto suma o resta cada toque.
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

// ---------- Salón y cocina: mesas y comandas (idea traída de Restix, 12/10/2026) ----------
// Cuántas mesas tiene cada sector al empezar. Después el admin general (o quien tenga el permiso "mapa") las acomoda
// en el mapa, agrega o quita mesas; cada sector se guarda en la colección "salonMapa".
// Sectores del salón (dato de Valentín, 12/10/2026: salón, galería y vereda, de 30 a 40 mesas).
// Las mesas se numeran seguidas entre sectores (Salón 1-16, Galería 17-28, Vereda 29-36).
export const SECTORES = {
    centro: [
        { id: "salon", nombre: "Salón", mesas: 16 },
        { id: "galeria", nombre: "Galería", mesas: 12 },
        { id: "vereda", nombre: "Vereda", mesas: 8 }
    ]
};

// Carta real de Cremona Coffee & Brunch (carta de enero 2026, _referencias\carta-cremona-enero-26.pdf).
// Cada sección tiene el color de su recuadro en la carta impresa ("estilo") y una foto de su Instagram.
// cocina: true = lo prepara cocina (va como comanda); el resto (café, bebidas, vitrina) lo sirve la moza.
// Cada ítem: [nombre, precio, descripción (opcional)]. El id se arma solo a partir del nombre.
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const seccion = (categoria, { estilo = "", foto = "", nota = "", cocina = false }, items) => ({
    categoria, estilo, foto, nota,
    items: items.map(([nombre, precio, desc = ""]) => ({ id: slug(`${categoria}-${nombre}`), nombre, precio, desc, cocina }))
});

export const CARTA = [
    seccion("Café", { foto: "cafe.jpg", nota: "Servimos el café con leche a 60/70° para aprovechar sus cualidades. Si lo preferís más caliente, pedíselo al barista." }, [
        ["Espresso", 4200, "Un shot intenso de nuestro café."],
        ["Espresso Doble", 4900, "Doble shot, doble intensidad."],
        ["Americano", 4900, "Agua a 65° y doble shot de espresso."],
        ["Lungo", 4200, "Un café chiquito pero suave."],
        ["Cortado", 4700, "Un shot con leche emulsionada, doble o simple."],
        ["Cappuccino", 5700, "Café con leche emulsionada en taza mediana, cremoso y suave."],
        ["Flat White", 5700, "Doble espresso con leche levemente emulsionada, en taza mediana."],
        ["Magic", 5400, "Doble ristretto con leche sutilmente emulsionada. El favorito de los baristas."],
        ["Latte", 5700, "Un shot de espresso con leche en taza grande."],
        ["Latte Doble", 6200, "Doble shot de espresso en taza grande."]
    ]),
    seccion("Especiales con café", { foto: "especiales.jpg" }, [
        ["Mocha", 6300, "Espresso, gotas de chocolate, cacao y leche."],
        ["Mocha Blanco", 6300, "Espresso, chocolate blanco y leche, para los dulceros."],
        ["Vainilla Latte", 6300, "Nuestro latte endulzado con syrup de vainilla."],
        ["Caramel Latte", 6300, "Nuestro latte endulzado con syrup de caramelo."]
    ]),
    seccion("Café frío", { foto: "espresso.jpg" }, [
        ["Coffee Tonic", 6900], ["Iced Americano", 5700], ["Iced Latte", 6300], ["Iced Flat", 6300],
        ["Iced Vainilla", 6900], ["Iced Caramel", 6900], ["Frappuccino de Chocolate", 9000], ["Frappuccino de Caramel", 9000]
    ]),
    seccion("Adicionales", {}, [["Jarrita de leche", 1200], ["Leche de almendra", 2300], ["Extra shot", 2300]]),
    seccion("Especiales sin café", {}, [
        ["Chocolate caliente / Submarino", 6300],
        ["Chai Latte", 5000, "Té negro especiado con canela, clavo, cardamomo, jengibre y anís, con leche emulsionada."],
        ["Té en hebras", 5300, "Consultá variedades."],
        ["Matcha Latte", 5700, "Té verde grado ceremonial con leche emulsionada."],
        ["Babyccino", 6200, "Leche emulsionada con vainilla, malvaviscos y cacao."]
    ]),
    seccion("Mocktails", {}, [
        ["Iced Shaken H&L Tea", 6400, "Infusión fría de hibiscus shakeada con almíbar de limón."],
        ["Ginger Mojito", 7000, "Jugo de lima, syrup de jengibre, menta y soda."],
        ["Anana Sparkling", 7000, "Jugo de ananá y lima, almíbar simple y tónica."],
        ["Strawberry Soda", 6400, "Soda de frutilla y pimienta rosa."]
    ]),
    seccion("Bebidas", {}, [
        ["Agua sin gas / con gas", 2000], ["Gaseosa", 4200], ["Pomelada con romero", 6800], ["Jugo de naranja", 6200],
        ["Limonada clásica", 6800], ["Limonada de frutos rojos", 6800], ["Licuado de naranja y frutilla", 7200], ["Licuado de banana", 7200]
    ]),
    seccion("Viennoiserie", { estilo: "caramelo", foto: "croissant.jpg" }, [
        ["Medialuna de manteca", 4400], ["Medialuna de grasa", 4400], ["Croissant clásico", 4700],
        ["Croissant relleno frutos rojos", 6900], ["Croissant relleno pistachos", 6900], ["Pan de chocolate", 6300],
        ["Danesa de pastelera", 5900], ["Roll New York pistacho", 6300]
    ]),
    seccion("Pastelería", { estilo: "beige", foto: "cookies.jpg", nota: "Consultá por las opciones keto disponibles." }, [
        ["Macaron", 4200], ["Alfajor Cremona", 6900, "Consultá variedades."],
        ["Brownie", 9700, "Con ddl y merengue o chips de chocolate blanco."],
        ["Cookie New York", 6000, "Con chips de chocolate."], ["Cookie Oreo", 6000], ["Cookie choco blanco y frambuesa", 6300],
        ["Cookie pistacho", 6900], ["Cookie dulce de leche", 6900], ["Cookie avellana", 6900], ["Cookie red velvet", 6900],
        ["Éclair con pastelera", 6300], ["Éclair con pistacho", 6300],
        ["Yogurt con granola, frutas y miel", 16000], ["Açaí con fruta, granola y leche condensada", 16000],
        ["Budín (frutos rojos, limón, inglés o zanahoria y naranja vegano)", 6600]
    ]),
    seccion("Tortas", { estilo: "salvia", foto: "torta.jpg" }, [
        ["Lemon Pie", 13800], ["Rogel", 7000], ["Cheesecake New York", 14400], ["Red Velvet lingote", 13300],
        ["Matilda lingote", 13300], ["Key Lime Pie", 13800], ["Crumble de manzana", 9800], ["Crumble de frutos rojos", 9800],
        ["Torta Oreo", 14400], ["Torta del mes", 12000]
    ]),
    seccion("Brunch", { foto: "brunch.jpg", cocina: true }, [
        ["Croissant con jamón y queso", 9200], ["Croissant con panceta, huevo revuelto y queso", 12000],
        ["Bagel de salmón y queso crema", 21800], ["Bagel de rúcula, huevo revuelto y panceta", 13800],
        ["Huevos benedictinos", 11500],
        ["Croque-madame", 14500, "Sándwich de jamón y queso con bechamel gratinada, queso y huevo a la plancha."],
        ["Pastron & Honey Mustard", 13800, "Ciabatta de pastron, provolone gratinado y mostaza con miel."]
    ]),
    seccion("Almuerzos ligeros", { cocina: true, nota: "De 12.30 a 14.30 hs." }, [
        ["Poke bowl de pollo", 20200, "Arroz, pollo teriyaki, palta, cherry, choclo y almendras."],
        ["Poke bowl de calabaza", 19000, "Arroz, calabaza, huevo, palta y almendras."],
        ["Poke bowl de salmón", 25500, "Arroz, salmón, palta, calabaza, repollo y sésamo."],
        ["Wrap de pollo", 16600, "Pollo, zanahoria, lechuga y queso crema."],
        ["Tarteleta individual", 16000, "De calabaza o jamón y queso, con mix de hojas verdes."],
        ["Ensalada Caesar", 16000], ["Sopa cremosa de calabaza", 14000],
        ["Hamburguesa veggie", 14500, "De calabaza y garbanzo o lentejas y zanahoria, con ensalada."],
        ["Menú del día", 13500]
    ]),
    seccion("Opciones saladas", { estilo: "oscuro", cocina: true }, [
        ["Tostado de queso", 9700, "Miga o pan árabe."], ["Tostado de jamón y queso", 10300, "Miga o pan árabe."],
        ["Tostado de crudo y rúcula", 12600, "Pan árabe."], ["Tostada con huevo revuelto", 10200],
        ["Huevo revuelto", 7500], ["Avocado toast", 14000, "Con huevo revuelto o poché."], ["Scon de queso", 6400],
        ["Tostadas con queso crema, mermelada y ddl", 7500]
    ])
];

// Comanda en cocina: amarilla a los MINUTOS_AMARILLO de haberse mandado y roja a los MINUTOS_ROJO (como en Restix).
export const COMANDAS = { MINUTOS_AMARILLO: 15, MINUTOS_ROJO: 25 };
